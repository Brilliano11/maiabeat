import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/routeGuard";
import { getLibrarySnapshot } from "@/lib/library/server";

export async function GET() {
  const guard = await requireAllowedUser();
  if (guard.response) return guard.response;

  try {
    const snapshot = await getLibrarySnapshot(guard.user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Library unavailable." },
      { status: 400 },
    );
  }
}
