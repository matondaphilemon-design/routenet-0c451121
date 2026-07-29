// Types + formatting utilities only. All mock data has been removed —
// content is fetched live from Deezer + the AI recommendation engine.

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number; // seconds
  youtubeId?: string;
  preview?: string; // Deezer preview URL
  streams?: number;
  releaseDate?: string;
}

export interface Playlist {
  id: string;
  name: string;
  artwork: string;
  trackCount: number;
  description?: string;
}

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  monthlyListeners: number;
}

// Empty exports kept for backwards-compat with any lingering imports.
// Do NOT reintroduce hardcoded content here.
export const mockTracks: Track[] = [];
export const mockPlaylists: Playlist[] = [];
export const mockArtists: Artist[] = [];

export const genres = [
  { id: "132", name: "Pop" },
  { id: "116", name: "Hip-Hop" },
  { id: "152", name: "Rock" },
  { id: "106", name: "Electronic" },
  { id: "129", name: "Jazz" },
  { id: "98", name: "Classical" },
  { id: "165", name: "R&B" },
  { id: "144", name: "Reggae" },
];

export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};
