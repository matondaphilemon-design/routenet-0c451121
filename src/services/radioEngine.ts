/**
 * Recommendation Engine V2 — the ONE recommendation engine in the project.
 *
 * It behaves like a curator rather than a "related videos" list:
 *  - Selecting a song starts a SESSION and builds ONE 100-song queue.
 *  - The queue is only rebuilt when the user picks a new song, fewer than 10
 *    tracks remain, or the session expires.
 *  - Candidates come from a wide multi-seed pool (the selected song plus the
 *    listener's strongest taste signals).
 *  - Songs and artists respect persistent cooldowns (playedSongs /
 *    recentArtists / queueHistory in localStorage).
 *  - Every queue is balanced across six roles — closely related, trending,
 *    new releases, fan favourites, classics and hidden gems — and ordered
 *    like a DJ set rather than shuffled.
 */
import type { Track } from "@/data/mockData";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";
import { getTopSignalArtists, getRecentSignals } from "@/services/tasteEvents";

/** One manual selection == one 100-song listening session. */
export const INITIAL_QUEUE_SIZE = 100;
export const REFILL_BATCH_SIZE = 40;
export const REFILL_THRESHOLD = 10;
/** A session goes stale after this long and the next advance rebuilds it. */
export const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * Target composition of every queue.
 * related 30 · trending 20 · recent 15 · fanfav 15 · classic 10 · hidden 10
 */
const MIX = {
  related: 0.3, trending: 0.2, recent: 0.15, fanfav: 0.15, classic: 0.1, hidden: 0.1,
} as const;
type Bucket = keyof typeof MIX;
/** DJ ordering: the cycle the queue is laid out in, not a random shuffle. */
const BUCKET_ORDER: Bucket[] = ["related", "trending", "fanfav", "recent", "classic", "hidden"];

/** A song can only come back after this long. */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_MAX_ENTRIES = 1200;

/**
 * An artist stays on cooldown until this many OTHER distinct artists have
 * played. This is the main lever against artist clustering.
 */
const ARTIST_COOLDOWN_DISTINCT = 12;
const ARTIST_HISTORY_MAX = 160;

/** Never play the same artist twice within this many tracks of a batch. */
const MIN_ARTIST_GAP = 8;
/** And never more than this many tracks by one artist per queue. */
const MAX_PER_ARTIST = 2;

interface Candidate {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  views: number;
  verified: boolean;
  topic: boolean;
  depth: number;
  uploaded?: number;
  bucket?: Bucket | "related" | "trending" | "recent" | "classic";
}


/* ------------------------------------------------------------------ */
/* Session state (lightweight — IDs, queue, position. Never API bodies) */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "radio_session_v2";
const COOLDOWN_KEY = "radio_cooldown_v1";
const ARTIST_KEY = "radio_artist_history_v1";

export interface RadioSession {
  played: string[];          // video IDs played this session
  queue: Track[];
  index: number;
}

let played = new Set<string>();

/** id -> timestamp when it was last played (survives reloads). */
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

function loadCooldown() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (raw) {
      const entries: [string, number][] = JSON.parse(raw);
      const now = Date.now();
      cooldown = new Map(entries.filter(([, ts]) => now - ts < COOLDOWN_MS));
    }
  } catch { /* noop */ }
  try {
    const raw = localStorage.getItem(ARTIST_KEY);
    if (raw) artistHistory = (JSON.parse(raw) as string[]).filter(Boolean);
  } catch { /* noop */ }
}
loadCooldown();

function saveCooldown() {
  try {
    const entries = [...cooldown.entries()].slice(-COOLDOWN_MAX_ENTRIES);
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(entries));
    localStorage.setItem(ARTIST_KEY, JSON.stringify(artistHistory.slice(0, ARTIST_HISTORY_MAX)));
  } catch { /* noop */ }
}

function onCooldown(id: string) {
  const ts = cooldown.get(id);
  return !!ts && Date.now() - ts < COOLDOWN_MS;
}

/** How many distinct artists have played since this artist last played. */
export function artistDistance(artist: string): number {
  const a = artistKey(artist);
  if (!a) return Infinity;
  const i = artistHistory.indexOf(a);
  return i === -1 ? Infinity : i;
}

/** True while the artist is still inside the diversity cooldown window. */
export function artistOnCooldown(artist: string): boolean {
  return artistDistance(artist) < ARTIST_COOLDOWN_DISTINCT;
}

