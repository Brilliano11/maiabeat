import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { formatSpotifyPlaybackError, spotifyFetchForUser } from "@/lib/spotify/server";

export async function POST() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    await spotifyFetchForUser(guard.user.id, "/me/player/next", { method: "POST" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatSpotifyPlaybackError(error, "Spotify next failed.") },
      { status: 400 },
    );
  }
}
