import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import { toggleLikedSong } from "@/lib/library/server";
import type { Song } from "@/lib/types";

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const body = await readJsonObject<{ song?: Song }>(request);
    const { song } = body ?? {};
    if (!song) return NextResponse.json({ error: "Song required." }, { status: 400 });
    const result = await toggleLikedSong(guard.user.id, song);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Like update failed." },
      { status: 400 },
    );
  }
}
