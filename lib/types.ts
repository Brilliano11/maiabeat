export type RepeatMode = "off" | "one" | "all";

export type Song = {
  id?: string;
  spotifyTrackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  artists?: { id: string; name: string }[];
  album?: string;
  coverUrl?: string | null;
  durationMs: number;
  explicit?: boolean;
  popularity?: number;
  externalUrl?: string;
  previewUrl?: string | null;
  mood?: string;
};

export type QueueItem = {
  id: string;
  song: Song;
  position: number;
};

export type PlayerSnapshot = {
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  progressMs: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
};

export type ArtistItem = {
  id: string;
  spotifyUri?: string;
  name: string;
  imageUrl?: string | null;
  followers?: number;
  genres?: string[];
  popularity?: number;
  externalUrl?: string;
};

export type AlbumItem = {
  id: string;
  spotifyUri?: string;
  title: string;
  artist: string;
  artists?: { id: string; name: string }[];
  coverUrl?: string | null;
  releaseDate?: string;
  totalTracks?: number;
  albumType?: string;
  externalUrl?: string;
};

export type PlaylistItem = {
  id: string;
  spotifyUri?: string;
  name: string;
  description?: string;
  coverUrl?: string | null;
  owner?: string;
  totalTracks?: number;
  route?: string;
  externalUrl?: string;
};

export type MoodItem = {
  slug: string;
  name: string;
  description: string;
  color: string;
};

export type SearchPagination = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number | null;
  hasMore: boolean;
};

export type SearchSection<T> = {
  items: T[];
  pagination: SearchPagination;
};

export type Playlist = {
  id: string;
  ownerId?: string;
  userId?: string;
  name: string;
  description?: string;
  coverUrl?: string | null;
  visibility?: "private" | "shared";
  songIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PlaylistUpdate = {
  name?: string;
  description?: string;
  coverUrl?: string | null;
  visibility?: "private" | "shared";
};

export type LyricLine = {
  timeMs: number | null;
  text: string;
};

export type LyricsResult = {
  found: boolean;
  instrumental: boolean;
  synced: boolean;
  lines: LyricLine[];
  source: "LRCLIB";
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
};

export type SpotifyProfile = {
  id: string;
  display_name?: string;
  email?: string;
  product?: string;
};
