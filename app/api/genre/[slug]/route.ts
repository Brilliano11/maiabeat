import { NextResponse } from "next/server";
import { moodBySlug, moodQuery } from "@/lib/catalog";
import { requireUser } from "@/lib/auth/routeGuard";
import { searchSpotifyCatalogForUser } from "@/lib/spotify/server";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { slug } = await context.params;
  const mood = moodBySlug(slug) ?? {
    slug,
    name: moodQuery(slug),
    description: "Pilihan musik berdasarkan genre dan mood.",
    color: "#FFD600",
  };
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 10);
  const offset = Math.min(Math.max(Number(searchParams.get("offset")) || 0, 0), 1000);

  try {
    const results = await searchSpotifyCatalogForUser(guard.user.id, moodQuery(mood.name), {
      type: "track,artist,album,playlist",
      limit,
      offset,
    });
    return NextResponse.json({
      genre: mood,
      tracks: results.tracks,
      artists: results.artists,
      albums: results.albums,
      playlists: results.playlists,
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "GENRE_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
