// ==================== NOTIFICATIONS API ROUTE — SECURE ====================
// ELIMINATED: "Soft session checks" — ALL notification actions REQUIRES authentication.
// Users can only read/manage their own notifications.
// Added: Zod validation, rate limiting, safe errors.

import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications, markNotificationsRead, createNotification,
} from "@/lib/file-db";
import {
  safeApiHandler, requireAuth, validateBody, validateOrigin, requireRateLimit,
  notificationActionSchema,
} from "@/lib/security";
import { getUser } from "@/lib/file-db";

// GET — Read notifications. REQUIRES authentication.
export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const rateLimitError = await requireRateLimit(req, "general_api");
    if (rateLimitError) return rateLimitError;

    const username = req.nextUrl.searchParams.get("username");
    if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

    // REQUIRE authentication — users can only read their own notifications
    const sessionUser = await requireAuth(req);
    if (typeof sessionUser !== "string") return sessionUser;

    if (sessionUser !== username) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const notifications = await getNotifications(username);
    return NextResponse.json(notifications);
  });
}

// POST — Notification actions. REQUIRES authentication.
export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin
    const originError = validateOrigin(req);
    if (originError) return originError;

    // REQUIRE authentication
    const sessionUser = await requireAuth(req);
    if (typeof sessionUser !== "string") return sessionUser;

    const body = await req.json();

    // Validate with Zod
    const validated = validateBody(notificationActionSchema, body);
    if (validated instanceof NextResponse) return validated;

    if (validated.action === "markRead") {
      // Can only mark your own notifications as read
      if (sessionUser !== validated.username) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

      await markNotificationsRead(validated.username);
      return NextResponse.json({ success: true });
    }

    if (validated.action === "create") {
      // System notifications should only be created by the server internally.
      // For now, only allow users to create notifications for themselves
      // (e.g., testing). Admins can create for anyone.
      const requester = await getUser(sessionUser);
      const isAdmin = requester?.admin_role === "admin" || requester?.admin_role === "top_admin";

      if (!isAdmin && sessionUser !== validated.username) {
        return NextResponse.json(
          { error: "You can only create notifications for yourself." },
          { status: 403 }
        );
      }

      const notification = await createNotification(validated.username, validated.type, validated.message, validated.from);
      return NextResponse.json(notification, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
