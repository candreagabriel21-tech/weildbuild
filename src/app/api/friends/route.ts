// ==================== FRIENDS API ROUTE — SECURE ====================
// ELIMINATED: "Soft session checks" — ALL friend actions REQUIRES authentication.
// Added: Zod validation, rate limiting, origin validation, safe errors.
// The server determines identity from session, NEVER from request body alone.

import { NextRequest, NextResponse } from "next/server";
import {
  getUser, saveUser, searchUsers,
  sendFriendRequest, acceptFriendRequest,
  declineFriendRequest, removeFriend, cancelFriendRequest,
  saveDMMessage, getDMMessages, stripSensitiveFields, sanitizeString,
} from "@/lib/file-db";
import {
  safeApiHandler, requireAuth, validateBody, validateOrigin, requireRateLimit,
  friendActionSchema,
} from "@/lib/security";

// GET — Read friend data. REQUIRES authentication for own data.
export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const rateLimitError = await requireRateLimit(req, "general_api");
    if (rateLimitError) return rateLimitError;

    const username = req.nextUrl.searchParams.get("username");
    const searchQuery = req.nextUrl.searchParams.get("search");
    const action = req.nextUrl.searchParams.get("action");
    const user1 = req.nextUrl.searchParams.get("user1");
    const user2 = req.nextUrl.searchParams.get("user2");

    // Get DM messages — REQUIRES authentication
    if (action === "get_messages" && user1 && user2) {
      const sessionUser = await requireAuth(req);
      if (typeof sessionUser !== "string") return sessionUser;

      // Only allow reading your own messages
      if (sessionUser !== user1 && sessionUser !== user2) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

      const messages = await getDMMessages(user1, user2);
      return NextResponse.json(messages);
    }

    // Search users — public
    if (searchQuery) {
      const results = await searchUsers(searchQuery);
      return NextResponse.json(results);
    }

    // Get friend list — REQUIRES authentication
    if (username) {
      const sessionUser = await requireAuth(req);
      if (typeof sessionUser !== "string") return sessionUser;

      // Only allow reading your own friend data
      if (sessionUser !== username) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }

      const user = await getUser(username);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const safe = stripSensitiveFields(user);
      return NextResponse.json({
        friends: safe.friends || [],
        friend_requests: safe.friend_requests || [],
      });
    }

    return NextResponse.json({ error: "Username or search required" }, { status: 400 });
  });
}

// POST — ALL friend actions. REQUIRES authentication.
export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin
    const originError = validateOrigin(req);
    if (originError) return originError;

    // REQUIRE authentication — NO SOFT CHECKS
    const sessionUser = await requireAuth(req);
    if (typeof sessionUser !== "string") return sessionUser;

    const body = await req.json();

    // Validate with Zod
    const validated = validateBody(friendActionSchema, body);
    if (validated instanceof NextResponse) return validated;

    switch (validated.action) {
      case "request": {
        // CRITICAL: "from" MUST match the session user
        if (validated.from !== sessionUser) {
          return NextResponse.json(
            { error: "You can only send requests as yourself." },
            { status: 403 }
          );
        }
        const rateLimitError = await requireRateLimit(req, "general_api", sessionUser);
        if (rateLimitError) return rateLimitError;

        const result = await sendFriendRequest(validated.from, validated.to);
        if (result.error) return NextResponse.json(result, { status: 400 });
        return NextResponse.json({ success: true });
      }

      case "cancel": {
        if (validated.from !== sessionUser) {
          return NextResponse.json(
            { error: "You can only cancel your own requests." },
            { status: 403 }
          );
        }
        const result = await cancelFriendRequest(validated.from, validated.to);
        if (result.error) return NextResponse.json(result, { status: 400 });
        return NextResponse.json({ success: true });
      }

      case "accept": {
        if (validated.username !== sessionUser) {
          return NextResponse.json(
            { error: "You can only accept your own friend requests." },
            { status: 403 }
          );
        }
        const result = await acceptFriendRequest(validated.username, validated.friend);
        if (result.error) return NextResponse.json(result, { status: 400 });
        const user = await getUser(validated.username);
        return NextResponse.json({ success: true, user: stripSensitiveFields(user) });
      }

      case "decline": {
        if (validated.username !== sessionUser) {
          return NextResponse.json(
            { error: "You can only decline your own friend requests." },
            { status: 403 }
          );
        }
        const result = await declineFriendRequest(validated.username, validated.friend);
        if (result.error) return NextResponse.json(result, { status: 400 });
        const user = await getUser(validated.username);
        return NextResponse.json({ success: true, user: stripSensitiveFields(user) });
      }

      case "remove": {
        if (validated.username !== sessionUser) {
          return NextResponse.json(
            { error: "You can only remove your own friends." },
            { status: 403 }
          );
        }
        const result = await removeFriend(validated.username, validated.friend);
        if (result.error) return NextResponse.json(result, { status: 400 });
        const user = await getUser(validated.username);
        return NextResponse.json({ success: true, user: stripSensitiveFields(user) });
      }

      case "block": {
        if (validated.username !== sessionUser) {
          return NextResponse.json(
            { error: "You can only block users for yourself." },
            { status: 403 }
          );
        }
        const user = await getUser(validated.username);
        const targetUser = await getUser(validated.target);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
        if (!user.blocked_users) user.blocked_users = [];
        if (!user.blocked_users.includes(validated.target)) user.blocked_users.push(validated.target);
        user.friends = (user.friends || []).filter((f: string) => f !== validated.target);
        user.friend_requests = (user.friend_requests || []).filter((f: string) => f !== validated.target);
        await saveUser(validated.username, user);
        if (targetUser) {
          targetUser.friends = (targetUser.friends || []).filter((f: string) => f !== validated.username);
          targetUser.friend_requests = (targetUser.friend_requests || []).filter((f: string) => f !== validated.username);
          await saveUser(validated.target, targetUser);
        }
        return NextResponse.json({ success: true, user: stripSensitiveFields(user) });
      }

      case "unblock": {
        if (validated.username !== sessionUser) {
          return NextResponse.json(
            { error: "You can only unblock users for yourself." },
            { status: 403 }
          );
        }
        const user = await getUser(validated.username);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
        user.blocked_users = (user.blocked_users || []).filter((f: string) => f !== validated.target);
        await saveUser(validated.username, user);
        return NextResponse.json({ success: true, user: stripSensitiveFields(user) });
      }

      case "send_message": {
        if (validated.from !== sessionUser) {
          return NextResponse.json(
            { error: "You can only send messages as yourself." },
            { status: 403 }
          );
        }
        // Rate limit messages
        const rateLimitError = await requireRateLimit(req, "send_message", sessionUser);
        if (rateLimitError) return rateLimitError;

        // Check if the recipient has blocked the sender
        const recipient = await getUser(validated.to);
        if (recipient && (recipient.blocked_users || []).includes(validated.from)) {
          return NextResponse.json(
            { error: "Cannot send message to this user." },
            { status: 403 }
          );
        }

        const sanitizedContent = sanitizeString(validated.content, 1000);
        const message = await saveDMMessage(validated.from, validated.to, sanitizedContent);
        return NextResponse.json({ success: true, message });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  });
}
