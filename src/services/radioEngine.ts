/**
 * radioEngine — the ONE recommendation engine in the project.
 *
 * Piped (YouTube) based endless radio:
 *  - Every playback starts a fresh discovery session (no cached API responses).
 *  - Candidates come from Piped search + relatedStreams (with fan-out).
 *  - Candidates are de-duplicated, filtered (non-music / played / already
 *    queued / invalid / on cooldown), ranked for musical relevance, blended
 *    (related / popular / discovery) and finally diversified so no artist
 *    dominates the session.
 *  - The queue refills automatically from the currently playing song.
 */
import type { Track } from "@/data/mockData";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

/** A shorter, tighter queue keeps recommendations relevant and fresh. */
export const INITIAL_QUEUE_SIZE = 25;
export const REFILL_BATCH_SIZE = 15;
export const REFILL_THRESHOLD = 5;

/** Blend of the queue: related · popular in genre · fresh discovery. */
const MIX_RELATED = 0.4;
const MIX_POPULAR = 0.35;
const MIX_DISCOVERY = 0.25;

/** A song can only come back after this long. */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_MAX_ENTRIES = 600;

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
}

/* ------------------------------------------------------------------ */
/* Session state (lightweight — IDs, queue, position. Never API bodies) */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "radio_session_v2";
const COOLDOWN_KEY = "radio_cooldown_v1";

export interface RadioSession {
  played: string[];          // video IDs played this session
  queue: Track[];
  index: number;
}

let played = new Set<string>();

/** id -> timestamp when it was last played (survives reloads). */
let cooldown = new Map<string, number>();

function loadCooldown() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return;
    const entries: [string, number][] = JSON.parse(raw);
    const now = Date.now();
    cooldown = new Map(entries.filter(([, ts]) => now - ts < COOLDOWN_MS));
  } catch { /* noop */ }
}
loadCooldown();

function saveCooldown() {
  try {
    const entries = [...cooldown.entries()].slice(-COOLDOWN_MAX_ENTRIES);
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(entries));
  } catch { /* noop */ }
}

function onCooldown(id: string) {
  const ts = cooldown.get(id);
  return !!ts && Date.now() - ts < COOLDOWN_MS;
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

async function fetchCandidates(seed: Track): Promise<Candidate[]> {
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
        videoId: videoIdOf(seed) || undefined,
        fanout: 3,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.candidates) ? (json.candidates as Candidate[]) : [];
  } catch {
    return [];
  }
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

const artistKey = (a: string) => (a || "").toLowerCase().replace(/\s+/g, " ").trim();

function isMusic(c: Candidate): boolean {
  if (!c.videoId || !c.title) return false;
  if (c.duration < MIN_DURATION || c.duration > MAX_DURATION) return false;
  const t = c.title.toLowerCase();
  return !NON_MUSIC.some((kw) => t.includes(kw));
}

/**
 * Remove duplicates, non-music, unavailable, already-played, cooling-down
 * and already-queued candidates.
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
/* Ranking                                                              */
/* ------------------------------------------------------------------ */

/**
 * Score a candidate for musical relevance to the seed.
 * Signals: proximity to the seed in the related-graph, artist affinity
 * (artists that recur across the pool = the same musical world),
 * official/verified uploads, popularity, and title quality.
 *
 * There is deliberately no hardcoded artist list here — relevance comes
 * purely from the seed's own related graph.
 */
