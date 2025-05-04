import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// For Phase 1, we'll use a simplified middleware that just handles redirects
// We'll implement full token verification in later phases
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Root path redirects to login
  if (path === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect old auth/login path to new login path
  if (path === "/auth/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // For Phase 1, we'll allow all access to admin and driver routes
  // Client-side authentication will handle protection
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    "/",
    "/login",
    "/auth/login",
    "/admin/:path*",
    "/driver/:path*",
    "/api/:path*",
  ],
};
