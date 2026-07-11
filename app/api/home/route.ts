import { NextResponse } from "next/server";
import { moodItems } from "@/lib/catalog";
import { requireUser } from "@/lib/auth/routeGuard";
import { getLibrarySnapshot } from "@/lib/library/server";
import {
  mapSpotifyAlbum,
  mapSpotifyArtist,
  mapSpotifyTrackToSong,
  searchSpotifyCatalogForUser,
  spotifyFetchForUser,
} from "@/lib/spotify/server";
import type { AlbumItem, ArtistItem, PlaylistItem, Song } from "@/lib/types";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function uniqueSongs(songs: Song[]) {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.spotifyTrackId)) return false;
    seen.add(song.spotifyTrackId);
    return true;
  });
}

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const snapshot = await getLibrarySnapshot(guard.user.id);
    const [recentResponse, topTrackResponse, topArtistResponse, releaseResponse, madeForUs] =
      await Promise.allSettled([
        spotifyFetchForUser(guard.user.id, "/me/player/recently-played?limit=10"),
        spotifyFetchForUser(guard.user.id, "/me/top/tracks?time_range=short_term&limit=10"),
        spotifyFetchForUser(guard.user.id, "/me/top/artists?time_range=medium_term&limit=10"),
        spotifyFetchForUser(guard.user.id, "/browse/new-releases?country=ID&limit=10"),
        searchSpotifyCatalogForUser(guard.user.id, "romantic chill indonesia", {
          type: "playlist",
          limit: 6,
        }),
      ]);

    const spotifyRecent =
      recentResponse.status === "fulfilled"
        ? ((recentResponse.value?.items ?? []) as Array<{ track?: Parameters<typeof mapSpotifyTrackToSong>[0] }>)
            .map((item) => (item.track ? mapSpotifyTrackToSong(item.track) : null))
            .filter((item): item is Song => Boolean(item))
        : [];
    const topTracks =
      topTrackResponse.status === "fulfilled"
        ? ((topTrackResponse.value?.items ?? []) as Parameters<typeof mapSpotifyTrackToSong>[0][]).map(
            mapSpotifyTrackToSong,
          )
        : [];
    const topArtists =
      topArtistResponse.status === "fulfilled"
        ? ((topArtistResponse.value?.items ?? []) as Parameters<typeof mapSpotifyArtist>[0][]).map(
            mapSpotifyArtist,
          )
        : [];
    const newReleases =
      releaseResponse.status === "fulfilled"
        ? ((releaseResponse.value?.albums?.items ?? []) as Parameters<typeof mapSpotifyAlbum>[0][]).map(
            mapSpotifyAlbum,
          )
        : [];
    const madeForUsItems: PlaylistItem[] =
      madeForUs.status === "fulfilled"
        ? madeForUs.value.playlists.items.map((playlist, index) => ({
            ...playlist,
            name:
              [
                "Maiabeat Mix 01",
                "Maiabeat Mix 02",
                "Our Night Mix",
                "Soft Hours",
                "Long Distance Mix",
                "Our Favorite Songs",
              ][index] ?? playlist.name,
          }))
        : [];

    const recentlyPlayed = uniqueSongs([...snapshot.recentlyPlayed, ...spotifyRecent]).slice(0, 12);
    const popularWithYou = uniqueSongs([
      ...snapshot.likedSongs,
      ...snapshot.recentlyPlayed,
      ...topTracks,
    ]).slice(0, 10);

    return NextResponse.json({
      greeting: greeting(),
      quickAccess: [
        { title: "Liked Songs", route: "/liked", color: "#FF3B6B" },
        { title: "Shared Playlist", route: "/playlists", color: "#FFD600" },
        { title: "Recently Played", route: "/library", color: "#00C2FF" },
        { title: "Queue", route: "/queue", color: "#29FF87" },
        { title: "Continue Listening", route: "/player", color: "#FF4D00" },
        { title: "Favorite Artist", route: "/explore", color: "#FFFFFF" },
      ],
      recentlyPlayed,
      madeForUs: madeForUsItems,
      topTracks,
      topArtists: topArtists as ArtistItem[],
      newReleases: newReleases as AlbumItem[],
      moods: moodItems,
      popularWithYou,
      likedSongs: snapshot.likedSongs.slice(0, 10),
      continueListening: recentlyPlayed[0] ?? snapshot.likedSongs[0] ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "HOME_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
