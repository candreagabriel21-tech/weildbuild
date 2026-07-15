// ==================== WEILDBUILD SECURITY MODULE ====================
// Central security utilities for authentication, authorization, input validation,
// rate limiting, CSRF protection, and safe error handling.
//
// CORE PRINCIPLE: NEVER trust the client. The server is the sole authority.
//
// Session management and rate limiting use Supabase for persistent storage.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "./file-db";
import { z, ZodError } from "zod";
import { randomBytes } from "crypto";
import { supabase } from "./supabase-server";

// ==================== SECURITY: RATE LIMITING ====================
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function checkRateLimit(identifier: string, maxAttempts: number = MAX_LOGIN_ATTEMPTS, windowMs: number = RATE_LIMIT_WINDOW_MS): Promise<{ allowed: boolean; remainingAttempts: number }> {
  const now = Date.now();

  try {
    const { data, error } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .single();

    if (data) {
      // Reset if window expired
      if (now - data.window_start > windowMs) {
        await supabase
          .from("rate_limits")
          .upsert({ identifier, attempts: 1, window_start: now }, { onConflict: "identifier" });
        return { allowed: true, remainingAttempts: maxAttempts - 1 };
      }
      if (data.attempts >= maxAttempts) {
        return { allowed: false, remainingAttempts: 0 };
      }
      const newAttempts = data.attempts + 1;
      await supabase
        .from("rate_limits")
        .update({ attempts: newAttempts })
        .eq("identifier", identifier);
      return { allowed: true, remainingAttempts: maxAttempts - newAttempts };
    }

    // No record found — create one
    await supabase
      .from("rate_limits")
      .insert({ identifier, attempts: 1, window_start: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  } catch {
    // On error, deny the request (fail closed — safer than allowing)
    return { allowed: false, remainingAttempts: 0 };
  }
}

export async function resetRateLimit(identifier: string) {
  try {
    await supabase
      .from("rate_limits")
      .delete()
      .eq("identifier", identifier);
  } catch {}
}

// ==================== SECURITY: SESSION MANAGEMENT ====================
// Sessions never expire — once a player logs in, they stay logged in forever.
// Up to MAX_SESSIONS_PER_USER devices can be logged into the same account at once.
// If the limit is reached, the oldest session is evicted to make room.

export interface SessionData {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number; // Always 0 — sessions never expire
}

const MAX_SESSIONS_PER_USER = 5; // Up to 5 devices logged in simultaneously

export async function createSession(username: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const session = {
    token,
    username,
    created_at: Date.now(),
    expires_at: 0, // 0 means never expires
  };

  try {
    // Check how many active sessions this user already has
    const { data: existingSessions, error: fetchErr } = await supabase
      .from("sessions")
      .select("token, created_at")
      .eq("username", username)
      .order("created_at", { ascending: true });

    if (!fetchErr && existingSessions && existingSessions.length >= MAX_SESSIONS_PER_USER) {
      // Evict the oldest sessions to stay within the limit
      // Keep (MAX_SESSIONS_PER_USER - 1) sessions, the new one will be the Nth
      const sessionsToEvict = existingSessions.slice(0, existingSessions.length - MAX_SESSIONS_PER_USER + 1);
      for (const s of sessionsToEvict) {
        await supabase
          .from("sessions")
          .delete()
          .eq("token", s.token);
      }
    }

    await supabase
      .from("sessions")
      .insert(session);
  } catch (e: any) {
    console.error("[Supabase] createSession error:", e.message);
  }

  return token;
}

export async function verifySession(token: string): Promise<string | null> {
  if (!token) return null;
  // Validate token format (hex, 64 chars)
  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !data) return null;

    // Sessions never expire — no expiry check needed
    // expires_at is 0 (sentinel value meaning "never expires")

    return data.username;
  } catch {
    return null;
  }
}

export async function deleteSession(token: string) {
  if (!token) return;
  try {
    await supabase
      .from("sessions")
      .delete()
      .eq("token", token);
  } catch {}
}

