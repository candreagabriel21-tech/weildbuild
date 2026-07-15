// ==================== GENERIC DATA API (Python Desktop App Compatibility) ====================
// No dynamic path segments — uses query parameter ?table=Profile instead of /Profile
// Maps Python app table names to Supabase tables:
//   Profile → users, GameItem → items, Game → games, DirectMessage → dms
// Supports GET (list/search), POST (create), PUT (update by filter), DELETE (delete by filter)
//
// SECURITY: All endpoints require authentication. Write operations (POST/PUT/DELETE)
// require admin role. Read operations (GET) require any authenticated user.
//
// Usage: /api/data?table=Profile&username=alice
//        /api/data?table=GameItem&type=face

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAuth, requireAdmin } from "@/lib/security";
import { stripSensitiveFields } from "@/lib/file-db";

// Table name mapping: Python desktop app names → Supabase table names
const TABLE_MAP: Record<string, string> = {
  Profile: "users",
  GameItem: "items",
  Game: "games",
  DirectMessage: "dms",
  // Also accept the real table names directly
  users: "users",
  items: "items",
  games: "games",
  dms: "dms",
  messages: "messages",
  notifications: "notifications",
  sessions: "sessions",
  friendships: "friendships",
  inventory: "inventory",
  storage: "storage",
  support_tickets: "support_tickets",
  moderation: "moderation",
  rate_limits: "rate_limits",
  transaction_logs: "transaction_logs",
};

// Tables that contain highly sensitive data and should never be exposed via this API
const BLOCKED_TABLES = new Set([
  "sessions",
  "rate_limits",
  "transaction_logs",
  "moderation",
]);

// Tables that are safe for any authenticated user to read (public catalog data)
const PUBLIC_READ_TABLES = new Set([
  "items",
  "games",
]);

// Field mapping: Python app field names → Supabase column names
const FIELD_MAPS: Record<string, Record<string, string>> = {
  users: {
    user_id: "user_id",
    username: "username",
    password_hash: "password",
    avatar_json: "avatar",
    webuy_balance: "webuy",
    owned_items: "items_owned",
    friend_list: "friends",
    friend_requests: "friend_requests",
    is_banned: "banned",
    display_name: "username",
    created_at: "created",
    last_login_at: "last_login",
  },
  items: {
    item_id: "id",
    name: "display_name",
    type: "item_type",
    date_created: "date_created",
  },
  games: {
    game_id: "id",
    game_name: "name",
    last_updated: "last_update",
    created_at: "created",
  },
  dms: {
    message_id: "id",
    from: "from_user",
    to: "to_user",
    text: "content",
    sent_at: "timestamp",
  },
};

// Reverse field map: Supabase → Python app (for response translation)
function reverseMapField(table: string, supabaseField: string): string {
  const map = FIELD_MAPS[table];
  if (!map) return supabaseField;
  for (const [pyField, sbField] of Object.entries(map)) {
    if (sbField === supabaseField) return pyField;
  }
  return supabaseField;
}

// Translate row from Supabase columns to Python app field names
function translateRow(table: string, row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = reverseMapField(table, key);
    result[mappedKey] = value;
  }
  return result;
}

// Translate row from Python app field names to Supabase columns
function untranslateRow(table: string, row: Record<string, any>): Record<string, any> {
  const map = FIELD_MAPS[table];
  if (!map) return row;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[map[key] || key] = value;
  }
  return result;
}

