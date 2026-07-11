import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const state = await spotifyFetchForUser(guard.user.id, "/me/player");
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playback state unavailable." },
      { status: 400 },
    );
  }
}
