import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { mapSpotifyAlbum, mapSpotifyTrackToSong, spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const album = await spotifyFetchForUser(
      guard.user.id,
      `/albums/${encodeURIComponent(id)}?market=ID`,
    );
    const mappedAlbum = mapSpotifyAlbum(album);
    const tracks = (album?.tracks?.items ?? []).map((track: Parameters<typeof mapSpotifyTrackToSong>[0]) =>
      mapSpotifyTrackToSong({
        ...track,
        album: {
          name: mappedAlbum.title,
          images: mappedAlbum.coverUrl ? [{ url: mappedAlbum.coverUrl }] : [],
        },
      }),
    );
    return NextResponse.json({ album: mappedAlbum, tracks });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "ALBUM_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
