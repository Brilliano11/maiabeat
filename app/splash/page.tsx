"use client";

import { useRouter } from "next/navigation";
import { Music2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { useAuthStore } from "@/store/authStore";

export default function SplashPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <section className="mx-auto grid w-full max-w-[720px] gap-5">
        <div className="rounded-[2rem] border-[3px] border-black bg-[#FF4D00] p-6 text-white shadow-[8px_8px_0_#000]">
          <div className="mb-16 flex items-center justify-between">
            <Music2 size={42} strokeWidth={3} />
            <Sparkles size={34} strokeWidth={3} />
          </div>
          <p className="text-sm font-black uppercase tracking-normal">Personal music gift</p>
          <h1 className="page-title mt-2">Maiabeat</h1>
          <p className="mt-4 section-title text-white">Play loud. Look louder.</p>
        </div>
        <BrutalCard className="grid gap-3 bg-[#FFD600]">
          <p className="text-sm font-black uppercase">
            Special gift for my biggest love
          </p>
          <BrutalButton
            tone="green"
            onClick={() => router.push(user ? "/home" : "/login")}
          >
            Start Listening
          </BrutalButton>
        </BrutalCard>
      </section>
    </AppShell>
  );
}
