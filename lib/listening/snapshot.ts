import type { ListeningSyncInput, Song } from "@/lib/types";

const maxSharedQueueLength = 100;
const previousTrackContext = 20;

type ListeningPlayerState = {
  currentSong: Song | null;
  queue: Array<{ song: Song }>;
  currentIndex: number;
  isPlaying: boolean;
  progressMs: number;
};

export function createListeningSnapshot(player: ListeningPlayerState): ListeningSyncInput {
  const songs = player.queue.map((item) => item.song);
  const requestedIndex = Number.isInteger(player.currentIndex) ? player.currentIndex : 0;
  const indexedSong = songs[requestedIndex];
  const sourceIndex = player.currentSong
    ? indexedSong?.spotifyTrackId === player.currentSong.spotifyTrackId
      ? requestedIndex
      : songs.findIndex(
          (song) => song.spotifyTrackId === player.currentSong?.spotifyTrackId,
        )
    : Math.max(0, Math.min(songs.length - 1, requestedIndex));
  const queueStart =
    songs.length > maxSharedQueueLength && sourceIndex >= 0
      ? Math.min(
          Math.max(0, sourceIndex - previousTrackContext),
          songs.length - maxSharedQueueLength,
        )
      : 0;
  let queue = songs.slice(queueStart, queueStart + maxSharedQueueLength);
  let currentIndex = sourceIndex >= 0 ? sourceIndex - queueStart : 0;

  if (
    player.currentSong &&
    (currentIndex < 0 ||
      currentIndex >= queue.length ||
      queue[currentIndex]?.spotifyTrackId !== player.currentSong.spotifyTrackId)
  ) {
    queue = [player.currentSong, ...queue].slice(0, maxSharedQueueLength);
    currentIndex = 0;
  }

  return {
    currentSong: player.currentSong,
    queue,
    currentIndex: Math.max(0, currentIndex),
    isPlaying: player.isPlaying,
    positionMs: player.progressMs,
  };
}
