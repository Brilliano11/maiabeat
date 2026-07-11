import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { deletePlaylistForUser, renamePlaylistForUser } from "@/lib/library/server";

export async function PATCH(request: Request, context: RouteContext<"/api/library/playlists/[id]">) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const { name } = (await request.json()) as { name?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Playlist name required." }, { status: 400 });
    }
    const playlist = await renamePlaylistForUser(guard.user.id, id, name.trim());
    return NextResponse.json({ playlist });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist rename failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/library/playlists/[id]">) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    await deletePlaylistForUser(guard.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist delete failed." },
      { status: 400 },
    );
  }
}
