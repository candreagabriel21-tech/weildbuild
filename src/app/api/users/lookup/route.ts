// ==================== USER LOOKUP API ====================
// GET /api/users/lookup?username=... — Look up a user by username
// Used by the WeildBuild desktop app (Python) for login and profile lookup
// Returns {"found": true, "user": {...}} format for Python app compatibility
//
// SECURITY: Requires authentication. Response is trimmed based on who is asking:
// - Self: full profile (minus password/salt)
// - Others: public profile only (username, avatar, display info)
// - Admin: full profile

import { NextRequest, NextResponse } from "next/server";
import { getUser, stripSensitiveFields } from "@/lib/file-db";
import { requireAuth, requireAdmin } from "@/lib/security";

// Convert DB user format → safe public profile (visible to any authenticated user)
function dbUserToPublicProfile(row: any): any {
  return {
    id: row.username,
    username: row.username,
    description: row.description || "",
    avatar_data: row.avatar || {},
    is_admin: row.admin_role === "admin" || row.admin_role === "top_admin",
    is_banned: row.banned?.is_banned || false,
    created_date: row.created || "",
    created_at: row.created || "",
    last_login: row.last_login || "",
    profile_visible: row.profile_visible ?? true,
    language: row.language || "en",
  };
}

// Convert DB user format → full profile for self or admin (Python app "Profile" format)
function dbUserToFullProfile(row: any): any {
  const safe = stripSensitiveFields(row);
  return {
    id: safe.username,
    username: safe.username,
    email: safe.email || "",
    description: safe.description || "",
    webuy_balance: safe.webuy || 0,
    avatar_data: safe.avatar || {},
    is_admin: safe.admin_role === "admin" || safe.admin_role === "top_admin",
    is_banned: safe.banned?.is_banned || false,
    ban_reason: safe.banned?.reason || "",
    created_date: safe.created || "",
    created_at: safe.created || "",
    last_login: safe.last_login || "",
    friends: safe.friends || [],
    friend_requests: safe.friend_requests || [],
    messages: safe.messages || {},
    inventory: safe.inventory || [],
    items_owned: safe.items_owned || [],
    notifications: safe.notifications || [],
    unread_messages: safe.unread_messages || 0,
    blocked_users: safe.blocked_users || [],
    user_id: safe.user_id || 0,
    language: safe.language || "en",
    profile_visible: safe.profile_visible ?? true,
  };
}

export async function GET(req: NextRequest) {
  // Require authentication — no anonymous lookups
  const authResult = await requireAuth(req);
  if (typeof authResult !== "string") return authResult;
  const authedUser = authResult;

  try {
    const username = req.nextUrl.searchParams.get("username");

    if (!username) {
      return NextResponse.json({ found: false, error: "Username parameter required" }, { status: 400 });
    }

    const user = await getUser(username);

    if (!user) {
      return NextResponse.json({ found: false });
    }

    // Determine access level: self or admin gets full profile, others get public only
    const isAdmin = (user: any) => user && (user.admin_role === "admin" || user.admin_role === "top_admin");
    const authedUserData = await getUser(authedUser);
    const isSelf = authedUser === username;
    const isAuthedAdmin = isAdmin(authedUserData);

    if (isSelf || isAuthedAdmin) {
      // Full profile for self or admin
      return NextResponse.json({ found: true, user: dbUserToFullProfile(user) });
    }

    // Public profile only for other users
    return NextResponse.json({ found: true, user: dbUserToPublicProfile(user) });
  } catch (error: any) {
    console.error("[USERS LOOKUP] Error:", error);
    return NextResponse.json({ found: false, error: error.message }, { status: 500 });
  }
}
