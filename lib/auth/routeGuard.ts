import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { PRIVATE_APP_MESSAGE } from "@/lib/auth/allowedUsers";

export async function requireAllowedUser() {
  const { user, allowed } = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Login required." }, { status: 401 }),
    };
  }

  if (!allowed) {
    return {
      user: null,
      response: NextResponse.json({ error: PRIVATE_APP_MESSAGE }, { status: 403 }),
    };
  }

  return { user, response: null };
}
