import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function requireUser() {
  const { user } = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Login required." }, { status: 401 }),
    };
  }

  return { user, response: null };
}
