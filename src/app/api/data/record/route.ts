// ==================== SINGLE RECORD DATA API ====================
// GET/PUT/DELETE a single record by ID from any mapped table.
// No dynamic path segments — uses query parameters instead.
// Usage: /api/data/record?table=Profile&id=alice
//        /api/data/record?table=GameItem&id=FACE-01
//
// SECURITY: All endpoints require authentication. Write operations (PUT/DELETE)
// require admin role. Read operations (GET) require any authenticated user.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireAuth, requireAdmin } from "@/lib/security";
import { stripSensitiveFields } from "@/lib/file-db";

const TABLE_MAP: Record<string, string> = {
  Profile: "users",
  GameItem: "items",
  Game: "games",
  DirectMessage: "dms",
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

// Primary key column for each table
const PK_MAP: Record<string, string> = {
  users: "username",
  items: "id",
  games: "id",
  dms: "id",
  messages: "id",
  notifications: "id",
  sessions: "token",
  friendships: "id",
  inventory: "id",
  storage: "id",
  support_tickets: "id",
  moderation: "id",
  rate_limits: "identifier",
  transaction_logs: "id",
};

// GET /api/data/record?table=Profile&id=alice
export async function GET(req: NextRequest) {
  // Require authentication for all data access
  const authResult = await requireAuth(req);
  if (typeof authResult !== "string") return authResult;

  const url = new URL(req.url);
  const rawTable = url.searchParams.get("table");
  const id = url.searchParams.get("id");

  if (!rawTable || !id) {
    return NextResponse.json({ error: "Missing query params: table, id. Usage: /api/data/record?table=Profile&id=alice" }, { status: 400 });
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

  const pkCol = PK_MAP[tableName] || "id";

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq(pkCol, id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
      console.error(`[data/record] GET ${tableName}/${id} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Strip sensitive fields from user rows
    const safe = tableName === "users" ? stripSensitiveFields(data) : data;
    return NextResponse.json({ record: safe });
  } catch (err: any) {
    console.error(`[data/record] GET ${tableName}/${id} exception:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/data/record?table=Profile&id=alice  Body: { ...fields to update }
export async function PUT(req: NextRequest) {
  // Require admin for all write operations
  const adminResult = await requireAdmin(req);
  if (typeof adminResult !== "string") return adminResult;

  const url = new URL(req.url);
  const rawTable = url.searchParams.get("table");
  const id = url.searchParams.get("id");

  if (!rawTable || !id) {
    return NextResponse.json({ error: "Missing query params: table, id" }, { status: 400 });
  }

  const tableName = TABLE_MAP[rawTable];
  if (!tableName) {
    return NextResponse.json({ error: `Unknown table: ${rawTable}` }, { status: 404 });
  }

  // Block access to highly sensitive tables entirely
  if (BLOCKED_TABLES.has(tableName)) {
    return NextResponse.json({ error: "Access to this table is restricted" }, { status: 403 });
  }

  const pkCol = PK_MAP[tableName] || "id";

  try {
    const body = await req.json();

    const { data, error } = await supabase
      .from(tableName)
      .update(body)
      .eq(pkCol, id)
      .select()
      .single();

    if (error) {
      console.error(`[data/record] PUT ${tableName}/${id} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const safe = tableName === "users" ? stripSensitiveFields(data) : data;
    return NextResponse.json({ record: safe });
  } catch (err: any) {
    console.error(`[data/record] PUT ${tableName}/${id} exception:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/data/record?table=Profile&id=alice
export async function DELETE(req: NextRequest) {
  // Require admin for all write operations
  const adminResult = await requireAdmin(req);
  if (typeof adminResult !== "string") return adminResult;

  const url = new URL(req.url);
  const rawTable = url.searchParams.get("table");
  const id = url.searchParams.get("id");

  if (!rawTable || !id) {
    return NextResponse.json({ error: "Missing query params: table, id" }, { status: 400 });
  }

  const tableName = TABLE_MAP[rawTable];
  if (!tableName) {
    return NextResponse.json({ error: `Unknown table: ${rawTable}` }, { status: 404 });
  }

  // Block access to highly sensitive tables entirely
  if (BLOCKED_TABLES.has(tableName)) {
    return NextResponse.json({ error: "Access to this table is restricted" }, { status: 403 });
  }

  const pkCol = PK_MAP[tableName] || "id";

  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(pkCol, id);

    if (error) {
      console.error(`[data/record] DELETE ${tableName}/${id} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch (err: any) {
    console.error(`[data/record] DELETE ${tableName}/${id} exception:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
