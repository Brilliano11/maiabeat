import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const data = await spotifyFetchForUser(guard.user.id, "/me/player/devices");
    return NextResponse.json({ devices: data?.devices ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat memuat musik.", code: "SPOTIFY_DEVICES_UNAVAILABLE" },
      { status: 400 },
    );
  }
}
