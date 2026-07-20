import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import { createPlaylistForUser } from "@/lib/library/server";

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const input = await readJsonObject<{
      name?: string;
      description?: string;
      visibility?: "private" | "shared";
    }>(request);
    if (!input?.name?.trim()) {
      return NextResponse.json({ error: "Playlist name required." }, { status: 400 });
    }
    const playlist = await createPlaylistForUser(guard.user.id, {
      name: input.name.trim(),
      description: input.description,
      visibility: input.visibility,
    });
    return NextResponse.json({ playlist });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist create failed." },
      { status: 400 },
    );
  }
}
