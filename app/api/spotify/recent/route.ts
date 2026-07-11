import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { mapSpotifyTrackToSong, spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const data = await spotifyFetchForUser(guard.user.id, "/me/player/recently-played?limit=20");
    return NextResponse.json({
      tracks: (data?.items ?? [])
        .map((item: { track?: Parameters<typeof mapSpotifyTrackToSong>[0] | null }) =>
          item.track ? mapSpotifyTrackToSong(item.track) : null,
        )
        .filter(Boolean),
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "SPOTIFY_RECENT_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
