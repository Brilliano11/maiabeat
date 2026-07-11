import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { refreshSpotifyToken } from "@/lib/spotify/server";

export async function POST() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const token = await refreshSpotifyToken(guard.user.id);
    return NextResponse.json({ access_token: token.accessToken, expires_at: token.expiresAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Spotify refresh failed." },
      { status: 400 },
    );
  }
}