// GET /api/data?table=Profile&username=alice
export async function GET(req: NextRequest) {
  // Require authentication for all data access
  const authResult = await requireAuth(req);
  if (typeof authResult !== "string") return authResult;
  const authedUser = authResult;

  const url = new URL(req.url);
  const rawTable = url.searchParams.get("table");

  if (!rawTable) {
    return NextResponse.json({ error: "Missing query param: table. Usage: /api/data?table=Profile" }, { status: 400 });
  }

  const tableName = TABLE_MAP[rawTable];
  if (!tableName) {
    return NextResponse.json({ error: `Unknown table: ${rawTable}` }, { status: 404 });
  }

  // Block access to highly sensitive tables entirely
  if (BLOCKED_TABLES.has(tableName)) {
    return NextResponse.json({ error: "Access to this table is restricted" }, { status: 403 });
  }

  // Non-public tables require admin access
  if (!PUBLIC_READ_TABLES.has(tableName)) {
    const adminResult = await requireAdmin(req);
    if (typeof adminResult !== "string") return adminResult;
  }

  try {
    let query = supabase.from(tableName).select("*");

    // Apply filters from query params (e.g., &username=alice&type=face)
    for (const [key, value] of url.searchParams.entries()) {
      if (key === "table" || key === "limit" || key === "offset") continue;
      const mappedKey = FIELD_MAPS[tableName]?.[key] || key;
      query = query.eq(mappedKey, value);
    }

    // Limit results
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    query = query.limit(Math.min(limit, 500));

    // Offset for pagination
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    if (offset > 0) query = query.range(offset, offset + limit - 1);

    // Order by created/created_at descending
    const orderCol = tableName === "games" ? "created" : tableName === "dms" ? "timestamp" : "created";
    query = query.order(orderCol, { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error(`[data API] GET ${tableName} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const translated = (data || []).map(row => {
      // Strip sensitive fields (passwords, salts) from user rows
      const safe = tableName === "users" ? stripSensitiveFields(row) : row;
      return translateRow(tableName, safe);
    });
    return NextResponse.json({ data: translated, count: translated.length });
  } catch (err: any) {
    console.error(`[data API] GET ${tableName} exception:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/data  Body: { table: "Profile", ...fields }
export async function POST(req: NextRequest) {
  // Require admin for all write operations
  const adminResult = await requireAdmin(req);
  if (typeof adminResult !== "string") return adminResult;

  try {
    const body = await req.json();
    const { table: rawTable, ...fields } = body;
    const tableName = TABLE_MAP[rawTable];

    if (!rawTable) {
      return NextResponse.json({ error: "Missing field: table" }, { status: 400 });
    }
    if (!tableName) {
      return NextResponse.json({ error: `Unknown table: ${rawTable}` }, { status: 404 });
    }

    const row = untranslateRow(tableName, fields);
    const { data, error } = await supabase.from(tableName).insert(row).select().single();

    if (error) {
      console.error(`[data API] POST ${tableName} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: translateRow(tableName, data) });
  } catch (err: any) {
    console.error("[data API] POST exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/data  Body: { table: "Profile", filter: {...}, updates: {...} }
export async function PUT(req: NextRequest) {
  // Require admin for all write operations
  const adminResult = await requireAdmin(req);
  if (typeof adminResult !== "string") return adminResult;

  try {
    const body = await req.json();
    const { table: rawTable, filter, updates } = body;
    const tableName = TABLE_MAP[rawTable];

    if (!rawTable) {
      return NextResponse.json({ error: "Missing field: table" }, { status: 400 });
    }
    if (!tableName) {
      return NextResponse.json({ error: `Unknown table: ${rawTable}` }, { status: 404 });
    }
    if (!filter || !updates) {
      return NextResponse.json({ error: "Body must include 'filter' and 'updates'" }, { status: 400 });
    }

    const mappedFilter = untranslateRow(tableName, filter);
    const mappedUpdates = untranslateRow(tableName, updates);

    let query = supabase.from(tableName).update(mappedUpdates);

    for (const [key, value] of Object.entries(mappedFilter)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error(`[data API] PUT ${tableName} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const translated = (data || []).map(row => translateRow(tableName, row));
    return NextResponse.json({ records: translated, count: translated.length });
  } catch (err: any) {
    console.error("[data API] PUT exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/data?table=Profile&username=alice
export async function DELETE(req: NextRequest) {
  // Require admin for all write operations
  const adminResult = await requireAdmin(req);
  if (typeof adminResult !== "string") return adminResult;

  const url = new URL(req.url);
  const rawTable = url.searchParams.get("table");

  if (!rawTable) {
    return NextResponse.json({ error: "Missing query param: table" }, { status: 400 });
  }

  const tableName = TABLE_MAP[rawTable];
  if (!tableName) {
    return NextResponse.json({ error: `Unknown table: ${rawTable}` }, { status: 404 });
  }

  // Block access to highly sensitive tables entirely
  if (BLOCKED_TABLES.has(tableName)) {
    return NextResponse.json({ error: "Access to this table is restricted" }, { status: 403 });
  }

  try {
    let query = supabase.from(tableName).delete();

    for (const [key, value] of url.searchParams.entries()) {
      if (key === "table" || key === "limit" || key === "offset") continue;
      const mappedKey = FIELD_MAPS[tableName]?.[key] || key;
      query = query.eq(mappedKey, value);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error(`[data API] DELETE ${tableName} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: data?.length || 0 });
  } catch (err: any) {
    console.error(`[data API] DELETE ${tableName} exception:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
