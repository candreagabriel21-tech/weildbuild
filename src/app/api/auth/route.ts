// ==================== AUTH API ROUTE — SECURE ====================
// ALL soft session checks ELIMINATED.
// Every action properly validated with Zod schemas.
// Rate limiting on registration and login.
// Password changes now actually invalidate sessions.
// Internal errors NEVER exposed to client.

import { NextRequest, NextResponse } from "next/server";
import {
  createUser, verifyLogin, getUser, saveUser,
  secureHashPassword, generateSalt, validateUsername, verifyPassword,
} from "@/lib/file-db";
import {
  safeApiHandler, validateBody, requireRateLimit, validateOrigin,
  authActionSchema, registerSchema, loginSchema, changePasswordSchema, logoutSchema,
  createSession, verifySession, deleteSession, deleteUserSessions, countUserSessions,
  resetRateLimit,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin for all mutating requests
    const originError = validateOrigin(req);
    if (originError) return originError;

    const body = await req.json();

    // Validate action type with Zod
    const validated = validateBody(authActionSchema, body);
    if (validated instanceof NextResponse) return validated;

    // ---- REGISTER ----
    if (validated.action === "register") {
      // Rate limit registration by IP
      const rateLimitError = await requireRateLimit(req, "register");
      if (rateLimitError) return rateLimitError;

      const { username, password: pwd } = validated;

      // Double-validate username (defense in depth)
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        return NextResponse.json({ error: usernameValidation.error }, { status: 400 });
      }
      if (!pwd || pwd.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const result = await createUser(username, pwd);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

      const { user } = result;
      if (!user) return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      const { password, salt, ...safe } = user;

      const token = await createSession(username);
      const isSecure = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
      const response = NextResponse.json({ success: true, user: safe, sessionToken: token });
      response.cookies.set("wb_session", token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years — sessions never expire
        path: "/",
      });
      return response;
    }

    // ---- LOGIN ----
    if (validated.action === "login") {
      const { username, password: pwd } = validated;

      // Rate limit login by username + IP
      const rateLimitError = await requireRateLimit(req, "login", username);
      if (rateLimitError) return rateLimitError;

      const result = await verifyLogin(username, pwd);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 401 });

      const { user } = result;
      if (!user) return NextResponse.json({ error: "Login failed" }, { status: 500 });
      const { password, salt, ...safe } = user;

      // Reset rate limit on successful login
      await resetRateLimit(username);

      const token = await createSession(username);
      const isSecure = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
      const response = NextResponse.json({ success: true, user: safe, sessionToken: token });
      response.cookies.set("wb_session", token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years — sessions never expire
        path: "/",
      });
      return response;
    }

    // ---- CHANGE PASSWORD ----
    if (validated.action === "changePassword") {
      const { username: targetUser, oldPassword, newPassword, endOtherSessions } = validated;

      // REQUIRE authentication — user can only change their own password
      // Try cookie first, then header fallback (for preview platforms)
      let currentSessionToken = req.cookies.get("wb_session")?.value;
      if (!currentSessionToken) {
        currentSessionToken = req.headers.get("x-session-token") || undefined;
      }
      const sessionUser = currentSessionToken ? await verifySession(currentSessionToken) : null;
      if (!sessionUser) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      if (sessionUser !== targetUser) {
        return NextResponse.json({ error: "You can only change your own password." }, { status: 403 });
      }

      const user = await getUser(targetUser);
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

      // Verify old password
      const isValid = verifyPassword(oldPassword, user.password, user.salt, user.hash_version);
      if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
      }

      // Update with new scrypt hash
      const newSalt = generateSalt();
      user.password = secureHashPassword(newPassword, newSalt);
      user.salt = newSalt;
      user.hash_version = 1;
      await saveUser(targetUser, user);

      // Handle other sessions based on user's choice
      if (endOtherSessions) {
        // User chose to end all other device sessions — keep current device, kill the rest
        await deleteUserSessions(targetUser, currentSessionToken);
      }
      // If endOtherSessions is false, other device sessions remain untouched

      // Always create a new session for the current device (old token is associated with old credentials)
      // Delete the current session first so it doesn't count toward the 5-device limit
      if (currentSessionToken) {
        await deleteSession(currentSessionToken);
      }
      const newToken = await createSession(targetUser);
      const activeSessionCount = await countUserSessions(targetUser);

      const response = NextResponse.json({
        success: true,
        sessionToken: newToken, // Send new token so client can update localStorage
        activeSessions: activeSessionCount,
      });
      const isSecure2 = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
      response.cookies.set("wb_session", newToken, {
        httpOnly: true,
        secure: isSecure2,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years — sessions never expire
        path: "/",
      });
      return response;
    }

    // ---- LOGOUT ----
    if (validated.action === "logout") {
      const sessionToken = req.cookies.get("wb_session")?.value;
      if (sessionToken) {
        await deleteSession(sessionToken);
      }
      // Also try to delete session via header fallback (preview platforms)
      const headerToken = req.headers.get("x-session-token");
      if (headerToken) {
        await deleteSession(headerToken);
      }

      const response = NextResponse.json({ success: true });
      response.cookies.set("wb_session", "", {
        httpOnly: true,
        secure: req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}

// GET endpoint to verify session — returns user info without side effects
// Also accepts X-Session-Token header as fallback for preview platforms where cookies don't persist
export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    // Try cookie first, then header fallback
    let sessionToken = req.cookies.get("wb_session")?.value;
    if (!sessionToken) {
      sessionToken = req.headers.get("x-session-token") || undefined;
    }
    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }
    const username = await verifySession(sessionToken);
    if (!username) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({ authenticated: true, username });
  });
}
