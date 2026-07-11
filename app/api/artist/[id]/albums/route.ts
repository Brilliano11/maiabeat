import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { mapSpotifyAlbum, spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 50);
  const offset = Math.min(Math.max(Number(searchParams.get("offset")) || 0, 0), 1000);

  try {
    const data = await spotifyFetchForUser(
      guard.user.id,
      `/artists/${encodeURIComponent(id)}/albums?include_groups=album,single,appears_on&market=ID&limit=${limit}&offset=${offset}`,
    );
    return NextResponse.json({
      albums: (data?.items ?? []).map(mapSpotifyAlbum),
      pagination: {
        limit: data?.limit ?? limit,
        offset: data?.offset ?? offset,
        total: data?.total ?? 0,
        nextOffset:
          (data?.offset ?? offset) + (data?.limit ?? limit) < (data?.total ?? 0)
            ? (data?.offset ?? offset) + (data?.limit ?? limit)
            : null,
        hasMore: (data?.offset ?? offset) + (data?.limit ?? limit) < (data?.total ?? 0),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "ARTIST_ALBUMS_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
