import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { getLibrarySnapshot } from "@/lib/library/server";
import { mapSpotifyPlaylist, mapSpotifyTrackToSong, spotifyFetchForUser } from "@/lib/spotify/server";
import type { QueueItem } from "@/lib/types";

function pagination(limit: number, offset: number, total: number) {
  const nextOffset = offset + limit < total ? offset + limit : null;
  return { limit, offset, total, nextOffset, hasMore: nextOffset !== null };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);
  const offset = Math.min(Math.max(Number(searchParams.get("offset")) || 0, 0), 1000);

  try {
    const snapshot = await getLibrarySnapshot(guard.user.id);
    const local = snapshot.playlists.find((playlist) => playlist.id === id);
    if (local) {
      const knownSongs = [
        ...snapshot.likedSongs,
        ...snapshot.recentlyPlayed,
        ...snapshot.queue
          .filter((item): item is QueueItem => Boolean(item))
          .map((item) => item.song),
      ];
      const songs = local.songIds
        .map((songId) => knownSongs.find((song) => song.id === songId || song.spotifyTrackId === songId))
        .filter(Boolean);
      const page = songs.slice(offset, offset + limit);
      return NextResponse.json({
        source: "maiabeat",
        playlist: local,
        tracks: page,
        pagination: pagination(limit, offset, songs.length),
      });
    }

    const data = await spotifyFetchForUser(
      guard.user.id,
      `/playlists/${encodeURIComponent(id)}?market=ID&fields=id,uri,name,description,images,owner.display_name,tracks.total,external_urls,tracks.items(track(id,uri,name,artists,album,duration_ms,explicit,popularity,external_urls,preview_url)),tracks.limit,tracks.offset,tracks.total&limit=${limit}&offset=${offset}`,
    );
    const tracks = (data?.tracks?.items ?? [])
      .map((item: { track?: Parameters<typeof mapSpotifyTrackToSong>[0] | null }) =>
        item.track ? mapSpotifyTrackToSong(item.track) : null,
      )
      .filter(Boolean);
    return NextResponse.json({
      source: "spotify",
      playlist: mapSpotifyPlaylist(data),
      tracks,
      pagination: pagination(data?.tracks?.limit ?? limit, data?.tracks?.offset ?? offset, data?.tracks?.total ?? 0),
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "PLAYLIST_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
