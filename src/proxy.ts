// ==================== WEILDBUILD PROXY — SECURITY GATE ====================
// This proxy runs on EVERY API request before it reaches the route handler.
// It provides an additional layer of security:
//
// 1. Blocks requests with suspicious patterns (path traversal, injection)
// 2. Enforces HTTPS in production
// 3. Adds security headers to ALL responses
// 4. Validates session existence for protected routes
//
// NOTE: The actual auth logic (requireAuth, requireSelfOrAdmin) is in the route
// handlers themselves. This proxy provides defense-in-depth, not replacement.
//
// Migrated from middleware.ts to proxy.ts for Next.js 16 compatibility.

import { NextRequest, NextResponse } from "next/server";

// Routes that don't require any authentication
const PUBLIC_ROUTES = [
  "/api/auth",        // Login, register (auth logic is internal)
  "/api",             // Health check
  "/api/data",        // Compatibility API for desktop app (auth handled in route)
  "/api/storage/download", // File downloads (public read)
  "/api/upload",      // File uploads (auth handled in route)
];

// Routes that allow unauthenticated GET but require auth for POST/PUT/DELETE
const READ_ONLY_PUBLIC_ROUTES = [
  "/api/items",       // Anyone can browse the shop
  "/api/games",       // Anyone can browse games
  "/api/users",       // Anyone can search users (paginated)
  "/api/data",        // Compatibility API GET requests are public
  "/api/storage/download", // File downloads are public
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

function isReadOnlyPublicRoute(pathname: string): boolean {
  return READ_ONLY_PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

// Security headers applied to ALL responses
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js needs unsafe-eval/inline
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' ws: wss: https://*.chatglm.site",  // Allow WebSocket + preview platform
    "frame-ancestors 'none'",
  ].join("; "),
};

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- BLOCK PATH TRAVERSAL ATTEMPTS ----
  if (pathname.includes("..") || pathname.includes("\\")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // ---- BLOCK EXTREMELY LONG PATHS ----
  if (pathname.length > 500) {
    return NextResponse.json({ error: "Path too long" }, { status: 400 });
  }

  // ---- HTTPS ENFORCEMENT ----
  // Disabled for local/desktop connections — the Python app connects over HTTP.
  // Only enforce HTTPS when running behind a reverse proxy that sets x-forwarded-proto.
  // To enable: set HTTPS_ENFORCE=true in your environment
  if (process.env.HTTPS_ENFORCE === "true") {
    const proto = req.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const httpsUrl = new URL(req.url);
      httpsUrl.protocol = "https";
      return NextResponse.redirect(httpsUrl);
    }
  }

  // ---- VALIDATE SESSION FOR PROTECTED WRITE OPERATIONS ----
  // For non-public routes doing POST/PUT/DELETE, check that a session cookie or header exists
  // (The actual session validation happens in the route handler via verifySession)
  // This is defense-in-depth — the route handlers always do their own auth check.
  const method = req.method;
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    const isPublic = isPublicRoute(pathname);
    const isReadOnlyPublic = isReadOnlyPublicRoute(pathname);
    // Require session existence for ALL write operations except on fully public routes
    if (!isPublic) {
      const sessionCookie = req.cookies.get("wb_session");
      const sessionHeader = req.headers.get("x-session-token");
      if (!sessionCookie && !sessionHeader) {
        return NextResponse.json(
          { error: "Authentication required. Please log in." },
          { status: 401 }
        );
      }
    }
  }

  // ---- CONTINUE REQUEST WITH SECURITY HEADERS ----
  const response = NextResponse.next();

  // Apply security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  // Run proxy on all API routes
  matcher: ["/api/:path*"],
};
