import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth/allowedUsers";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { user: null, allowed: false };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return { user: null, allowed: false };

  const allowed = await isEmailAllowed(data.user.email);
  return { user: data.user, allowed };
}
