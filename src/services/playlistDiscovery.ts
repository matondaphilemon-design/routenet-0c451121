/**
 * Playlist Discovery — thin wrapper over the genre-based recommendation
 * engine (`genreDetector` + `playlistRanker`).
 *
 * Every call runs a fresh genre detection + Deezer playlist search and picks
 * a playlist the user has never played (tracked in localStorage), so the same
 * song never resolves to the same playlist twice.
 */
import type { Track } from "@/data/mockData";
import { recommendPlaylist } from "./playlistRanker";
import { detectGenre } from "./genreDetector";

export interface DiscoveredPlaylist {
  id: string;
  title: string;
  genre: string;
  source: "deezer";
  tracks: Track[];
}

export { detectGenre };

/** Pick and load a fresh, genre-matched playlist for a seed track. */
export async function discoverPlaylistForTrack(seed: Track, limit = 40): Promise<DiscoveredPlaylist | null> {
  if (!seed?.title && !seed?.artist) return null;
  const playlist = await recommendPlaylist(seed.title, seed.artist, limit);
  if (!playlist) return null;
  return {
    id: playlist.id,
    title: playlist.title,
    genre: playlist.genre,
    source: "deezer",
    tracks: playlist.tracks.filter((t) => t.id !== seed.id),
  };
}
