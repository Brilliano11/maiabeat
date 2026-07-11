"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { useAuthStore } from "@/store/authStore";

export default function PrivatePage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const message = useAuthStore((state) => state.privateMessage);

  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <BrutalCard className="grid gap-4 bg-[#FFD600] text-center">
        <Lock className="mx-auto" size={42} strokeWidth={3} />
        <h1 className="page-title">Invite-only</h1>
        <p className="font-bold">{message}</p>
        <BrutalButton
          tone="pink"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
        >
          Logout
        </BrutalButton>
      </BrutalCard>
    </AppShell>
  );
}

