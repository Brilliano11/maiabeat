import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { spotifyFetchForUser } from "@/lib/spotify/server";

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const profile = await spotifyFetchForUser(guard.user.id, "/me");
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Spotify profile unavailable." },
      { status: 400 },
    );
  }
}
