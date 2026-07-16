// ==================== USERS API ROUTE — SECURE ====================
// ELIMINATED: "Soft session checks" that let unauthenticated users bypass auth.
// NOW: requireAuth() / requireSelfOrAdmin() on ALL mutating endpoints.
// Added: Zod validation, rate limiting, safe errors, pagination.

import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsers, getUser, getUserByKey, saveUser, searchUsers,
  stripSensitiveFields, filterUserUpdates,
} from "@/lib/file-db";
import {
  safeApiHandler, requireAuth, requireSelfOrAdmin,
  validateBody, validateOrigin, requireRateLimit,
  updateUserSchema,
} from "@/lib/security";

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const username = req.nextUrl.searchParams.get("username");
    const userKey = req.nextUrl.searchParams.get("key");
    const searchQuery = req.nextUrl.searchParams.get("search");

    // Search users — public endpoint, rate limited
    if (searchQuery) {
      const rateLimitError = await requireRateLimit(req, "general_api");
      if (rateLimitError) return rateLimitError;

      const results = await searchUsers(searchQuery);
      return NextResponse.json(results);
    }

    // ─── KEY-PROTOCOL: Look up user by Object Key (USER-1, USER-2, etc.) ───
    if (userKey) {
      const rateLimitError = await requireRateLimit(req, "general_api");
      if (rateLimitError) return rateLimitError;

      const user = await getUserByKey(userKey);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json(stripSensitiveFields(user));
    }

    // Get specific user — public profile, rate limited
    if (username) {
      const rateLimitError = await requireRateLimit(req, "general_api");
      if (rateLimitError) return rateLimitError;

      const user = await getUser(username);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json(stripSensitiveFields(user));
    }

    // List all users — REQUIRE authentication + pagination
    // No more dumping the entire user database to anyone who asks
    const authResult = await requireAuth(req);
    if (typeof authResult !== "string") return authResult;

    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 100);
    const offset = (page - 1) * limit;

    const allUsers = (await getAllUsers()).map((u: any) => stripSensitiveFields(u));
    const paginated = allUsers.slice(offset, offset + limit);

    return NextResponse.json({
      users: paginated,
      total: allUsers.length,
      page,
      limit,
      hasMore: offset + limit < allUsers.length,
    });
  });
}

export async function PUT(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin
    const originError = validateOrigin(req);
    if (originError) return originError;

    // Rate limit
    const rateLimitError = await requireRateLimit(req, "update_user");
    if (rateLimitError) return rateLimitError;

    // REQUIRE authentication — NO MORE SOFT CHECKS
    const body = await req.json();

    // Validate with Zod
    const validated = validateBody(updateUserSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { username } = validated;

    // REQUIRE: user must be authenticated as themselves or admin
    const authResult = await requireSelfOrAdmin(req, username);
    if (typeof authResult !== "string") return authResult;

    const user = await getUser(username);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check if requester is admin for admin-only fields
    const requester = await getUser(authResult);
    const isAdmin = requester?.admin_role === "admin" || requester?.admin_role === "top_admin";

    // Filter updates — only allow specific fields
    const filteredUpdates = filterUserUpdates(body, isAdmin);

    const updated = { ...user, ...filteredUpdates };
    await saveUser(username, updated);
    return NextResponse.json(stripSensitiveFields(updated));
  });
}
