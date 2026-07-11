import { dummySongs } from "@/data/dummySongs";
import type { Song } from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function shuffleSongs(songs: Song[]) {
  return [...songs].sort(() => Math.random() - 0.5);
}

export function searchLocalSongs(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return dummySongs;
  return dummySongs.filter((song) =>
    [song.title, song.artist, song.album, song.mood]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized)),
  );
}

export function notify(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("maiabeat:toast", { detail: message }));
  }
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