export async function deleteUserSessions(username: string, excludeToken?: string) {
  try {
    let query = supabase
      .from("sessions")
      .delete()
      .eq("username", username);
    // If excludeToken is provided, keep that session alive (e.g. current device)
    if (excludeToken) {
      query = query.neq("token", excludeToken);
    }
    await query;
  } catch {}
}

/**
 * Count active sessions for a user. Returns the number of sessions.
 */
export async function countUserSessions(username: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("username", username);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

// ==================== AUTHENTICATION HELPERS ====================

/**
 * Extracts and validates the authenticated user from the session cookie.
 * Returns the username if authenticated, or null if not.
 * This is the SINGLE SOURCE OF TRUTH for "who is making this request".
 */
export async function getAuthUser(req: NextRequest): Promise<string | null> {
  // Try cookie first, then header fallback (for preview platforms where cookies don't persist)
  let sessionToken = req.cookies.get("wb_session")?.value;
  if (!sessionToken) {
    sessionToken = req.headers.get("x-session-token") || undefined;
  }
  if (!sessionToken) return null;
  return verifySession(sessionToken);
}

/**
 * Requires authentication. Returns the username if authenticated,
 * or a 401 NextResponse if not.
 * USE THIS on every mutating endpoint instead of "soft session checks".
 */
export async function requireAuth(req: NextRequest): Promise<string | NextResponse> {
  const username = await getAuthUser(req);
  if (!username) {
    return NextResponse.json(
      { error: "Authentication required. Please log in." },
      { status: 401 }
    );
  }
  return username;
}

/**
 * Requires authentication + admin role. Returns the username if authorized,
 * or a 401/403 NextResponse if not.
 */
export async function requireAdmin(req: NextRequest): Promise<string | NextResponse> {
  const authResult = await requireAuth(req);
  if (typeof authResult !== "string") return authResult; // It's an error response

  const user = await getUser(authResult);
  if (!user || (user.admin_role !== "admin" && user.admin_role !== "top_admin")) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }
  return authResult;
}

/**
 * Requires that the authenticated user matches the target username,
 * OR the authenticated user is an admin.
 * Returns the username if authorized, or a 403 response if not.
 */
export async function requireSelfOrAdmin(req: NextRequest, targetUsername: string): Promise<string | NextResponse> {
  const authResult = await requireAuth(req);
  if (typeof authResult !== "string") return authResult;

  if (authResult === targetUsername) return authResult;

  // Check if admin
  const user = await getUser(authResult);
  if (user && (user.admin_role === "admin" || user.admin_role === "top_admin")) {
    return authResult;
  }

  return NextResponse.json(
    { error: "You can only perform this action on your own account." },
    { status: 403 }
  );
}

// ==================== INPUT VALIDATION (ZOD SCHEMAS) ====================

export const registerSchema = z.object({
  action: z.literal("register"),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const loginSchema = z.object({
  action: z.literal("login"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  action: z.literal("changePassword"),
  username: z.string().min(1),
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "New password must be at most 128 characters")
    .regex(/[A-Z]/, "New password must contain at least one uppercase letter")
    .regex(/[a-z]/, "New password must contain at least one lowercase letter")
    .regex(/[0-9]/, "New password must contain at least one number"),
  endOtherSessions: z.boolean().default(false), // If true, invalidate all other device sessions
});

export const logoutSchema = z.object({
  action: z.literal("logout"),
});

export const authActionSchema = z.discriminatedUnion("action", [
  registerSchema,
  loginSchema,
  changePasswordSchema,
  logoutSchema,
]);

export const buyItemSchema = z.object({
  username: z.string().min(1),
  itemId: z.string().min(1).max(50),
});

export const updateUserSchema = z.object({
  username: z.string().min(1),
}).passthrough(); // Allow additional fields, they'll be filtered by filterUserUpdates

export const createGameSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
}).passthrough();

