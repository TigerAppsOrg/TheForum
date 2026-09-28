import { NextResponse } from "next/server";
import { auth } from "~/auth";

// Next 16 "proxy" (formerly middleware). Always runs on the Node.js runtime,
// so no `runtime` segment config is allowed here.

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isAuthenticated = !!session?.user;
  const pathname = nextUrl.pathname;

  // Forward pathname header so server layouts can read the current route
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Public routes — always accessible. `/api/auth` covers Auth.js and the CAS
  // login/callback/logout routes; `/auth/error` is Auth.js' `pages.error`.
  // Privacy/Terms are readable without login; the OG/Twitter images must be
  // fetchable by link unfurlers.
  const publicRoutes = [
    "/",
    "/api/auth",
    "/auth/error",
    "/privacy",
    "/terms",
    "/opengraph-image",
    "/twitter-image",
  ];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPublicRoute) {
    if (isAuthenticated && pathname === "/") {
      return Response.redirect(new URL("/explore", nextUrl));
    }
    return next();
  }

  // Protected routes — require auth
  if (!isAuthenticated) {
    return Response.redirect(new URL("/", nextUrl));
  }

  // Onboarding guard
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isOnboarded = session.user.onboarded;

  if (!isOnboarded && !isOnboardingRoute) {
    return Response.redirect(new URL("/onboarding", nextUrl));
  }

  if (isOnboarded && isOnboardingRoute) {
    return Response.redirect(new URL("/explore", nextUrl));
  }

  return next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
