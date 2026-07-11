import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { removeQueueItemForUser } from "@/lib/library/server";

export async function DELETE(_request: Request, context: RouteContext<"/api/library/queue/[id]">) {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    await removeQueueItemForUser(guard.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Remove queue item failed." },
      { status: 400 },
    );
  }
}
