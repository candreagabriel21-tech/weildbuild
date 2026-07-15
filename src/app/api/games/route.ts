// ==================== GAMES API ROUTE — SECURE ====================
// ELIMINATED: "Soft session checks" — creating/updating games REQUIRES auth.
// Creator is ALWAYS determined from session, never from request body.
// Added: Zod validation, rate limiting, safe errors.

import { NextRequest, NextResponse } from "next/server";
import {
  getAllGames, getGame, createGameRecord, updateGameRecord, sanitizeString,
} from "@/lib/file-db";
import {
  safeApiHandler, requireAuth,
  validateBody, validateOrigin, requireRateLimit,
  createGameSchema, updateGameSchema,
} from "@/lib/security";
import { getUser } from "@/lib/file-db";

// GET games — public endpoint (game browsing)
export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const rateLimitError = await requireRateLimit(req, "general_api");
    if (rateLimitError) return rateLimitError;

    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const game = await getGame(id);
      if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
      return NextResponse.json(game);
    }
    const games = await getAllGames();
    return NextResponse.json(games);
  });
}

// POST — Create game. REQUIRES authentication.
export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin
    const originError = validateOrigin(req);
    if (originError) return originError;

    // Rate limit game creation
    const rateLimitError = await requireRateLimit(req, "create_game");
    if (rateLimitError) return rateLimitError;

    // REQUIRE authentication
    const sessionUser = await requireAuth(req);
    if (typeof sessionUser !== "string") return sessionUser;

    const body = await req.json();

    // Validate with Zod
    const validated = validateBody(createGameSchema, body);
    if (validated instanceof NextResponse) return validated;

    // CRITICAL: Creator is ALWAYS from the session, NEVER from request body
    // The server decides who created the game, not the client
    if (validated.name) validated.name = sanitizeString(validated.name, 50);
    if (validated.description) validated.description = sanitizeString(validated.description, 200);
    validated.creator = sessionUser;

    const game = await createGameRecord(validated);
    return NextResponse.json(game, { status: 201 });
  });
}

// PUT — Update game. REQUIRES authentication + ownership or admin.
export async function PUT(req: NextRequest) {
  return safeApiHandler(async () => {
    // Validate origin
    const originError = validateOrigin(req);
    if (originError) return originError;

    // Rate limit
    const rateLimitError = await requireRateLimit(req, "general_api");
    if (rateLimitError) return rateLimitError;

    // REQUIRE authentication
    const sessionUser = await requireAuth(req);
    if (typeof sessionUser !== "string") return sessionUser;

    const body = await req.json();

    // Validate with Zod
    const validated = validateBody(updateGameSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { id, ...updates } = validated;
    if (!id) return NextResponse.json({ error: "Game ID required" }, { status: 400 });

    // Verify the user is the creator or admin
    const existingGame = await getGame(id);
    if (!existingGame) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    if (existingGame.creator !== sessionUser) {
      // Check admin status
      const user = await getUser(sessionUser);
      if (!user || (user.admin_role !== "admin" && user.admin_role !== "top_admin")) {
        return NextResponse.json(
          { error: "You can only update your own games." },
          { status: 403 }
        );
      }
    }

    // Sanitize updates
    if (updates.name) updates.name = sanitizeString(updates.name, 50);
    if (updates.description) updates.description = sanitizeString(updates.description, 200);

    // Never allow changing the creator through an update
    delete updates.creator;

    const game = await updateGameRecord(id, updates);
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    return NextResponse.json(game);
  });
}
