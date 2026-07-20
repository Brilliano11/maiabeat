"use client";

import Link from "next/link";
import {
  BedDouble,
  CloudRain,
  Dumbbell,
  Flame,
  Focus,
  Guitar,
  Heart,
  Headphones,
  Leaf,
  MoonStar,
  Music2,
  Radio,
  Sparkles,
} from "lucide-react";

const colors = ["#FFD600", "#00C2FF", "#29FF87", "#FF3B6B", "#FF4D00"];

const moodIcons = {
  chill: Leaf,
  workout: Dumbbell,
  focus: Focus,
  "night-drive": MoonStar,
  sad: CloudRain,
  romantic: Heart,
  rock: Guitar,
  pop: Sparkles,
  alternative: Radio,
  "indo-hits": Music2,
  "j-pop": Music2,
  "k-pop": Music2,
  "lo-fi": Headphones,
  sleep: BedDouble,
  acoustic: Guitar,
} as const;

export function MoodTile({ mood, index }: { mood: string; index: number }) {
  const slug = mood.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-");
  const Icon = moodIcons[slug as keyof typeof moodIcons] ?? Flame;
  return (
    <Link
      href={`/genre/${encodeURIComponent(slug)}`}
      data-tone={index % colors.length}
      className="mood-tile grid min-h-24 min-w-0 place-items-center rounded-2xl border-[3px] border-black p-3 text-center text-lg font-black uppercase shadow-[5px_5px_0_#000]"
      style={{ background: colors[index % colors.length] }}
    >
      <span className="grid place-items-center gap-2">
        <Icon className="mood-tile-icon" size={22} aria-hidden="true" />
        <span className="break-words">{mood}</span>
      </span>
    </Link>
  );
}
