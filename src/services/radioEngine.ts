/**
 * AI Recommendation Engine V2 — the ONE recommendation engine in the project.
 *
 * There is no YouTube "related videos" input any more. Every queue is written
 * by Lovable AI (the `ai-recommend` edge function) from the seed song plus the
 * listener's taste signals, then resolved to real songs with Deezer metadata.
 *
 *  - Selecting a song starts a SESSION and builds ONE 100-song queue.
 *  - The queue is only rebuilt when the user picks a new song, fewer than 10
 *    tracks remain, or the session expires.
 *  - Distribution per queue: 30% closely related · 20% trending · 15% new
 *    releases · 15% fan favourites · 10% classics · 10% hidden gems.
 *  - Songs and artists respect persistent cooldowns (playedSongs /
 *    recentArtists / queueHistory in localStorage).
 *  - The result is ordered like a DJ set, not shuffled.
 */
import type { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { getTopSignalArtists, getRecentSignals } from "@/services/tasteEvents";
import { enrichTracks } from "@/services/metadataEnrichment";
import { toTitleCase } from "@/utils/toTitleCase";
import {
  resolveArtistId, getArtistRadio, getArtistRelated, getArtistTopTracks,
  getChart, getEditorialSelection, transformTrack,
} from "@/services/deezer";

/** One manual selection == one 100-song listening session. */
export const INITIAL_QUEUE_SIZE = 100;
export const REFILL_BATCH_SIZE = 40;
export const REFILL_THRESHOLD = 10;
/** A session goes stale after this long and the next advance rebuilds it. */
export const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

/** Target composition of every queue. */
const MIX = {
  related: 0.3, trending: 0.2, recent: 0.15, fanfav: 0.15, classic: 0.1, hidden: 0.1,
} as const;
type Bucket = keyof typeof MIX;
/** DJ ordering cycle — the queue is laid out in this rotation. */
const BUCKET_ORDER: Bucket[] = ["related", "trending", "fanfav", "recent", "classic", "hidden"];

/** A song can only come back after this long. */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_MAX_ENTRIES = 1200;

/** An artist waits for this many OTHER distinct artists before returning. */
const ARTIST_COOLDOWN_DISTINCT = 12;
const ARTIST_HISTORY_MAX = 160;

/** Spacing rules inside a single queue. */
const MIN_ARTIST_GAP = 8;
const MAX_PER_ARTIST = 2;

/** How many songs get Deezer artwork before the queue is handed to the player. */
const EAGER_ENRICH = 24;

interface Suggestion {
  title: string;
  artist: string;
  role?: string;
  reason?: string;
  /** Already-resolved metadata (Deezer fallback path). */
  track?: Track;
}

/* ------------------------------------------------------------------ */
/* Session state                                                       */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "radio_session_v3";
const COOLDOWN_KEY = "radio_cooldown_v1";
const ARTIST_KEY = "radio_artist_history_v1";
const QUEUE_HISTORY_KEY = "radio_queue_history_v1";

export interface RadioSession {
  played: string[];
  queue: Track[];
  index: number;
}

let played = new Set<string>();
/** key -> timestamp when it was last played (survives reloads). */
let cooldown = new Map<string, number>();
/** Most-recently-played artists, newest first (survives reloads). */
let artistHistory: string[] = [];

export const artistKey = (a: string) =>
  (a || "")
    .toLowerCase()
    .replace(/\s*-\s*topic$/i, "")
    .replace(/\s*(vevo|official)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const songKey = (title: string, artist: string) =>
  `${artistKey(artist)}::${(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;

function loadCooldown() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (raw) cooldown = new Map(Object.entries(JSON.parse(raw)) as [string, number][]);
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(ARTIST_KEY);
    if (raw) artistHistory = JSON.parse(raw) as string[];
  } catch { /* ignore */ }
}
loadCooldown();

function saveCooldown() {
  try {
    if (cooldown.size > COOLDOWN_MAX_ENTRIES) {
      const sorted = [...cooldown.entries()].sort((a, b) => b[1] - a[1]).slice(0, COOLDOWN_MAX_ENTRIES);
      cooldown = new Map(sorted);
    }
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(Object.fromEntries(cooldown)));
    localStorage.setItem(ARTIST_KEY, JSON.stringify(artistHistory.slice(0, ARTIST_HISTORY_MAX)));
  } catch { /* quota */ }
}

function onCooldown(key: string): boolean {
  const at = cooldown.get(key);
  return !!at && Date.now() - at < COOLDOWN_MS;
}

/** How many distinct artists have played since this one — Infinity if never. */
export function artistDistance(artist: string): number {
  const k = artistKey(artist);
  if (!k) return Infinity;
  const seen = new Set<string>();
  for (const a of artistHistory) {
    if (a === k) return seen.size;
    seen.add(a);
  }
  return Infinity;
}

export function artistOnCooldown(artist: string): boolean {
  return artistDistance(artist) < ARTIST_COOLDOWN_DISTINCT;
}

function rememberArtist(artist: string) {
  const k = artistKey(artist);
  if (!k) return;
  artistHistory = [k, ...artistHistory.filter((a) => a !== k)].slice(0, ARTIST_HISTORY_MAX);
}

function readSession(): (RadioSession & { at?: number }) | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadSession(): RadioSession | null {
  const s = readSession();
  if (!s) return null;
  played = new Set(s.played || []);
  return { played: s.played || [], queue: s.queue || [], index: s.index || 0 };
}

export function saveSession(queue: Track[], index: number) {
  try {
    const slim = queue.slice(0, 120).map((t) => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      artwork: t.artwork, duration: t.duration, youtubeId: t.youtubeId,
    }));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ played: [...played].slice(-400), queue: slim, index, at: Date.now() }));
  } catch { /* quota */ }
}

export function markPlayed(track: Track | null | undefined) {
  if (!track?.title) return;
  const key = songKey(track.title, track.artist);
  played.add(key);
  cooldown.set(key, Date.now());
  rememberArtist(track.artist);
  saveCooldown();
}

export function hasPlayed(key: string) { return played.has(key); }

export function resetSession() {
  played = new Set();
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function sessionExpired(): boolean {
  const s = readSession();
  if (!s?.at) return true;
  return Date.now() - s.at > SESSION_TTL_MS;
}

export function videoIdOf(track?: Track | null): string {
  return track?.youtubeId || "";
}

/* ------------------------------------------------------------------ */
/* Queue history — never repeat the previous sessions' songs           */
/* ------------------------------------------------------------------ */

interface QueueHistoryEntry { at: number; keys: string[] }

function readQueueHistory(): QueueHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_HISTORY_KEY) || "[]"); } catch { return []; }
}

function rememberQueue(keys: string[]) {
  try {
    const next = [{ at: Date.now(), keys: keys.slice(0, 120) }, ...readQueueHistory()].slice(0, 5);
    localStorage.setItem(QUEUE_HISTORY_KEY, JSON.stringify(next));
  } catch { /* quota */ }
}

function recentQueueSongs(): Set<string> {
  const out = new Set<string>();
  for (const entry of readQueueHistory()) {
    if (Date.now() - entry.at > 24 * 60 * 60 * 1000) continue;
    entry.keys.forEach((k) => out.add(k));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* AI candidate generation                                             */
/* ------------------------------------------------------------------ */

function followedArtists(): string[] {
  const out = new Set<string>(getTopSignalArtists(12));
  try {
    const raw = localStorage.getItem("onboarding");
    if (raw) {
      const o = JSON.parse(raw);
      ((o?.artists || []) as any[]).forEach((a) => out.add(String(a?.name || a)));
    }
  } catch { /* ignore */ }
  return [...out].filter(Boolean).slice(0, 25);
}

function tasteSignals() {
  try {
    return getRecentSignals(30).map((s: any) => ({
      type: s.type, title: s.title, artist: s.artist, genre: s.genre, weight: s.weight,
    }));
  } catch {
    return [];
  }
}

async function askAI(seed: Track | null, exclude: string[], count: number): Promise<Suggestion[]> {
  const { data, error } = await supabase.functions.invoke("ai-recommend", {
    body: {
      seed: seed ? { title: seed.title, artist: seed.artist } : null,
      signals: tasteSignals(),
      followedArtists: followedArtists(),
      excludeTitles: exclude.slice(0, 60),
      distribution: MIX,
      count,
    },
  });
  if (error) return [];
  const rows = Array.isArray((data as any)?.tracks) ? (data as any).tracks : [];
  return rows
    .map((t: any) => ({
      title: String(t?.title || "").trim(),
      artist: String(t?.artist || "").trim(),
      role: String(t?.role || "related").trim().toLowerCase(),
      reason: String(t?.reason || "").trim(),
    }))
    .filter((t: Suggestion) => t.title && t.artist);
}

function bucketOf(role?: string): Bucket {
  const r = (role || "").toLowerCase();
  if (r.startsWith("trend")) return "trending";
  if (r.startsWith("new") || r.startsWith("recent")) return "recent";
  if (r.startsWith("fan") || r.startsWith("popular")) return "fanfav";
  if (r.startsWith("class") || r.startsWith("throw")) return "classic";
  if (r.startsWith("hidden") || r.startsWith("gem") || r.startsWith("deep")) return "hidden";
  return "related";
}

/* ------------------------------------------------------------------ */
/* Selection: cooldowns, diversity, DJ ordering                        */
/* ------------------------------------------------------------------ */

interface Scored extends Suggestion { key: string; bucket: Bucket }

function prepare(list: Suggestion[], excludeKeys: Set<string>): Scored[] {
  const seen = new Set<string>();
  const out: Scored[] = [];
  const recent = recentQueueSongs();
  for (const s of list) {
    const key = songKey(s.title, s.artist);
    if (!key || seen.has(key) || excludeKeys.has(key)) continue;
    if (onCooldown(key) || recent.has(key)) continue;
    seen.add(key);
    out.push({ ...s, key, bucket: bucketOf(s.role) });
  }
  return out;
}

/** Pick the target number per bucket, then interleave in DJ rotation. */
function arrange(pool: Scored[], limit: number): Scored[] {
  const byBucket = new Map<Bucket, Scored[]>();
  BUCKET_ORDER.forEach((b) => byBucket.set(b, []));
  for (const c of pool) byBucket.get(c.bucket)!.push(c);

  // Enforce the target distribution, borrowing from `related` when short.
  const quota = new Map<Bucket, number>();
  BUCKET_ORDER.forEach((b) => quota.set(b, Math.round(MIX[b] * limit)));

  const picked: Scored[] = [];
  const perArtist = new Map<string, number>();
  const lastIndexByArtist = new Map<string, number>();
  const leftovers: Scored[] = [];

  const canTake = (c: Scored, position: number) => {
    const a = artistKey(c.artist);
    if ((perArtist.get(a) || 0) >= MAX_PER_ARTIST) return false;
    const last = lastIndexByArtist.get(a);
    if (last !== undefined && position - last < MIN_ARTIST_GAP) return false;
    return true;
  };

  const commit = (c: Scored) => {
    const a = artistKey(c.artist);
    perArtist.set(a, (perArtist.get(a) || 0) + 1);
    lastIndexByArtist.set(a, picked.length);
    picked.push(c);
  };

  // Round-robin the buckets in DJ rotation until the queue is full.
  let guard = 0;
  while (picked.length < limit && guard++ < limit * 8) {
    let advanced = false;
    for (const bucket of BUCKET_ORDER) {
      if (picked.length >= limit) break;
      const list = byBucket.get(bucket)!;
      if (!list.length) continue;
      if ((quota.get(bucket) || 0) <= 0 && pool.length > limit) continue;
      const idx = list.findIndex((c) => canTake(c, picked.length));
      if (idx === -1) continue;
      const [c] = list.splice(idx, 1);
      quota.set(bucket, (quota.get(bucket) || 0) - 1);
      commit(c);
      advanced = true;
    }
    if (!advanced) {
      // Quotas exhausted or spacing blocked everything — relax and refill.
      const rest = BUCKET_ORDER.flatMap((b) => byBucket.get(b)!);
      if (!rest.length) break;
      BUCKET_ORDER.forEach((b) => quota.set(b, quota.get(b)! + Math.ceil(limit / 6)));
      const next = rest.find((c) => canTake(c, picked.length));
      if (!next) { leftovers.push(...rest); break; }
      byBucket.get(next.bucket)!.splice(byBucket.get(next.bucket)!.indexOf(next), 1);
      commit(next);
    }
  }

  // Prefer artists that are OFF cooldown near the front of the queue.
  const front = picked.slice(0, 12).sort((a, b) => artistDistance(b.artist) - artistDistance(a.artist));
  return [...front, ...picked.slice(12)].slice(0, limit);
}

function toTrack(s: Scored, seed?: Track | null): Track {
  return {
    id: `ai-${s.key.replace(/\s+/g, "-")}`,
    title: toTitleCase(s.title),
    artist: toTitleCase(s.artist),
    album: "",
    artwork: seed?.artwork && false ? seed.artwork : "/placeholder.svg",
    duration: 0,
  } as Track;
}

/** Deezer artwork/album for the head of the queue; the tail resolves lazily. */
async function decorate(tracks: Track[]): Promise<Track[]> {
  if (!tracks.length) return tracks;
  const head = await enrichTracks(tracks.slice(0, EAGER_ENRICH), 6).catch(() => tracks.slice(0, EAGER_ENRICH));
  const tail = tracks.slice(EAGER_ENRICH);
  // Background: fill in the rest so the queue page and mini player look right.
  if (tail.length) enrichTracks(tail, 4).catch(() => undefined);
  return [...head, ...tail];
}

async function buildBatch(seed: Track | null, existing: Track[], limit: number): Promise<Track[]> {
  const excludeKeys = new Set<string>(existing.map((t) => songKey(t.title, t.artist)));
  if (seed) excludeKeys.add(songKey(seed.title, seed.artist));
  const excludeTitles = existing.slice(-40).map((t) => `${t.title} — ${t.artist}`);

  // Ask for extra so cooldowns and diversity rules still leave a full queue.
  const suggestions = await askAI(seed, excludeTitles, Math.min(60, Math.ceil(limit * 0.65)));
  let pool = prepare(suggestions, excludeKeys);

  if (pool.length < limit) {
    const more = await askAI(seed, [...excludeTitles, ...pool.map((p) => `${p.title} — ${p.artist}`)], 60);
    pool = [...pool, ...prepare(more, new Set([...excludeKeys, ...pool.map((p) => p.key)]))];
  }

  if (!pool.length) return [];
  const arranged = arrange(pool, limit);
  rememberQueue(arranged.map((c) => c.key));
  return decorate(arranged.map((c) => toTrack(c, seed)));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Build the full session queue for a freshly selected song. */
export async function buildRadioQueue(seed: Track): Promise<Track[]> {
  const rest = await buildBatch(seed, [seed], INITIAL_QUEUE_SIZE - 1);
  return [seed, ...rest];
}

/** Append another batch, seeded by what is playing now. */
export async function expandRadioQueue(currentSeed: Track, queue: Track[]): Promise<Track[]> {
  return buildBatch(currentSeed, queue, REFILL_BATCH_SIZE);
}

export function needsRefill(queue: Track[], index: number) {
  return queue.length - index <= REFILL_THRESHOLD;
}
