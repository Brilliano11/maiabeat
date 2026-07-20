import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSpotifyAuthorizationUrl } from "@/lib/spotify/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTrustedAppOrigin } from "@/lib/security/appOrigin";
import { consumeRateLimit } from "@/lib/security/rateLimit";

export async function GET(request: Request) {
  let appUrl: string;
  try {
    appUrl = getTrustedAppOrigin(request);
  } catch {
    return NextResponse.json({ error: "Application URL is not configured." }, { status: 500 });
  }

  const { user } = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const rateLimit = consumeRateLimit(user.id, {
    namespace: "spotify-oauth-login",
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many Spotify connection attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

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
    return NextResponse.json({ error: "Spotify login unavailable." }, { status: 500 });
  }
}
