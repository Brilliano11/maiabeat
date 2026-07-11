import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { formatSpotifyPlaybackError, spotifyFetchForUser } from "@/lib/spotify/server";

export async function PUT(request: Request) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;

  const { positionMs } = (await request.json()) as { positionMs?: number };
  if (typeof positionMs !== "number") {
    return NextResponse.json({ error: "positionMs required." }, { status: 400 });
  }

  try {
    await spotifyFetchForUser(
      guard.user.id,
      `/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`,
      { method: "PUT" },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatSpotifyPlaybackError(error, "Spotify seek failed.") },
      { status: 400 },
    );
  }
}
