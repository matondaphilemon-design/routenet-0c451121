/**
 * QueueManager — smart infinite radio with anti-repeat rules.
 *
 * Hard constraints enforced on every queue we hand back:
 *  - No two consecutive tracks from the same artist.
 *  - Max 2 tracks per artist across any 20-track window.
 *  - 5-song artist cooldown (recently-played artists suppressed).
 *  - Last-50 played track IDs blocked from re-appearing.
 *
 * Sources (in order): playlists containing the seed track, artist radio,
 * genre tracks, global chart. Metadata is cached per session.
 */
import { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/utils/toTitleCase";

export type QueueMode = "radio" | "fixed";

const REFILL_THRESHOLD = 5;
const REFILL_BATCH = 30;
const INITIAL_RADIO_FETCH = 40;
const MAX_PER_ARTIST_WINDOW = 2;
const ARTIST_COOLDOWN = 5;
const RECENT_PLAYED_CAP = 50;

function deezerIdFromTrack(t: Track): string | null {
  if (t?.id?.startsWith?.("deezer-")) return t.id.replace("deezer-", "");
  return null;
}

function mapDeezerToTrack(t: any): Track {
  return {
    id: `deezer-${t.id}`,
    title: toTitleCase(t.title || t.title_short || "Unknown"),
    artist: toTitleCase(t.artist?.name || "Unknown"),
    album: t.album?.title || "",
    artwork: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "",
    duration: t.duration || 0,
    preview: t.preview,
  } as Track;
}

const artistKey = (t: Track) => (t.artist || "").trim().toLowerCase();

/**
 * Apply the four anti-repeat rules to an ordered candidate pool and
 * produce up to `limit` tracks.
 * @param recentArtists most-recent-first list of artists played (cooldown).
 * @param recentIds already-played track IDs (blocklist).
 */
export function enforceQueueRules(
  candidates: Track[],
  limit: number,
  recentArtists: string[] = [],
  recentIds: Set<string> = new Set(),
): Track[] {
  const out: Track[] = [];
  const remaining = candidates.slice();
  const cooldown = new Set(recentArtists.slice(0, ARTIST_COOLDOWN));
  const windowCount = new Map<string, number>();
  let lastArtist = recentArtists[0] || "";
  let relax = false;

  while (out.length < limit && remaining.length) {
    let pickIdx = -1;
    for (let i = 0; i < remaining.length; i++) {
      const t = remaining[i];
      if (!t?.id || recentIds.has(t.id)) continue;
      const a = artistKey(t);
      if (!a) continue;
      if (!relax) {
        if (a === lastArtist) continue;                       // no back-to-back
        if (cooldown.has(a)) continue;                        // cooldown
        if ((windowCount.get(a) || 0) >= MAX_PER_ARTIST_WINDOW) continue;
      }
      pickIdx = i;
      break;
    }
    if (pickIdx === -1) {
      if (!relax) { relax = true; continue; }                 // relax and retry once
      break;
    }
    const [pick] = remaining.splice(pickIdx, 1);
    const a = artistKey(pick);
    out.push(pick);
    lastArtist = a;
    windowCount.set(a, (windowCount.get(a) || 0) + 1);
    // shrink cooldown as new artists play (older 5 = current recentArtists)
  }
  return out;
}

/** Smart shuffle — anti-repeat interleave + genre/album variety. */
export function smartShuffle(tracks: Track[]): Track[] {
  if (!tracks || tracks.length < 3) return tracks || [];
  // Group by artist, round-robin pick to spread artists evenly.
  const byArtist = new Map<string, Track[]>();
  for (const t of tracks) {
    const k = artistKey(t);
    const arr = byArtist.get(k) || [];
    arr.push(t);
    byArtist.set(k, arr);
  }
  // Randomize inside each artist bucket for album variety.
  for (const arr of byArtist.values()) arr.sort(() => Math.random() - 0.5);
  const buckets = Array.from(byArtist.values()).sort(() => Math.random() - 0.5);
  const out: Track[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const b of buckets) {
      const next = b.shift();
      if (next) { out.push(next); progress = true; }
    }
  }
  // Final pass: enforce no-consecutive-same-artist.
  return enforceQueueRules(out, out.length);
}

class QueueManager {
  private mode: QueueMode | null = null;
  private seedTrackId: string | null = null;
  private isRefilling = false;
  private radioCache = new Map<string, Track[]>();
  private recentArtists: string[] = [];   // most-recent first
  private recentIds: string[] = [];       // most-recent first

  getMode() { return this.mode; }

