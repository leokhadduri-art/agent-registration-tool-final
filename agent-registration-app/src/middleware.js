import { NextResponse } from "next/server";

export function middleware(request) {
  // Allow the auth API endpoint through
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get("agent_reg_auth");
  if (authCookie?.value === "authenticated") {
    return NextResponse.next();
  }

  // Redirect to login page if not on login page already
  if (request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
