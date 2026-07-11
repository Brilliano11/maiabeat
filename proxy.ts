import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set([
  "/",
  "/splash",
  "/login",
  "/register",
  "/private",
  "/preview",
  "/reset-preview",
  "/offline",
]);

const appPaths = [
  "/home",
  "/search",
  "/player",
  "/queue",
  "/library",
  "/liked",
  "/playlists",
  "/explore",
  "/profile",
  "/settings",
];

function hasSupabaseSession(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.has(pathname)) return NextResponse.next();

  const isAppPath = appPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!isAppPath) return NextResponse.next();

  if (
    process.env.NODE_ENV !== "production" &&
    request.cookies.get("maiabeat_preview")?.value === "1"
  ) {
    return NextResponse.next();
  }

  if (!hasSupabaseSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)"],
};