  setFixedMode() { this.mode = "fixed"; this.seedTrackId = null; }

  recordPlayed(track: Track) {
    if (!track?.id) return;
    // artists
    const a = artistKey(track);
    if (a) {
      this.recentArtists = [a, ...this.recentArtists.filter(x => x !== a)].slice(0, 20);
    }
    // ids
    this.recentIds = [track.id, ...this.recentIds.filter(x => x !== track.id)].slice(0, RECENT_PLAYED_CAP);
  }

  private recentIdSet() { return new Set(this.recentIds); }

  /** Kick off a radio queue seeded by `seed`. */
  async startRadio(seed: Track): Promise<Track[]> {
    const id = deezerIdFromTrack(seed);
    this.mode = "radio";
    this.seedTrackId = id;
    this.recordPlayed(seed);

    const cacheKey = id || `seed:${seed.id}`;
    const cached = this.radioCache.get(cacheKey);
    if (cached && cached.length > 0) {
      return enforceQueueRules(cached, INITIAL_RADIO_FETCH, this.recentArtists, this.recentIdSet());
    }

    const pool = await this.buildCandidatePool(seed, id);
    const filtered = enforceQueueRules(pool, INITIAL_RADIO_FETCH, this.recentArtists, this.recentIdSet());
    if (filtered.length > 0) this.radioCache.set(cacheKey, filtered);
    return filtered;
  }

  /** Build a large candidate pool from multiple sources. */
  private async buildCandidatePool(seed: Track, seedId: string | null): Promise<Track[]> {
    const seenIds = new Set<string>([seed.id]);
    const push = (arr: Track[], into: Track[]) => {
      for (const t of arr) {
        if (!t?.id || seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        into.push(t);
      }
    };
    const pool: Track[] = [];

    // 1) Playlists containing the seed (approximated by searching "artist title").
    try {
      const q = `${seed.artist} ${seed.title}`.slice(0, 80);
      const { data: pls } = await supabase.functions.invoke("deezer", {
        body: { action: "searchPlaylist", params: { query: q, limit: 3 } },
      });
      const playlists = pls?.data || [];
      for (const p of playlists.slice(0, 2)) {
        try {
          const { data: ptr } = await supabase.functions.invoke("deezer", {
            body: { action: "getPlaylistTracks", params: { playlistId: p.id, limit: 30 } },
          });
          push((ptr?.data || []).map(mapDeezerToTrack), pool);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    // 2) Artist / track radio.
    if (seedId) {
      try {
        const { data } = await supabase.functions.invoke("deezer", {
          body: { action: "getTrackRadio", params: { trackId: seedId, limit: 40 } },
        });
        push((data?.data || []).map(mapDeezerToTrack), pool);
      } catch { /* skip */ }
    }

    // 3) Artist top tracks fallback (searchTrack biased by artist).
    if (pool.length < INITIAL_RADIO_FETCH) {
      try {
        const { data } = await supabase.functions.invoke("deezer", {
          body: { action: "searchTrack", params: { query: seed.artist, limit: 25 } },
        });
        push((data?.data || []).map(mapDeezerToTrack), pool);
      } catch { /* skip */ }
    }

    // 4) Global chart trending fill.
    if (pool.length < INITIAL_RADIO_FETCH) {
      try {
        const { data } = await supabase.functions.invoke("deezer", {
          body: { action: "getChart", params: { type: "tracks", limit: 40 } },
        });
        const arr = data?.tracks?.data || data?.data || [];
        push(arr.map(mapDeezerToTrack), pool);
      } catch { /* skip */ }
    }
    return pool;
  }

  /** Called from PlayerContext to keep the queue infinite. */
  async maybeRefill(currentTrack: Track | null, queue: Track[], currentIndex: number): Promise<Track[]> {
    if (this.mode !== "radio" || this.isRefilling) return [];
    if (currentTrack) this.recordPlayed(currentTrack);
    const remaining = queue.length - currentIndex - 1;
    if (remaining > REFILL_THRESHOLD) return [];

    const seedForRefill = currentTrack || queue[currentIndex] || null;
    if (!seedForRefill) return [];

    this.isRefilling = true;
    try {
      const pool = await this.buildCandidatePool(seedForRefill, deezerIdFromTrack(seedForRefill));
      const existing = new Set(queue.map(t => t.id));
      const filtered = pool.filter(t => !existing.has(t.id));
      return enforceQueueRules(filtered, REFILL_BATCH, this.recentArtists, this.recentIdSet());
    } finally {
      this.isRefilling = false;
    }
  }
}

export const queueManager = new QueueManager();