export const updateGameSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(50).optional(),
  description: z.string().max(200).optional(),
}).passthrough();

export const friendActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), from: z.string().min(1), to: z.string().min(1) }),
  z.object({ action: z.literal("cancel"), from: z.string().min(1), to: z.string().min(1) }),
  z.object({ action: z.literal("accept"), username: z.string().min(1), friend: z.string().min(1) }),
  z.object({ action: z.literal("decline"), username: z.string().min(1), friend: z.string().min(1) }),
  z.object({ action: z.literal("remove"), username: z.string().min(1), friend: z.string().min(1) }),
  z.object({ action: z.literal("block"), username: z.string().min(1), target: z.string().min(1) }),
  z.object({ action: z.literal("unblock"), username: z.string().min(1), target: z.string().min(1) }),
  z.object({
    action: z.literal("send_message"),
    from: z.string().min(1),
    to: z.string().min(1),
    content: z.string().min(1).max(1000),
  }),
]);

export const notificationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("markRead"), username: z.string().min(1) }),
  z.object({
    action: z.literal("create"),
    username: z.string().min(1),
    type: z.string().min(1),
    message: z.string().min(1).max(500),
    from: z.string().optional(),
  }),
]);

/**
 * Validate request body against a Zod schema.
 * Returns parsed data on success, or a 400 NextResponse on failure.
 */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): T | NextResponse {
  try {
    return schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      // Zod 4 uses `issues`, Zod 3 uses `errors` — handle both
      const issues = (e as any).issues || (e as any).errors || [];
      const firstIssue = issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// ==================== SAFE ERROR HANDLING ====================

/**
 * Wraps an API handler with safe error handling.
 * NEVER exposes internal error details to the client.
 * Logs the real error server-side for debugging.
 */
export function safeApiHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  return handler().catch((e) => {
    // Log the real error server-side
    console.error("[API Error]", e);

    // Return a generic error to the client — NEVER expose internals
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    );
  });
}

// ==================== RATE LIMITING (API-LEVEL) ====================

const RATE_LIMITS: Record<string, { maxAttempts: number; windowMs: number }> = {
  register: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },     // 5 registrations per hour per IP
  login: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },        // 10 login attempts per 15 min
  buy_item: { maxAttempts: 100, windowMs: 60 * 1000 },          // 100 purchases per minute
  send_message: { maxAttempts: 60, windowMs: 60 * 1000 },       // 60 messages per minute
  create_game: { maxAttempts: 30, windowMs: 60 * 1000 },        // 30 games per minute
  update_user: { maxAttempts: 300, windowMs: 60 * 1000 },       // 300 profile updates per minute (avatar, settings, etc.)
  general_api: { maxAttempts: 10000, windowMs: 60 * 1000 },      // 10000 general API calls per minute (high because Caddy proxy shares one IP)
};

/**
 * Rate limit check that returns a 429 response if limit exceeded.
 * Uses username (if authenticated) or IP address as identifier.
 */
export async function requireRateLimit(
  req: NextRequest,
  endpoint: string,
  username?: string
): Promise<NextResponse | null> {
  const identifier = username || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.general_api;
  const result = await checkRateLimit(`${endpoint}_${identifier}`, config.maxAttempts, config.windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter: Math.ceil(config.windowMs / 1000) },
      { status: 429 }
    );
  }
  return null; // Allowed
}

// ==================== CSRF / ORIGIN VALIDATION ====================

/**
 * Origin validation — verifies that the request Origin (or Referer) matches
 * the expected host. Prevents CSRF attacks from cross-origin pages.
 * Allows localhost/127.0.0.1 for development.
 */
