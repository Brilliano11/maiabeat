"use client";

import type { Song } from "@/lib/types";

export type RecentSearchItem = {
  id: string;
  type: "track" | "artist" | "album" | "playlist" | "query";
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  spotifyUri?: string;
  route?: string;
  song?: Song;
  searchedAt: string;
};

const storageKey = "maiabeat-recent-searches";
const maxItems = 20;

function readRaw(): RecentSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(items: RecentSearchItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(items.slice(0, maxItems)));
  window.dispatchEvent(new CustomEvent("maiabeat:recent-searches-updated"));
}

export function getRecentSearches() {
  return readRaw()
    .filter((item) => item.id && item.type && item.title)
    .sort((a, b) => Date.parse(b.searchedAt) - Date.parse(a.searchedAt))
    .slice(0, maxItems);
}

export function saveRecentSearch(item: Omit<RecentSearchItem, "searchedAt">) {
  const nextItem: RecentSearchItem = {
    ...item,
    searchedAt: new Date().toISOString(),
  };
  const deduped = readRaw().filter(
    (entry) => !(entry.type === nextItem.type && entry.id === nextItem.id),
  );
  writeRaw([nextItem, ...deduped]);
}

export function removeRecentSearch(type: RecentSearchItem["type"], id: string) {
  writeRaw(readRaw().filter((item) => !(item.type === type && item.id === id)));
}

export function clearRecentSearches() {
  writeRaw([]);
}
