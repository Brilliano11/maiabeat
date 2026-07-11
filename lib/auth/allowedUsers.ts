import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const FALLBACK_ALLOWED_EMAILS = [
  "anggitaramo@gmail.com",
  "ISI_EMAIL_ORANG_YANG_KAMU_KENAL_DI_SINI",
];

export const PRIVATE_APP_MESSAGE =
  "Maiabeat is invite-only. Ask the owner for access.";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isEmailAllowed(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return FALLBACK_ALLOWED_EMAILS.map(normalizeEmail).includes(normalized);
  }

  const { data, error } = await admin
    .from("allowed_users")
    .select("email")
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    return FALLBACK_ALLOWED_EMAILS.map(normalizeEmail).includes(normalized);
  }

  return Boolean(data);
}
