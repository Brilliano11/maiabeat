import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { refreshSpotifyToken } from "@/lib/spotify/server";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export async function POST() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const token = await refreshSpotifyToken(guard.user.id);
    return NextResponse.json(
      { access_token: token.accessToken, expires_at: token.expiresAt },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Spotify token refresh failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Spotify refresh failed." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
