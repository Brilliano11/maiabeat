import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  type SpotifySearchType,
  searchSpotifyCatalogForUser,
  searchSpotifyCatalogWithClientCredentials,
} from "@/lib/spotify/server";

function safeSearchType(type: string | null): SpotifySearchType {
  if (type === "all" || type === "All") return "track,artist,album,playlist";
  if (
    type === "track" ||
    type === "artist" ||
    type === "album" ||
    type === "playlist" ||
    type === "track,artist,album" ||
    type === "track,artist,album,playlist"
  ) {
    return type;
  }
  return "track,artist,album,playlist";
}

export async function GET(request: Request) {
  const guard = await requireUser({
    rateLimit: { namespace: "spotify-search", limit: 45, windowMs: 60_000 },
  });
  if (guard.response) return guard.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");
  const safeLimit = Math.min(Math.max(Number(rawLimit) || 10, 1), 10);
  const safeOffset = Math.min(Math.max(Number(rawOffset) || 0, 0), 1000);
  const type = safeSearchType(searchParams.get("type"));

  if (!query) {
    return NextResponse.json({
      songs: [],
      sections: {
        tracks: { items: [], pagination: { limit: safeLimit, offset: safeOffset, total: 0, nextOffset: null, hasMore: false } },
        artists: { items: [], pagination: { limit: safeLimit, offset: safeOffset, total: 0, nextOffset: null, hasMore: false } },
        albums: { items: [], pagination: { limit: safeLimit, offset: safeOffset, total: 0, nextOffset: null, hasMore: false } },
        playlists: { items: [], pagination: { limit: safeLimit, offset: safeOffset, total: 0, nextOffset: null, hasMore: false } },
      },
    });
  }

  try {
    const sections = await searchSpotifyCatalogForUser(guard.user.id, query, {
      type,
      limit: safeLimit,
      offset: safeOffset,
    });
    const songs = sections.tracks.items;
    return NextResponse.json({ songs, sections, source: "spotify" });
  } catch (error) {
    console.error("Spotify user search failed", {
      query,
      type,
      limit: safeLimit,
      offset: safeOffset,
      error: error instanceof Error ? error.message : error,
    });
    try {
      const sections = await searchSpotifyCatalogWithClientCredentials(query, {
        type,
        limit: safeLimit,
        offset: safeOffset,
      });
      const songs = sections.tracks.items;
      return NextResponse.json({
        songs,
        sections,
        source: "spotify",
      });
    } catch (fallbackError) {
      console.error("Spotify fallback search failed", {
        query,
        type,
        limit: safeLimit,
        offset: safeOffset,
        error: fallbackError instanceof Error ? fallbackError.message : fallbackError,
      });
      return NextResponse.json(
        {
          songs: [],
          sections: null,
          source: "spotify",
          error: "Pencarian sedang bermasalah.",
          code: "SPOTIFY_SEARCH_FAILED",
        },
        { status: 400 },
      );
    }
  }
}
