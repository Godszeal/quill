import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "./lib/auth";

const PUBLIC_PATHS = ["/auth/signin", "/auth/signup", "/api/auth"];
const API_PREFIX = "/api/";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = getSessionCookie();
  if (!token) {
    if (pathname.startsWith(API_PREFIX)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const signinUrl = new URL("/auth/signin", req.url);
    signinUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.gif$|.*\\.ico$|.*\\.webp$).*)"],
};
