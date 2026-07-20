import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { getFreshSpotifyAccessToken } from "@/lib/spotify/server";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const token = await getFreshSpotifyAccessToken(guard.user.id);
    return NextResponse.json(
      {
        access_token: token.accessToken,
        expires_at: token.expiresAt,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Spotify access token request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Spotify token unavailable." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