function rememberArtist(artist: string) {
  const a = artistKey(artist);
  if (!a) return;
  artistHistory = [a, ...artistHistory.filter((x) => x !== a)].slice(0, ARTIST_HISTORY_MAX);
}

function readSession(): RadioSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RadioSession;
    if (!Array.isArray(s?.queue)) return null;
    return { played: s.played || [], queue: s.queue, index: s.index || 0 };
  } catch { return null; }
}

export function loadSession(): RadioSession | null {
  const s = readSession();
  if (s) played = new Set(s.played);
  return s;
}

export function saveSession(queue: Track[], index: number) {
  try {
    const slim = queue.map((t) => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      artwork: t.artwork, duration: t.duration, youtubeId: t.youtubeId,
    })) as Track[];
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      played: [...played].slice(-500), queue: slim, index,
    }));
  } catch { /* storage full/disabled */ }
}

export function markPlayed(track: Track | null | undefined) {
  const id = videoIdOf(track);
  const now = Date.now();
  if (id) { played.add(id); cooldown.set(id, now); }
  if (track?.id) { played.add(track.id); cooldown.set(track.id, now); }
  if (track?.artist) rememberArtist(track.artist);
  saveCooldown();
}

export function hasPlayed(id: string) { return played.has(id); }

export function resetSession() {
  played = new Set();
  try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

export function videoIdOf(track?: Track | null): string {
  if (!track) return "";
  if (track.youtubeId) return track.youtubeId;
  if (track.id?.startsWith("yt-")) return track.id.slice(3);
  return "";
}

/* ------------------------------------------------------------------ */
/* Fetching (always fresh — no cache)                                   */
/* ------------------------------------------------------------------ */

async function fetchOne(seed: { title: string; artist: string; videoId?: string }, fanout: number): Promise<Candidate[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/piped-radio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        title: seed.title,
        artist: seed.artist,
        videoId: seed.videoId,
        fanout,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.candidates) ? (json.candidates as Candidate[]) : [];
  } catch {
    return [];
  }
}

/**
 * A 100-song session needs a much wider pool than a single related-video
 * graph, so the selected song is fanned out alongside the listener's
 * strongest taste signals.
 */
async function fetchCandidates(seed: Track, wide: boolean): Promise<Candidate[]> {
  const extraSeeds = wide
    ? getTopSignalArtists(6)
        .filter((a) => artistKey(a) !== artistKey(seed.artist))
        .slice(0, 3)
        .map((artist) => ({ title: `${artist} best songs`, artist }))
    : [];

  const lists = await Promise.all([
    fetchOne({ title: seed.title, artist: seed.artist, videoId: videoIdOf(seed) || undefined }, wide ? 8 : 5),
    ...extraSeeds.map((s) => fetchOne(s, 4)),
  ]);
  return lists.flat();
}


/* ------------------------------------------------------------------ */
/* Filtering                                                            */
/* ------------------------------------------------------------------ */

const NON_MUSIC = [
  "interview", "reaction", "podcast", "trailer", "documentary", "behind the scenes",
  "tutorial", "news", "vlog", "explained", "review", "press", "highlights",
  "full album", "full movie", "compilation", "mixtape mix", "1 hour", "hour loop",
  "type beat", "karaoke", "instrumental version", "tiktok compilation", "shorts",
  "sped up", "slowed", "nightcore", "8d audio", "lyric breakdown", "announcement",
];

const MIN_DURATION = 60;      // seconds
const MAX_DURATION = 720;

const normTitle = (t: string) =>
  t.toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/official|video|audio|music|lyrics|hd|4k|visualizer|mv/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function isMusic(c: Candidate): boolean {
  if (!c.videoId || !c.title) return false;
  if (c.duration < MIN_DURATION || c.duration > MAX_DURATION) return false;
  const t = c.title.toLowerCase();
  return !NON_MUSIC.some((kw) => t.includes(kw));
}

/**
 * Remove duplicates, non-music, unavailable, already-played, cooling-down
 * and already-queued candidates. Artist cooldown is applied later (it is a
 * soft filter — it relaxes when the pool cannot fill the batch).
 */
