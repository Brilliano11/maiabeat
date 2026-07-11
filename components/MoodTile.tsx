"use client";

import Link from "next/link";

const colors = ["#FFD600", "#00C2FF", "#29FF87", "#FF3B6B", "#FF4D00"];

export function MoodTile({ mood, index }: { mood: string; index: number }) {
  const slug = mood.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-");
  return (
    <Link
      href={`/genre/${encodeURIComponent(slug)}`}
      className="grid min-h-24 min-w-0 place-items-center rounded-2xl border-[3px] border-black p-3 text-center text-lg font-black uppercase shadow-[5px_5px_0_#000]"
      style={{ background: colors[index % colors.length] }}
    >
      <span className="break-words">{mood}</span>
    </Link>
  );
}
