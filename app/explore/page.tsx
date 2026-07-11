"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalCard } from "@/components/BrutalCard";
import { MoodTile } from "@/components/MoodTile";
import { moodItems } from "@/lib/catalog";

const sections = [
  "Made for Maia & Anggita",
  "Recently Played",
  "Your Top Tracks",
  "Your Top Artists",
  "New Releases",
  "Mood and Genre",
  "Indonesian Hits",
  "Romantic",
  "Chill",
  "Sad",
  "Workout",
  "Focus",
  "Rock",
  "Pop",
  "Alternative",
  "J-Pop",
  "K-Pop",
  "Lo-Fi",
  "Night Drive",
  "Discover More",
];

export default function ExplorePage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header>
            <p className="page-kicker">Browse moods</p>
            <h1 className="page-title">Explore</h1>
          </header>

          <section className="grid gap-3">
            <h2 className="section-title">Mood and Genre</h2>
            <div className="mood-grid">
              {moodItems.map((mood, index) => (
                <MoodTile key={mood.slug} mood={mood.name} index={index} />
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Discovery</h2>
            <div className="playlist-grid">
              {sections.map((section, index) => (
                <Link key={section} href={`/search?q=${encodeURIComponent(section)}`}>
                  <BrutalCard
                    className="grid min-h-28 place-items-center text-center"
                    style={{ backgroundColor: moodItems[index % moodItems.length]?.color ?? "#FFFFFF" }}
                  >
                    <p className="card-title">{section}</p>
                  </BrutalCard>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