export function filterCandidates(
  candidates: Candidate[],
  excludeIds: Set<string>,
  excludeTitles: Set<string>,
): Candidate[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: Candidate[] = [];
  for (const c of candidates) {
    if (!isMusic(c)) continue;
    if (seenIds.has(c.videoId) || excludeIds.has(c.videoId) || played.has(c.videoId)) continue;
    if (onCooldown(c.videoId)) continue;
    const key = `${artistKey(c.artist)}::${normTitle(c.title)}`;
    if (!key.trim() || seenTitles.has(key) || excludeTitles.has(key)) continue;
    seenIds.add(c.videoId);
    seenTitles.add(key);
    out.push(c);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Era bucketing                                                        */
/* ------------------------------------------------------------------ */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Which role does a candidate play in the session? The backend tags the query
 * a candidate came from; upload age and popularity refine the answer so the
 * queue also contains fan favourites and hidden gems, not only chart hits.
 */
function bucketOf(c: Candidate): Bucket {
  const tagged = c.bucket as Bucket | undefined;
  if (tagged && (tagged === "trending" || tagged === "recent" || tagged === "classic")) {
    // A "trending" candidate with modest reach is really a fan favourite.
    if (tagged === "trending" && c.views > 0 && c.views < 2_000_000) return "fanfav";
    return tagged;
  }
  const age = c.uploaded ? Date.now() - c.uploaded : 0;
  if (c.views > 0 && c.views < 300_000) return "hidden";
  if (c.uploaded && age < YEAR_MS) return "recent";
  if (c.uploaded && age > 6 * YEAR_MS) return "classic";
  if (c.views > 0 && c.views < 5_000_000 && !c.topic) return "fanfav";
  return "related";
}


/* ------------------------------------------------------------------ */
/* Ranking                                                              */
/* ------------------------------------------------------------------ */

/**
 * Score a candidate. Priority order (highest first):
 *   1. genre / musical relevance to the seed (related-graph proximity)
 *   2. song not played recently  (already enforced by the cooldown filter)
 *   3. ARTIST not played recently — the strongest remaining signal
 *   4. similar musical style (recurring artists = the same scene)
 *   5. popularity & upload quality
 *   6. random tie-break
 *
 * There is deliberately no hardcoded artist list here.
 */
export function scoreCandidate(
  c: Candidate,
  seedArtist: string,
  neighbourhood: Map<string, number>,
): number {
  let score = 0;

  // 1. Related-graph proximity — depth 1 = directly related to the seed.
  score += c.depth <= 1 ? 35 : c.depth === 2 ? 26 : 18;

  // 3. Artist diversity — the highest-weight signal after relevance.
  const distance = artistDistance(c.artist);
  if (distance === Infinity) score += 40;                     // never heard yet
  else if (distance >= ARTIST_COOLDOWN_DISTINCT) score += 22; // cooled down
  else score -= 60 - distance * 3;                            // still too soon

  // The seed artist gets no bonus at all — the radio must not become a
  // single-artist playlist.
  const a = artistKey(c.artist);
  const seed = artistKey(seedArtist);
  if (a && seed && (a === seed || a.includes(seed) || seed.includes(a))) score -= 10;

  // 4. Scene affinity: artists recurring across the pool define the world.
  const recurrence = neighbourhood.get(a) || 0;
  score += Math.min(recurrence * 3, 12);

  // 4b. Personal taste profile — likes/plays lift an artist, skips push it down.
  const taste = tasteWeight(a);
  score += Math.max(-25, Math.min(20, taste));


  // 5. Official / editorial signals and popularity (log-scaled so mega-hits
  //    never crowd out discoveries).
  if (c.topic) score += 12;
  if (c.verified) score += 6;
  const t = c.title.toLowerCase();
  if (/official (audio|video|music video)/.test(t)) score += 5;
  if (/live|remix|cover|mashup|edit\b/.test(t)) score -= 12;
  score += Math.min(Math.log10(Math.max(c.views, 1)) * 2.5, 15);
  if (c.duration >= 120 && c.duration <= 360) score += 6;

  // 6. Rotation jitter so repeat sessions never build the same order.
  score += Math.random() * 14;

  return score;
}

/** Artists that recur across the candidate pool define the musical world. */
function buildNeighbourhood(candidates: Candidate[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of candidates) {
    const a = artistKey(c.artist);
    if (a) m.set(a, (m.get(a) || 0) + 1);
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Artist-pool-first selection                                          */
/* ------------------------------------------------------------------ */

interface ArtistGroup {
  artist: string;
  songs: Candidate[];   // best first
  bucket: Bucket;
  score: number;
  cooling: boolean;
}

/**
 * Group ranked candidates by artist. The engine asks "how many different
 * artists can I introduce?" before "which songs should I play?".
 */
export function groupByArtist(ranked: Candidate[]): ArtistGroup[] {
  const groups = new Map<string, ArtistGroup>();
  for (const c of ranked) {
    const a = artistKey(c.artist);
    if (!a) continue;
    const existing = groups.get(a);
    if (existing) {
      if (existing.songs.length < MAX_PER_ARTIST) existing.songs.push(c);
      continue;
    }
    groups.set(a, {
      artist: a,
      songs: [c],
      bucket: bucketOf(c),
      score: 0,
      cooling: artistOnCooldown(c.artist),
    });
  }
  // Ranked input order already reflects score, so first seen = best.
  return [...groups.values()].map((g, i) => ({ ...g, score: -i }));
}

/**
 * Build the batch: pick DIFFERENT artists first, drawing them from the six
 * role buckets in a rotating DJ order so related, trending, fan-favourite,
 * new, classic and hidden-gem tracks are interleaved rather than grouped.
 */
export function selectByArtist(groups: ArtistGroup[], limit: number, startArtist = ""): Candidate[] {
  const startKey = artistKey(startArtist);
  const eligible = groups.filter((g) => g.artist !== startKey);

  const pools = Object.fromEntries(BUCKET_ORDER.map((b) => [b, [] as ArtistGroup[]])) as Record<Bucket, ArtistGroup[]>;
  for (const g of eligible) (pools[g.bucket] ?? pools.related).push(g);

  // Target artist count per bucket.
  const targets = Object.fromEntries(
    BUCKET_ORDER.map((b) => [b, Math.max(1, Math.round(limit * MIX[b]))]),
  ) as Record<Bucket, number>;

  const out: Candidate[] = [];
  const used = new Set<string>();
  const taken = Object.fromEntries(BUCKET_ORDER.map((b) => [b, 0])) as Record<Bucket, number>;


  const recentWindow = () => new Set(out.slice(-(MIN_ARTIST_GAP - 1)).map((c) => artistKey(c.artist)));

  /** Take the best unused artist from a bucket, honouring the artist cooldown. */
  const take = (b: Bucket, allowCooling: boolean): boolean => {
    const window = recentWindow();
    const pool = pools[b];
    for (let i = 0; i < pool.length; i++) {
      const g = pool[i];
      if (used.has(g.artist) || window.has(g.artist)) continue;
      if (g.cooling && !allowCooling) continue;
      pool.splice(i, 1);
      used.add(g.artist);
      taken[b]++;
      out.push(g.songs[0]);
      return true;
    }
    return false;
  };

  // Pass 1 — strict: one song per artist, cooled-down artists only, rotating
  // through the era buckets so the flow is curated rather than blocked.
  let cursor = 0;
  let guard = 0;
  while (out.length < limit && guard++ < limit * 12) {
    const b = BUCKET_ORDER[cursor++ % BUCKET_ORDER.length];
    if (taken[b] >= targets[b]) {
      // Bucket satisfied — let the others top up.
      if (BUCKET_ORDER.every((k) => taken[k] >= targets[k])) break;
      continue;
    }
    if (!take(b, false)) taken[b] = targets[b]; // bucket exhausted
  }

  // Pass 2 — top up from any bucket with any not-yet-used artist.
  guard = 0;
  while (out.length < limit && guard++ < limit * 12) {
    let progressed = false;
    for (const b of BUCKET_ORDER) {
      if (out.length >= limit) break;
      if (take(b, false)) progressed = true;
    }
    if (!progressed) break;
  }

  // Pass 3 — relax the artist cooldown only if the pool genuinely can't fill.
  guard = 0;
  while (out.length < limit && guard++ < limit * 12) {
    let progressed = false;
    for (const b of BUCKET_ORDER) {
      if (out.length >= limit) break;
      if (take(b, true)) progressed = true;
    }
    if (!progressed) break;
  }

  // Pass 4 — last resort: a second song from artists already used, still
  // never back-to-back.
  if (out.length < limit) {
    const seconds = eligible.filter((g) => g.songs.length > 1).map((g) => g.songs[1]);
    for (const c of seconds) {
      if (out.length >= limit) break;
      if (recentWindow().has(artistKey(c.artist))) continue;
      out.push(c);
    }
  }

  return out.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

function toTrack(c: Candidate): Track {
  return {
    id: `yt-${c.videoId}`,
    title: c.title.replace(/\s*\((official|lyric).*?\)\s*/i, "").trim() || c.title,
    artist: c.artist || "Unknown",
    album: "",
    artwork: c.thumbnail,
    duration: c.duration,
    youtubeId: c.videoId,
  };
}

function exclusions(existing: Track[]) {
  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const t of existing) {
    const v = videoIdOf(t);
    if (v) ids.add(v);
    titles.add(`${artistKey(t.artist)}::${normTitle(t.title)}`);
  }
  return { ids, titles };
}

async function buildBatch(seed: Track, existing: Track[], limit: number, wide: boolean): Promise<Track[]> {
  const raw = await fetchCandidates(seed, wide);
  if (!raw.length) return [];
  const { ids, titles } = exclusions([seed, ...existing]);
  const filtered = filterCandidates(raw, ids, titles);
  if (!filtered.length) return [];
  const neighbourhood = buildNeighbourhood(raw);
  const ranked = filtered
    .map((c) => ({ c, s: scoreCandidate(c, seed.artist, neighbourhood) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
  // Artists first, songs second — then laid out as a DJ set.
  return selectByArtist(groupByArtist(ranked), limit, seed.artist).map(toTrack);
}

/* ------------------------------------------------------------------ */
/* Session lifecycle                                                    */
/* ------------------------------------------------------------------ */

const QUEUE_HISTORY_KEY = "radio_queue_history_v1";
const QUEUE_HISTORY_MAX = 8;

interface QueueHistoryEntry {
  sessionId: string;
  createdAt: number;
  songs: string[];
  artists: string[];
}

function readQueueHistory(): QueueHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_HISTORY_KEY) || "[]"); } catch { return []; }
}

function rememberQueue(sessionId: string, queue: Track[]) {
  try {
    const entry: QueueHistoryEntry = {
      sessionId,
      createdAt: Date.now(),
      songs: queue.map((t) => t.id),
      artists: Array.from(new Set(queue.map((t) => artistKey(t.artist)).filter(Boolean))),
    };
    localStorage.setItem(
      QUEUE_HISTORY_KEY,
      JSON.stringify([entry, ...readQueueHistory()].slice(0, QUEUE_HISTORY_MAX)),
    );
  } catch { /* storage full/disabled */ }
}

/** Songs used by the two most recent sessions — future queues avoid re-using them. */
function recentQueueSongs(): Set<string> {
  const out = new Set<string>();
  for (const entry of readQueueHistory().slice(0, 2)) {
    for (const id of entry.songs) out.add(id);
  }
  return out;
}

let sessionId = "";
let sessionStartedAt = 0;

/** True when the current session is stale and should be rebuilt. */
export function sessionExpired(): boolean {
  return !sessionStartedAt || Date.now() - sessionStartedAt > SESSION_TTL_MS;
}

/**
 * Start a brand-new 100-song listening session seeded by the selected song.
 * This is the only place a full queue is generated.
 */
export async function buildRadioQueue(seed: Track): Promise<Track[]> {
  markPlayed(seed);
  sessionId = `s${Date.now().toString(36)}`;
  sessionStartedAt = Date.now();

  const avoid = recentQueueSongs();
  const rest = await buildBatch(seed, [], INITIAL_QUEUE_SIZE + 20, true);
  // Prefer songs the last sessions did not use, but never starve the queue.
  const fresh = rest.filter((t) => !avoid.has(t.id));
  const chosen = (fresh.length >= INITIAL_QUEUE_SIZE - 1 ? fresh : rest).slice(0, INITIAL_QUEUE_SIZE - 1);
  const queue = [seed, ...chosen];
  rememberQueue(sessionId, queue);
  return queue;
}

/** Append a fresh batch, seeded by the currently playing song. */
export async function expandRadioQueue(currentSeed: Track, queue: Track[]): Promise<Track[]> {
  if (!sessionStartedAt) sessionStartedAt = Date.now();
  const extra = await buildBatch(currentSeed, queue, REFILL_BATCH_SIZE, true);
  if (extra.length) rememberQueue(sessionId || "s-refill", [...queue, ...extra]);
  return extra;
}

/** True when the queue is close enough to the end that it should refill. */
export function needsRefill(queue: Track[], index: number) {
  return queue.length - index - 1 <= REFILL_THRESHOLD || sessionExpired();
}

