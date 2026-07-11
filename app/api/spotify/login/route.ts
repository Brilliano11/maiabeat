import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSpotifyAuthorizationUrl } from "@/lib/spotify/server";
import { getCurrentUser } from "@/lib/auth/session";
import { PRIVATE_APP_MESSAGE } from "@/lib/auth/allowedUsers";

function getAppUrl(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return requestOrigin;

  try {
    const configured = new URL(configuredUrl);
    if (configured.hostname === "localhost" || configured.hostname === "127.0.0.1") {
      return requestOrigin;
    }
    return configured.origin;
  } catch {
    return requestOrigin;
  }
}

export async function GET(request: Request) {
  const appUrl = getAppUrl(request);
  const { user, allowed } = await getCurrentUser();

  if (!user) return NextResponse.redirect(new URL("/login", appUrl));
  if (!allowed) return NextResponse.redirect(new URL("/private", appUrl));

  try {
    const state = randomBytes(24).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("maiabeat_spotify_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    });

    return NextResponse.redirect(getSpotifyAuthorizationUrl(state));
  } catch {
    return NextResponse.json({ error: PRIVATE_APP_MESSAGE }, { status: 500 });
  }
}
