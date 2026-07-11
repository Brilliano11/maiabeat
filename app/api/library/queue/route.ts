import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { addQueueItemForUser, clearQueueForUser } from "@/lib/library/server";
import type { Song } from "@/lib/types";

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const { song } = (await request.json()) as { song?: Song };
    if (!song) return NextResponse.json({ error: "Song required." }, { status: 400 });
    const item = await addQueueItemForUser(guard.user.id, song);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Add to queue failed." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    await clearQueueForUser(guard.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clear queue failed." },
      { status: 400 },
    );
  }
}
