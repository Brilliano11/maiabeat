import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import {
  mapSpotifyArtist,
  mapSpotifyTrackToSong,
  spotifyFetchForUser,
} from "@/lib/spotify/server";

function timeRange(value: string | null) {
  if (value === "short_term" || value === "medium_term" || value === "long_term") return value;
  return "medium_term";
}

export async function GET(request: Request) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "artists" ? "artists" : "tracks";
  const range = timeRange(searchParams.get("time_range"));
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 50);

  try {
    const data = await spotifyFetchForUser(
      guard.user.id,
      `/me/top/${type}?time_range=${range}&limit=${limit}`,
    );
    return NextResponse.json({
      type,
      items:
        type === "artists"
          ? (data?.items ?? []).map(mapSpotifyArtist)
          : (data?.items ?? []).map(mapSpotifyTrackToSong),
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "SPOTIFY_TOP_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
