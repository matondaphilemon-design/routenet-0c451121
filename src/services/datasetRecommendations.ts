/**
 * Recommendation + resolution layer on top of the offline playlist dataset.
 *
 * - Playlist co-occurrence: tracks that repeatedly appear alongside a seed
 *   track (or a followed artist) score higher.
 * - Artist → playlist mapping powers "fans also listen to" style rows.
 * - `resolveDatasetTracks` turns dataset entries (artist + title strings) into
 *   real playable Tracks through Deezer, so dataset rows behave like any other
 *   row in the app. If Deezer is unavailable the un-resolved entries are
 *   returned as placeholder tracks so the UI still renders offline.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/data/mockData";
import { transformTrack } from "@/services/deezer";
import { cached } from "@/services/homeCache";
import {
  ensurePlaylistData,
  getPlaylistsForArtist,
  type DatasetTrack,
  type DatasetPlaylist,
} from "@/services/playlistData";

const TTL_RESOLVE = 24 * 60 * 60 * 1000;

async function dz(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("deezer", { body: { action, params } });
  if (error) throw error;
  return data;
}

function placeholder(t: DatasetTrack): Track {
  return {
    id: `ds-${t.id}`,
    title: t.track,
    artist: t.artist,
    album: "",
    artwork: "",
    duration: 0,
  };
}

/** Resolves dataset entries to playable Deezer tracks (bounded + cached). */
export async function resolveDatasetTracks(entries: DatasetTrack[], limit = 12): Promise<Track[]> {
  const slice = entries.slice(0, limit);
  const results = await Promise.all(
    slice.map(async (entry) => {
      const key = `ds:resolve:${entry.artist}|${entry.track}`.toLowerCase();
      try {
        return await cached<Track | null>(key, TTL_RESOLVE, async () => {
          const d = await dz("searchTrack", { query: `${entry.artist} ${entry.track}`, limit: 1 });
          const hit = d?.data?.[0];
          return hit ? transformTrack(hit) : null;
        });
      } catch {
        return null;
      }
    }),
  );
  const resolved = results.filter(Boolean) as Track[];
  if (resolved.length) return resolved;
  return slice.map(placeholder);
}

/** Dataset tracks for a whole playlist, resolved for playback. */
export async function resolveDatasetPlaylist(playlist: DatasetPlaylist, limit = 15): Promise<Track[]> {
  return resolveDatasetTracks(playlist.tracks, limit);
}

/** Genre/taste based recommendations straight out of the dataset. */
export async function getRecommendationsFromPlaylistData(
  userGenres: string[],
  limit = 20,
): Promise<DatasetTrack[]> {
  const { playlists } = await ensurePlaylistData();
  const out: DatasetTrack[] = [];
  const seen = new Set<string>();

  const matching = playlists.filter((pl) =>
    userGenres.some((g) => `${pl.title} ${pl.category}`.toLowerCase().includes(g.toLowerCase())),
  );

  const push = (t: DatasetTrack) => {
    const key = `${t.artist}|${t.track}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  for (const pl of matching.slice(0, 12)) {
    for (const t of pl.tracks) {
      push(t);
      if (out.length >= limit) return out;
    }
  }
  // Fall back to the biggest (most representative) playlists.
  for (const pl of playlists) {
    for (const t of pl.tracks) {
      push(t);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Co-occurrence recommendations: find playlists that contain the seed track,
 * then rank their other tracks by how often they co-occur with it.
 */
export async function getRecommendationsFromSeed(
  seedTrack: string,
  seedArtist: string,
  limit = 20,
): Promise<DatasetTrack[]> {
  const { playlists } = await ensurePlaylistData();
  const st = seedTrack.toLowerCase();
  const sa = seedArtist.toLowerCase();

  const matching = playlists.filter((pl) =>
    pl.tracks.some((t) => t.track.toLowerCase().includes(st) && t.artist.toLowerCase().includes(sa)),
  );

  const scores = new Map<string, { track: DatasetTrack; score: number }>();
  for (const pl of matching) {
    const weight = 1 / Math.log2(pl.tracks.length + 4);
    for (const t of pl.tracks) {
      const key = `${t.artist}|${t.track}`.toLowerCase();
      if (key === `${sa}|${st}`) continue;
      const prev = scores.get(key);
      if (prev) prev.score += weight;
      else scores.set(key, { track: t, score: weight + (t.artist.toLowerCase() === sa ? 0.4 : 0) });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.track);
}

/** "Fans of X also listen to" — artists co-occurring with a followed artist. */
export async function getRelatedArtistsFromDataset(artist: string, limit = 15): Promise<string[]> {
  const playlists = await getPlaylistsForArtist(artist, 25);
  const counts = new Map<string, { name: string; n: number }>();
  const target = artist.toLowerCase();
  for (const pl of playlists) {
    for (const t of pl.tracks) {
      const key = t.artist.toLowerCase();
      if (key === target) continue;
      const prev = counts.get(key);
      if (prev) prev.n += 1;
      else counts.set(key, { name: t.artist, n: 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((c) => c.name);
}

/** Tracks by artists that co-occur with the user's followed artists. */
export async function getDatasetTracksForArtists(
  artists: string[],
  limit = 20,
): Promise<DatasetTrack[]> {
  const out: DatasetTrack[] = [];
  const seen = new Set<string>();
  for (const artist of artists.slice(0, 5)) {
    const playlists = await getPlaylistsForArtist(artist, 6);
    for (const pl of playlists) {
      for (const t of pl.tracks) {
        const key = `${t.artist}|${t.track}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(t);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
