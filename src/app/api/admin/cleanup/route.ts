// ==================== ADMIN CLEANUP API ====================
// Manually trigger database cleanup. Requires admin authentication.
// GET  → returns a preview of what would be deleted (dry run)
// POST → actually runs the cleanup

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { runCleanup, trimUserNotificationArrays } from "@/lib/file-db";

export async function GET(req: NextRequest) {
  // Verify admin
  const authResult = await requireAdmin(req);
  if (typeof authResult !== "string") return authResult;

  // Dry run — just return the current cleanup status
  return NextResponse.json({
    message: "Use POST to run cleanup. This endpoint deletes old data from the database.",
    retentionPolicy: {
      readNotifications: "7 days",
      unreadNotifications: "30 days",
      dmMessages: "90 days",
      chatMessages: "90 days",
      rateLimits: "1 hour",
      expiredSessions: "immediately",
      transactionLogs: "90 days",
      userNotificationArray: "last 50 entries",
    },
  });
}

export async function POST(req: NextRequest) {
  // Verify admin
  const authResult = await requireAdmin(req);
  if (typeof authResult !== "string") return authResult;

  try {
    const result = await runCleanup();
    const trimmed = await trimUserNotificationArrays();

    return NextResponse.json({
      success: true,
      triggeredBy: authResult,
      result: {
        ...result,
        userArraysTrimmed: trimmed,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Cleanup failed: " + e.message },
      { status: 500 }
    );
  }
}