export function scoreCandidate(
  c: Candidate,
  seedArtist: string,
  neighbourhood: Map<string, number>,
): number {
  let score = 0;

  // 1. Related-graph proximity — depth 1 = directly related to the seed.
  score += c.depth <= 1 ? 35 : c.depth === 2 ? 24 : 14;

  // 2. Artist affinity: recurring artists define the scene. The seed artist
  //    gets only a small nudge so the radio does not turn into a single-artist
  //    playlist.
  const a = artistKey(c.artist);
  const seed = artistKey(seedArtist);
  if (a && seed && (a === seed || a.includes(seed) || seed.includes(a))) score += 6;
  const recurrence = neighbourhood.get(a) || 0;
  score += Math.min(recurrence * 5, 20);

  // 3. Official / editorial signals.
  if (c.topic) score += 14;            // YouTube "- Topic" = official audio
  if (c.verified) score += 8;
  const t = c.title.toLowerCase();
  if (/official (audio|video|music video)/.test(t)) score += 6;
  if (/live|remix|cover|mashup|edit\b/.test(t)) score -= 12;

  // 4. Popularity (log-scaled so mega-hits don't crowd out discoveries).
  score += Math.min(Math.log10(Math.max(c.views, 1)) * 3, 18);

  // 5. Typical song length bonus.
  if (c.duration >= 120 && c.duration <= 360) score += 6;

  // 6. Rotation jitter so repeat sessions never build the same order.
  score += Math.random() * 16;

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
/* Diversity                                                            */
/* ------------------------------------------------------------------ */

/** Never play the same artist twice within this many tracks. */
const MIN_ARTIST_GAP = 4;
/** And never more than this many tracks by one artist per batch. */
const MAX_PER_ARTIST = 2;

/**
 * Order ranked candidates so artists rotate naturally: the same artist can
 * never appear twice inside a four-track window, and contributes at most two
 * tracks to a batch.
 */
export function diversify(ranked: Candidate[], limit: number, startArtist = ""): Candidate[] {
  const out: Candidate[] = [];
  const pool = ranked.slice();
  const counts = new Map<string, number>();
  let relaxed = false;

  const recentArtists = () => {
    const window = out.slice(-(MIN_ARTIST_GAP - 1)).map((t) => artistKey(t.artist));
    if (out.length === 0 && startArtist) window.push(artistKey(startArtist));
    return new Set(window);
  };

  while (out.length < limit && pool.length) {
    const recent = recentArtists();
    let pick = -1;
    for (let i = 0; i < pool.length; i++) {
      const a = artistKey(pool[i].artist);
      if (!relaxed) {
        if (recent.has(a)) continue;
        if ((counts.get(a) || 0) >= MAX_PER_ARTIST) continue;
      }
      pick = i;
      break;
    }
    if (pick === -1) {
      if (relaxed) break;
      relaxed = true;
      continue;
    }
    const [chosen] = pool.splice(pick, 1);
    const a = artistKey(chosen.artist);
    counts.set(a, (counts.get(a) || 0) + 1);
    out.push(chosen);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Blending: related · popular · discovery                              */
/* ------------------------------------------------------------------ */

/**
 * Split the ranked pool into three buckets and interleave them so every
 * queue mixes close matches, genre hits and fresh finds instead of an
 * endless run of the same few songs.
 */
function blend(ranked: Candidate[], limit: number): Candidate[] {
  if (ranked.length <= limit) return ranked;

  const related = ranked.filter((c) => c.depth <= 1);
  const rest = ranked.filter((c) => c.depth > 1);
  const sortedByViews = [...rest].sort((a, b) => (b.views || 0) - (a.views || 0));
  const popularCut = Math.ceil(sortedByViews.length / 2);
  const popular = sortedByViews.slice(0, popularCut);
  const discovery = sortedByViews.slice(popularCut);

  const take = (arr: Candidate[], n: number) => arr.slice(0, Math.max(0, n));
  const picked = [
    ...take(related, Math.round(limit * MIX_RELATED)),
    ...take(popular, Math.round(limit * MIX_POPULAR)),
    ...take(discovery, Math.round(limit * MIX_DISCOVERY)),
  ];

  // Top up from whatever is left if a bucket was short.
  const chosen = new Set(picked.map((c) => c.videoId));
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (!chosen.has(c.videoId)) { picked.push(c); chosen.add(c.videoId); }
  }

  // Keep the original relevance ordering inside the blended selection so the
  // musical flow (energy / tempo continuity) is preserved.
  const order = new Map(ranked.map((c, i) => [c.videoId, i]));
  return picked.sort((a, b) => (order.get(a.videoId) ?? 0) - (order.get(b.videoId) ?? 0));
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

async function buildBatch(seed: Track, existing: Track[], limit: number): Promise<Track[]> {
  const raw = await fetchCandidates(seed);
  if (!raw.length) return [];
  const { ids, titles } = exclusions([seed, ...existing]);
  const filtered = filterCandidates(raw, ids, titles);
  if (!filtered.length) return [];
  const neighbourhood = buildNeighbourhood(raw);
  const ranked = filtered
    .map((c) => ({ c, s: scoreCandidate(c, seed.artist, neighbourhood) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
  const blended = blend(ranked, Math.max(limit * 2, limit + 10));
  return diversify(blended, limit, seed.artist).map(toTrack);
}

/** Start a brand-new discovery session seeded by the selected song. */
export async function buildRadioQueue(seed: Track): Promise<Track[]> {
  markPlayed(seed);
  const rest = await buildBatch(seed, [], INITIAL_QUEUE_SIZE - 1);
  return [seed, ...rest];
}

/** Append a fresh batch, seeded by the currently playing song. */
export async function expandRadioQueue(currentSeed: Track, queue: Track[]): Promise<Track[]> {
  return buildBatch(currentSeed, queue, REFILL_BATCH_SIZE);
}

/** True when the queue is close enough to the end that it should refill. */
export function needsRefill(queue: Track[], index: number) {
  return queue.length - index - 1 <= REFILL_THRESHOLD;
}
