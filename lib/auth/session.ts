import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { user: null };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return { user: null };

  return { user: data.user };
}
