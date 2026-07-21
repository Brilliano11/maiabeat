"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types";

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  setHydrated: (hydrated: boolean) => void;
  isLoggedIn: () => boolean;
  continueAsGuest: () => void;
  restoreSession: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (displayName: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      hydrated: false,
      error: null,
      setHydrated: (hydrated) => set({ hydrated }),
      isLoggedIn: () => Boolean(get().user),
      continueAsGuest: () => {
        const host = typeof window === "undefined" ? "" : window.location.hostname;
        const isLocalHost = host === "127.0.0.1" || host === "localhost";
        if (process.env.NODE_ENV === "production" && !isLocalHost) {
          set({
            error: "Guest mode is disabled. Login or create an account.",
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
          },
        });
      },
      restoreSession: async () => {
        if (!isSupabaseConfigured()) return false;
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase!.auth.getUser();
        if (error || !data.user?.email) return false;

        set({
          user: {
            id: data.user.id,
            email: data.user.email,
            displayName:
              (data.user.user_metadata?.display_name as string | undefined) ??
              data.user.email.split("@")[0],
          },
          error: null,
        });
        return true;
      },
      login: async (email, password) => {
        set({ loading: true, error: null });

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
          },
        });
        return true;
      },
      register: async (displayName, email, password) => {
        set({ loading: true, error: null });

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
          },
        });
        return true;
      },
      logout: async () => {
        const listeningStore = (await import("@/store/listeningStore"))
          .useListeningStore.getState();
        try {
          if (listeningStore.activeRoomId && get().user?.id !== "local-preview") {
            await listeningStore.leaveRoom();
          }
        } finally {
          listeningStore.clearRoom();
        }

        const supabase = createSupabaseBrowserClient();
        if (supabase) await supabase.auth.signOut();
        set({ user: null, error: null, loading: false });
      },
    }),
    {
      name: "maiabeat-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
