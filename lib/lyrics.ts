import type { LyricLine } from "@/lib/types";

export function parseSyncedLyrics(value: string | null | undefined): LyricLine[] {
  if (!value) return [];
  const lines: LyricLine[] = [];

  value.split(/\r?\n/).forEach((rawLine) => {
    const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    const text = rawLine.replace(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g, "").trim();
    if (!timestamps.length || !text) return;

    timestamps.forEach((timestamp) => {
      const minutes = Number(timestamp[1]);
      const seconds = Number(timestamp[2]);
      lines.push({ timeMs: Math.round((minutes * 60 + seconds) * 1000), text });
    });
  });

  return lines.sort((left, right) => (left.timeMs ?? 0) - (right.timeMs ?? 0));
}

export function parsePlainLyrics(value: string | null | undefined): LyricLine[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ timeMs: null, text }));
}
