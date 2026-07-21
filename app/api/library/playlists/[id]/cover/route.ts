import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  getPlaylistCoverForUser,
  updatePlaylistForUser,
} from "@/lib/library/server";
import {
  removeStoredPlaylistCover,
  uploadPlaylistCover,
} from "@/lib/library/playlistCoverStorage";

export async function POST(
  request: Request,
  context: RouteContext<"/api/library/playlists/[id]/cover">,
) {
  const guard = await requireUser({
    rateLimit: { namespace: "playlist-cover", limit: 20, windowMs: 60 * 60_000 },
  });
  if (guard.response) return guard.response;
  const { id } = await context.params;

  let uploadedUrl: string | null = null;
  const owner = { playlistId: id, userId: guard.user.id };
  try {
    const previousCoverUrl = await getPlaylistCoverForUser(guard.user.id, id);
    const formData = await request.formData();
    const cover = formData.get("cover");
    if (!(cover instanceof File)) {
      return NextResponse.json({ error: "Cover image required." }, { status: 400 });
    }

    const uploaded = await uploadPlaylistCover(guard.user.id, id, cover);
    uploadedUrl = uploaded.publicUrl;
    const playlist = await updatePlaylistForUser(guard.user.id, id, {
      coverUrl: uploaded.publicUrl,
    });
    await removeStoredPlaylistCover(previousCoverUrl, owner).catch(() => undefined);
    return NextResponse.json({ playlist, coverUrl: uploaded.publicUrl });
  } catch (error) {
    if (uploadedUrl) {
      await removeStoredPlaylistCover(uploadedUrl, owner).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cover upload failed." },
      { status: 400 },
    );
  }
}
