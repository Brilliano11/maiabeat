import { AppShell } from "@/components/AppShell";
import { BrutalCard } from "@/components/BrutalCard";

export default function OfflinePage() {
  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <BrutalCard className="bg-[#FFD600] text-center">
        <h1 className="page-title">Offline</h1>
        <p className="mt-2 font-bold">
          Maiabeat can cache the interface, but Spotify playback needs internet.
        </p>
      </BrutalCard>
    </AppShell>
  );
}

