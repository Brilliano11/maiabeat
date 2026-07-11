import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { mapSpotifyArtist, spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const artist = await spotifyFetchForUser(guard.user.id, `/artists/${encodeURIComponent(id)}`);
    return NextResponse.json({ artist: mapSpotifyArtist(artist) });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "ARTIST_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
