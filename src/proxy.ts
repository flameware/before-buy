import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "session_id";

/**
 * Ensures every request carries an anonymous session id (httpOnly cookie)
 * before it reaches Server Components — cookies() can only *read* there,
 * so the id has to already exist by the time render starts.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const sessionId = crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  const forwardedCookie = requestHeaders.get("cookie");
  requestHeaders.set(
    "cookie",
    forwardedCookie
      ? `${forwardedCookie}; ${SESSION_COOKIE}=${sessionId}`
      : `${SESSION_COOKIE}=${sessionId}`
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
