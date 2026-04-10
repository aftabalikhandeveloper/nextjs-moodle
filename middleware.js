import { NextResponse } from "next/server";
import { decrypt } from "./lib/auth";

export async function middleware(request) {
  const session = request.cookies.get("session")?.value;
  const path = request.nextUrl.pathname;

  // 1. Allow public assets and login page
  if (path === "/login" || path.startsWith("/api/auth") || path.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // 2. Check for session
  const payload = session ? await decrypt(session) : null;

  if (!payload) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/quizzes/:path*",
    "/api/subjects/:path*",
    "/api/schedule-quiz/:path*",
    "/api/user-info/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
