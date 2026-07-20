"use client";

import { ArrowLeft, Moon, Sun, Trash2, Trees } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { notify } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";
import type { AppTheme } from "@/store/libraryStore";

const themeOptions: Array<{
  value: AppTheme;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "sunny", label: "Sunny", Icon: Sun },
  { value: "night", label: "Night", Icon: Moon },
  { value: "maria", label: "Maria Forest", Icon: Trees },
];

const mariaPalette = [
  ["Crimson", "#7B2E3A"],
  ["Wine", "#5E252F"],
  ["Outerspace", "#344B4E"],
  ["Dark Crimson", "#68000C"],
  ["Ivory", "#E8E1D2"],
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const clearRecentlyPlayed = useLibraryStore((state) => state.clearRecentlyPlayed);
  const clearAll = useLibraryStore((state) => state.clearAll);
  const theme = useLibraryStore((state) => state.theme);
  const setTheme = useLibraryStore((state) => state.setTheme);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header>
            <p className="page-kicker">Maiabeat</p>
            <h1 className="page-title">Settings</h1>
          </header>
          <div className="settings-grid">
          <BrutalCard className="theme-settings-panel grid gap-4 bg-[#FFD600]">
            <div>
              <p className="text-sm font-black uppercase">Appearance</p>
              <h2 className="section-title">Choose your theme</h2>
            </div>
            <div className="theme-segmented" role="radiogroup" aria-label="App theme">
              {themeOptions.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  className="theme-segmented-option"
                  data-active={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {theme === "maria" ? (
              <div className="theme-palette" aria-label="Maria Forest palette">
                {mariaPalette.map(([label, color]) => (
                  <div key={label} className="theme-swatch">
                    <span style={{ backgroundColor: color }} />
                    <small>{label}</small>
                  </div>
                ))}
              </div>
            ) : null}
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
