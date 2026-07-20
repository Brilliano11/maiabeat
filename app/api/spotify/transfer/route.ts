import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import { formatSpotifyPlaybackError, spotifyFetchForUser } from "@/lib/spotify/server";

export async function PUT(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const body = await readJsonObject<{ device_id?: string }>(request);
  const { device_id } = body ?? {};
  if (!device_id) return NextResponse.json({ error: "Device ID required." }, { status: 400 });

  try {
    await spotifyFetchForUser(guard.user.id, "/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [device_id], play: false }),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatSpotifyPlaybackError(error, "Transfer playback failed.") },
      { status: 400 },
    );
  }
}
