import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "./lib/auth";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3000/auth/callback",
  "http://localhost:8000",
];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("auth_token")?.value;

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/account");

  let isValidSession = false;
  if (token) {
    isValidSession = Boolean(await decrypt(token));
  }

  let response = NextResponse.next();

  if (!isValidSession && isProtectedRoute) {
    response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("auth_token");
  } else if (
    isValidSession &&
    (pathname === "/login" || pathname === "/")
  ) {
    response = NextResponse.redirect(new URL("/dashboard", request.url));
  } else if (token && !isValidSession) {
    // Do not keep an invalid cookie around and accidentally treat mere cookie
    // presence as authentication on a later route.
    response.cookies.delete("auth_token");
  }

  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.webp|.*\\.png|.*\\.svg).*)",
  ],
};
