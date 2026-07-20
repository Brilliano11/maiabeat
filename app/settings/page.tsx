"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { notify } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";

export default function SettingsPage() {
  const router = useRouter();
  const clearRecentlyPlayed = useLibraryStore((state) => state.clearRecentlyPlayed);
  const clearAll = useLibraryStore((state) => state.clearAll);
  const theme = useLibraryStore((state) => state.theme);
  const toggleTheme = useLibraryStore((state) => state.toggleTheme);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header>
            <p className="page-kicker">Maiabeat</p>
            <h1 className="page-title">Settings</h1>
          </header>
          <div className="grid gap-4 lg:grid-cols-2">
          <BrutalCard className="grid gap-3 bg-[#FFD600]">
            <p className="text-sm font-black uppercase">Theme</p>
            <h2 className="section-title">{theme === "sunny" ? "Sunny Brutal" : "Night Brutal"}</h2>
            <BrutalButton tone="cyan" onClick={toggleTheme}>
              {theme === "sunny" ? "Switch to Night" : "Switch to Sunny"}
            </BrutalButton>
          </BrutalCard>
          <BrutalCard className="grid gap-3">
            <p className="text-sm font-black uppercase">Data</p>
            <BrutalButton
              tone="yellow"
              icon={<Trash2 size={17} />}
              onClick={() => {
                clearRecentlyPlayed();
                notify("Recently played cleared");
              }}
            >
              Clear Recent
            </BrutalButton>
            <BrutalButton
              tone="pink"
              icon={<Trash2 size={17} />}
              onClick={() => {
                clearAll();
                window.localStorage.removeItem("maiabeat-player");
                notify("Local cache cleared");
              }}
            >
              Clear Cache
            </BrutalButton>
          </BrutalCard>
          <BrutalCard className="bg-white">
            <p className="text-sm font-black uppercase">API Status</p>
            <p className="font-bold">Supabase + Spotify routes configured by environment.</p>
            <p className="mt-2 text-xs font-black">Version 0.1.0</p>
          </BrutalCard>
          </div>
          <BrutalButton tone="white" icon={<ArrowLeft size={17} />} onClick={() => router.push("/profile")}>
            Back
          </BrutalButton>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
