import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { createPlaylistForUser } from "@/lib/library/server";

export async function POST(request: Request) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;

  try {
    const input = (await request.json()) as {
      name?: string;
      description?: string;
      visibility?: "private" | "shared";
    };
    if (!input.name?.trim()) {
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
