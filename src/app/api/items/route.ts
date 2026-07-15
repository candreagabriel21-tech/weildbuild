// ==================== ITEMS API ROUTE — SECURE ====================
// ELIMINATED: "Soft session checks" — buying items now REQUIRES authentication.
// Added: Transaction logging, Zod validation, rate limiting, safe errors.

import { NextRequest, NextResponse } from "next/server";
import {
  getAllItems, getItemsByType, getItem, getUser, saveUser,
  stripSensitiveFields,
} from "@/lib/file-db";
import {
  safeApiHandler, requireAuth, validateBody, validateOrigin,
  requireRateLimit, buyItemSchema, logTransaction,
} from "@/lib/security";

// GET items — public endpoint (catalog browsing)
export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const rateLimitError = await requireRateLimit(req, "general_api");
    if (rateLimitError) return rateLimitError;

    const type = req.nextUrl.searchParams.get("type");
    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const item = await getItem(id);
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      return NextResponse.json(item);
    }

    const items = type ? await getItemsByType(type) : await getAllItems();
    return NextResponse.json(items);
  });
}

// POST — Buy item. REQUIRES authentication.
// The server is the SOLE AUTHORITY on WeBuy balances.
export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin
    const originError = validateOrigin(req);
    if (originError) return originError;

    // Rate limit purchases
    const rateLimitError = await requireRateLimit(req, "buy_item");
    if (rateLimitError) return rateLimitError;

    // REQUIRE authentication
    const sessionUser = await requireAuth(req);
    if (typeof sessionUser !== "string") return sessionUser;

    const body = await req.json();

    // Validate with Zod
    const validated = validateBody(buyItemSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { username, itemId } = validated;

    // CRITICAL: User can only buy items for THEMSELVES
    // The server determines who is buying from the session, not from the request body
    if (username !== sessionUser) {
      return NextResponse.json(
        { error: "You can only buy items for yourself." },
        { status: 403 }
      );
    }

    const user = await getUser(username);
    const item = await getItem(itemId);
    if (!user || !item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if ((user.items_owned || []).includes(itemId)) {
      return NextResponse.json({ error: "Already owned" }, { status: 400 });
    }

    if ((user.webuy || 0) < (item.price || 0)) {
      return NextResponse.json({ error: "Not enough WeBuy" }, { status: 400 });
    }

    // Server-authoritative balance deduction
    const balanceBefore = user.webuy || 0;
    user.webuy = balanceBefore - (item.price || 0);
    user.items_owned = [...(user.items_owned || []), itemId];
    await saveUser(username, user);

    // LOG the transaction for audit trail
    if (item.price > 0) {
      await logTransaction({
        type: "purchase",
        username,
        itemId,
        amount: item.price,
        balanceBefore,
        balanceAfter: user.webuy,
        description: `Purchased ${item.display_name || itemId}`,
        performedBy: sessionUser,
      });
    }

    return NextResponse.json({ success: true, user: stripSensitiveFields(user) });
  });
}
