"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BrutalCard } from "@/components/BrutalCard";
import { useAuthStore } from "@/store/authStore";

export default function PreviewPage() {
  const router = useRouter();
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);

  useEffect(() => {
    document.cookie = "maiabeat_preview=1; path=/; max-age=86400; samesite=lax";
    continueAsGuest();
    window.setTimeout(() => router.replace("/home"), 400);
  }, [continueAsGuest, router]);

  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <BrutalCard className="bg-[#FFD600] text-center">
        <h1 className="page-title">Opening Maiabeat</h1>
        <p className="mt-2 font-bold">Local preview mode is loading.</p>
      </BrutalCard>
    </AppShell>
  );
}

