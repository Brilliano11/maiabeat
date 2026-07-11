import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { formatSpotifyPlaybackError, spotifyFetchForUser } from "@/lib/spotify/server";

export async function PUT(request: Request) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;

  const { device_id, spotifyUri, positionMs } = (await request.json()) as {
    device_id?: string;
    spotifyUri?: string;
    positionMs?: number;
  };

  if (!device_id || !spotifyUri) {
    return NextResponse.json({ error: "Device ID and Spotify URI required." }, { status: 400 });
  }

  try {
    await spotifyFetchForUser(
      guard.user.id,
      `/me/player/play?device_id=${encodeURIComponent(device_id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          uris: [spotifyUri],
          position_ms: positionMs ?? 0,
        }),
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatSpotifyPlaybackError(error, "Spotify play failed.") },
      { status: 400 },
    );
  }
}
