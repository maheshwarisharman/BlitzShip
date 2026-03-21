import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/", "/login(.*)", "/signup(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // If the user is logged in, restrict access to the public-only routes
  if (userId) {
    if (
      req.nextUrl.pathname === "/" ||
      req.nextUrl.pathname.startsWith("/login") ||
      req.nextUrl.pathname.startsWith("/signup")
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Protect all non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
