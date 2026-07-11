"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types";

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  privateMessage: string;
  isLoggedIn: () => boolean;
  continueAsGuest: () => void;
  restoreSession: () => Promise<boolean>;
  checkAllowedEmail: (email: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (displayName: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const privateMessage = "Maiabeat is invite-only. Ask the owner for access.";

async function allowedByServer(email: string) {
  const response = await fetch(`/api/auth/allowed?email=${encodeURIComponent(email)}`);
  const data = (await response.json()) as { allowed?: boolean };
  return Boolean(data.allowed);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      error: null,
      privateMessage,
      isLoggedIn: () => Boolean(get().user),
      continueAsGuest: () => {
        if (process.env.NODE_ENV === "production") {
          set({
            error: "Guest mode is disabled. Login with an invited email.",
            user: null,
          });
          return;
        }

        set({
          error: null,
          user: {
            id: "local-preview",
            email: "preview@maiabeat.local",
            displayName: "Anggita",
            isAllowed: true,
          },
        });
      },
      restoreSession: async () => {
        if (!isSupabaseConfigured()) return false;
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase!.auth.getUser();
        if (error || !data.user?.email) return false;

        const allowed = await get().checkAllowedEmail(data.user.email);
        set({
          user: {
            id: data.user.id,
            email: data.user.email,
            displayName:
              (data.user.user_metadata?.display_name as string | undefined) ??
              data.user.email.split("@")[0],
            isAllowed: allowed,
          },
          error: allowed ? null : privateMessage,
        });
        return allowed;
      },
      checkAllowedEmail: async (email) => {
        try {
          return await allowedByServer(email);
        } catch {
          return false;
        }
      },
      login: async (email, password) => {
        set({ loading: true, error: null });

        const allowed = await get().checkAllowedEmail(email);
        if (!allowed) {
          set({ loading: false, error: privateMessage, user: null });
          return false;
        }

        if (!isSupabaseConfigured()) {
          set({
            loading: false,
            error: "Supabase env is required for login.",
            user: null,
          });
          return false;
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase!.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          set({ loading: false, error: error?.message ?? "Login failed." });
          return false;
        }

        set({
          loading: false,
          user: {
            id: data.user.id,
            email: data.user.email ?? email,
            displayName:
              (data.user.user_metadata?.display_name as string | undefined) ??
              email.split("@")[0],
            isAllowed: true,
          },
        });
        return true;
      },
      register: async (displayName, email, password) => {
        set({ loading: true, error: null });

        const allowed = await get().checkAllowedEmail(email);
        if (!allowed) {
          set({ loading: false, error: privateMessage, user: null });
          return false;
        }

        if (!isSupabaseConfigured()) {
          set({
            loading: false,
            error: "Supabase env is required for register.",
            user: null,
          });
          return false;
        }

        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase!.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });

        if (error || !data.user) {
          set({ loading: false, error: error?.message ?? "Register failed." });
          return false;
        }

        set({
          loading: false,
          user: {
            id: data.user.id,
            email: data.user.email ?? email,
            displayName,
            isAllowed: true,
          },
        });
        return true;
      },
      logout: async () => {
        const supabase = createSupabaseBrowserClient();
        if (supabase) await supabase.auth.signOut();
        set({ user: null, error: null, loading: false });
      },
    }),
    { name: "maiabeat-auth" },
  ),
);