export function validateOrigin(req: NextRequest): NextResponse | null {
  // GET requests are not state-changing; skip origin check
  if (req.method === "GET") return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // If neither Origin nor Referer is set, allow (e.g. API clients, desktop app)
  if (!origin && !referer) return null;

  const host = req.headers.get("host") || "";
  const allowedHosts = getAllowedHosts(host);

  // Check Origin header first (preferred for CSRF protection)
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (isOriginAllowed(originUrl, allowedHosts)) return null;
    } catch {
      // Malformed origin — reject
    }
    return NextResponse.json(
      { error: "Invalid origin. Request blocked for security." },
      { status: 403 }
    );
  }

  // Fallback: check Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (isOriginAllowed(refererUrl, allowedHosts)) return null;
    } catch {
      // Malformed referer — reject
    }
    return NextResponse.json(
      { error: "Invalid origin. Request blocked for security." },
      { status: 403 }
    );
  }

  return null;
}

function getAllowedHosts(requestHost: string): string[] {
  const hosts: string[] = [];
  if (requestHost) hosts.push(requestHost);
  // Development hosts
  hosts.push("localhost:3000", "localhost:3001", "127.0.0.1:3000", "127.0.0.1:3001");
  // Also allow without port
  hosts.push("localhost", "127.0.0.1");
  // Preview platform wildcard — allows any *.space-z.ai subdomain
  hosts.push("*.space-z.ai");
  // Configured additional allowed origins via env var (comma-separated)
  if (process.env.ALLOWED_ORIGINS) {
    for (const o of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = o.trim();
      if (trimmed) {
        try {
          const u = new URL(trimmed);
          hosts.push(u.host);
        } catch {
          hosts.push(trimmed);
        }
      }
    }
  }
  return hosts;
}

function isOriginAllowed(originUrl: URL, allowedHosts: string[]): boolean {
  const originHost = originUrl.host; // includes port
  const originHostname = originUrl.hostname; // without port
  return allowedHosts.some(allowed => {
    // Exact match (host:port)
    if (allowed === originHost) return true;
    // Hostname-only match for dev hosts without port
    if (allowed === originHostname) return true;
    // Wildcard subdomain match (e.g. *.space-z.ai matches preview-xxx.space-z.ai)
    if (allowed.startsWith("*.")) {
      const suffix = allowed.slice(1); // e.g. ".space-z.ai"
      if (originHostname.endsWith(suffix)) return true;
      // Also match if the origin hostname IS the base domain (e.g. "space-z.ai")
      if (originHostname === allowed.slice(2)) return true;
    }
    return false;
  });
}

// ==================== TRANSACTION LOGGING ====================

export interface TransactionLog {
  id: string;
  timestamp: string;
  type: "purchase" | "refund" | "reward" | "transfer" | "admin_adjust";
  username: string;
  itemId?: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
}

export async function logTransaction(transaction: Omit<TransactionLog, "id" | "timestamp">): Promise<void> {
  const id = randomBytes(6).toString("hex");
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split("T")[0];

  try {
    await supabase
      .from("transaction_logs")
      .insert({
        id,
        log_date: dateStr,
        timestamp,
        type: transaction.type,
        username: transaction.username,
        item_id: transaction.itemId || "",
        amount: transaction.amount,
        balance_before: transaction.balanceBefore,
        balance_after: transaction.balanceAfter,
        description: transaction.description,
        performed_by: transaction.performedBy,
      });
  } catch (e: any) {
    console.error("[Supabase] logTransaction error:", e.message);
  }
}

export async function getTransactionLogs(username?: string, date?: string): Promise<TransactionLog[]> {
  const dateStr = date || new Date().toISOString().split("T")[0];

  try {
    let query = supabase
      .from("transaction_logs")
      .select("*")
      .eq("log_date", dateStr);

    if (username) {
      query = query.eq("username", username);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Map DB column names to API field names
    return data.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.type,
      username: row.username,
      itemId: row.item_id || undefined,
      amount: row.amount,
      balanceBefore: row.balance_before,
      balanceAfter: row.balance_after,
      description: row.description,
      performedBy: row.performed_by,
    }));
  } catch {
    return [];
  }
}
