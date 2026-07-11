import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  mapSpotifyArtist,
  searchSpotifyCatalogForUser,
  spotifyFetchForUser,
} from "@/lib/spotify/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 10);
  const offset = Math.min(Math.max(Number(searchParams.get("offset")) || 0, 0), 1000);

  try {
    const artist = mapSpotifyArtist(
      await spotifyFetchForUser(guard.user.id, `/artists/${encodeURIComponent(id)}`),
    );
    const results = await searchSpotifyCatalogForUser(guard.user.id, `artist:${artist.name}`, {
      type: "track",
      limit,
      offset,
    });
    return NextResponse.json({
      artist,
      tracks: results.tracks.items,
      pagination: results.tracks.pagination,
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "ARTIST_TRACKS_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
