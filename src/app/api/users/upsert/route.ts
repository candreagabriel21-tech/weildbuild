// ==================== USER UPSERT API ====================
// POST /api/users/upsert — Create or update a user
// Used by the WeildBuild desktop app (Python) for server sync
// Returns {"record": {...profileFormat}} for Python app compatibility

import { NextRequest, NextResponse } from "next/server";
import { getUser, saveUser } from "@/lib/file-db";
import { requireAuth } from "@/lib/security";

// Convert DB user format → Python app "Profile" format
function dbUserToProfile(row: any): any {
  return {
    id: row.username,
    username: row.username,
    email: row.email || "",
    // password_hash and salt removed from API response for security
    // These should never be exposed to clients
    description: row.description || "",
    webuy_balance: row.webuy || 0,
    avatar_data: row.avatar || {},
    is_admin: row.admin_role === "admin" || row.admin_role === "top_admin",
    is_banned: row.banned?.is_banned || false,
    ban_reason: row.banned?.reason || "",
    created_date: row.created || "",
    created_at: row.created || "",
    last_login: row.last_login || "",
    friends: row.friends || [],
    friend_requests: row.friend_requests || [],
    messages: row.messages || {},
    inventory: row.inventory || [],
    items_owned: row.items_owned || [],
    notifications: row.notifications || [],
    unread_messages: row.unread_messages || 0,
    blocked_users: row.blocked_users || [],
    user_id: row.user_id || 0,
    language: row.language || "en",
    profile_visible: row.profile_visible ?? true,
    // hash_version removed — don't reveal hashing algorithm to clients
  };
}

export async function POST(req: NextRequest) {
  try {
    // REQUIRE authentication — no unauthenticated user upserts
    const authResult = await requireAuth(req);
    if (typeof authResult !== "string") return authResult;

    const body = await req.json();
    const username = body.username;

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const existing = await getUser(username);

    if (existing) {
      // Update existing user — merge the incoming data
      // Map desktop app field names to our internal field names
      const updates: any = { ...existing };

      // Direct field mappings
      if (body.email !== undefined) updates.email = body.email;
      if (body.password_hash !== undefined) updates.password = body.password_hash;
      if (body.salt !== undefined) updates.salt = body.salt;
      if (body.description !== undefined) updates.description = body.description;
      if (body.webuy_balance !== undefined) updates.webuy = body.webuy_balance;
      if (body.is_banned !== undefined) updates.banned = { is_banned: body.is_banned, reason: body.ban_reason || "" };
      if (body.is_admin !== undefined) updates.admin_role = body.is_admin ? "admin" : "none";
      if (body.language !== undefined) updates.language = body.language;
      if (body.last_login !== undefined) updates.last_login = body.last_login;
      if (body.unread_messages !== undefined) updates.unread_messages = body.unread_messages;

      // JSON string fields from desktop app
      if (body.avatar_data !== undefined) {
        try { updates.avatar = typeof body.avatar_data === "string" ? JSON.parse(body.avatar_data) : body.avatar_data; } catch {}
      }
      if (body.friends !== undefined) {
        try { updates.friends = typeof body.friends === "string" ? JSON.parse(body.friends) : body.friends; } catch {}
      }
      if (body.friend_requests !== undefined) {
        try { updates.friend_requests = typeof body.friend_requests === "string" ? JSON.parse(body.friend_requests) : body.friend_requests; } catch {}
      }
      if (body.inventory !== undefined) {
        try { updates.inventory = typeof body.inventory === "string" ? JSON.parse(body.inventory) : body.inventory; } catch {}
      }
      if (body.items_owned !== undefined) {
        try { updates.items_owned = typeof body.items_owned === "string" ? JSON.parse(body.items_owned) : body.items_owned; } catch {}
      }
      if (body.notifications !== undefined) {
        try { updates.notifications = typeof body.notifications === "string" ? JSON.parse(body.notifications) : body.notifications; } catch {}
      }
      if (body.blocked_users !== undefined) {
        try { updates.blocked_users = typeof body.blocked_users === "string" ? JSON.parse(body.blocked_users) : body.blocked_users; } catch {}
      }
      if (body.messages !== undefined) {
        try { updates.messages = typeof body.messages === "string" ? JSON.parse(body.messages) : body.messages; } catch {}
      }

      // Preserve the user_id if provided
      if (body.user_id !== undefined) updates.user_id = body.user_id;

      await saveUser(username, updates);
      // Return in the format the Python desktop app expects: {"record": {...profileFormat}}
      return NextResponse.json({ record: dbUserToProfile(updates) });
    } else {
      // Create new user from desktop app data
      const newUser: any = {
        username,
        email: body.email || "",
        password: body.password_hash || "",
        salt: body.salt || "",
        description: body.description || "",
        webuy: body.webuy_balance || 0,
        avatar: (() => { try { return typeof body.avatar_data === "string" ? JSON.parse(body.avatar_data) : (body.avatar_data || {}); } catch { return {}; } })(),
        banned: { is_banned: body.is_banned || false, reason: body.ban_reason || "" },
        admin_role: body.is_admin ? "admin" : "none",
        items_owned: (() => { try { return typeof body.items_owned === "string" ? JSON.parse(body.items_owned) : (body.items_owned || []); } catch { return []; } })(),
        friends: (() => { try { return typeof body.friends === "string" ? JSON.parse(body.friends) : (body.friends || []); } catch { return []; } })(),
        friend_requests: (() => { try { return typeof body.friend_requests === "string" ? JSON.parse(body.friend_requests) : (body.friend_requests || []); } catch { return []; } })(),
        notifications: (() => { try { return typeof body.notifications === "string" ? JSON.parse(body.notifications) : (body.notifications || []); } catch { return []; } })(),
        blocked_users: (() => { try { return typeof body.blocked_users === "string" ? JSON.parse(body.blocked_users) : (body.blocked_users || []); } catch { return []; } })(),
        language: body.language || "en",
        created: new Date().toISOString(),
        last_login: body.last_login || new Date().toISOString(),
      };

      await saveUser(username, newUser);
      // Return in the format the Python desktop app expects: {"record": {...profileFormat}}
      return NextResponse.json({ record: dbUserToProfile(newUser) }, { status: 201 });
    }
  } catch (error: any) {
    console.error("[USERS UPSERT] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
