"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    if (!hydrated) return;
    if (user) return;
    let cancelled = false;
    restoreSession().then((restored) => {
      if (!restored && !cancelled) router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, restoreSession, router, user]);

  if (!hydrated || !user) return null;
  return <>{children}</>;
}
