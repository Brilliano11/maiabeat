"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BrutalCard } from "@/components/BrutalCard";
import { useAuthStore } from "@/store/authStore";

export default function ResetPreviewPage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    async function reset() {
      document.cookie = "maiabeat_preview=; path=/; max-age=0; samesite=lax";
      window.localStorage.removeItem("maiabeat-auth");
      window.localStorage.removeItem("maiabeat-player");
      await logout();
      router.replace("/login");
    }

    void reset();
  }, [logout, router]);

  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <BrutalCard className="bg-[#FFD600] text-center">
        <h1 className="page-title">Resetting Preview</h1>
        <p className="mt-2 font-bold">Opening the real login flow.</p>
      </BrutalCard>
    </AppShell>
  );
}

