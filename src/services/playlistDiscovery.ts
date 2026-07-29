/**
 * Playlist Discovery Engine.
 *
 * Given a seed track, this module:
 *   1. Analyses the song (artist, genre, subgenre, style, mood) using Deezer
 *      artist/album genre data plus a keyword classifier.
 *   2. Builds a set of *style-based* playlist queries (never a single fixed
 *      query per song).
 *   3. Searches Piped (YouTube) as the PRIMARY playlist source, Deezer as a
 *      secondary source.
 *   4. Scores every candidate playlist (editorial/official signals, size,
 *      genre match, artist-diversity, anti-repeat rotation) and picks one of
 *      the best matches — a *different* one each time the same song is played.
 *   5. Resolves the chosen playlist's tracks, enriching metadata/artwork via
 *      Deezer and falling back to Piped title/artist/thumbnail.
 */
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";
import type { Track } from "@/data/mockData";
import { toTitleCase } from "@/utils/toTitleCase";

export interface SongProfile {
  artist: string;
  title: string;
  genre: string;
  subgenre?: string;
  style: string[];
  mood?: string;
}

export interface PlaylistCandidate {
  id: string;
  title: string;
  uploader: string;
  videos: number;
  thumbnail: string;
  source: "piped" | "deezer";
  score: number;
}

export interface DiscoveredPlaylist {
  id: string;
  title: string;
  source: "piped" | "deezer";
  tracks: Track[];
}

/* ------------------------------------------------------------------ */
/* 1. Song analysis                                                    */
/* ------------------------------------------------------------------ */

const GENRE_STYLES: Record<string, string[]> = {
  "hip hop": ["trap", "rap", "hip hop hits", "rap caviar", "hip hop essentials"],
  rap: ["trap", "rap hits", "hip hop", "drill", "rap essentials"],
  trap: ["trap essentials", "trap hits", "modern trap", "hip hop"],
  drill: ["drill", "uk drill", "ny drill", "hip hop"],
  afrobeats: ["afrobeats hits", "afro fusion", "afropop", "naija hits", "african heat"],
  afro: ["afrobeats", "afro fusion", "amapiano", "afropop"],
  amapiano: ["amapiano hits", "amapiano", "afro house"],
  dancehall: ["dancehall hits", "reggae dancehall", "caribbean"],
  reggae: ["reggae essentials", "roots reggae", "dancehall"],
  rnb: ["r&b hits", "rnb essentials", "slow jams", "alternative r&b"],
  "r&b": ["r&b hits", "rnb essentials", "slow jams", "neo soul"],
  soul: ["soul classics", "neo soul", "r&b"],
  pop: ["pop hits", "todays top hits", "pop essentials", "mainstream pop"],
  rock: ["rock classics", "rock essentials", "alt rock", "indie rock"],
  metal: ["metal essentials", "heavy metal hits", "hard rock"],
  electronic: ["edm hits", "electronic essentials", "dance hits", "house"],
  house: ["house music", "deep house", "afro house", "dance hits"],
  dance: ["dance hits", "edm", "club bangers"],
  country: ["country hits", "country essentials", "modern country"],
  latin: ["latin hits", "reggaeton", "latin pop"],
  reggaeton: ["reggaeton hits", "latin urban", "perreo"],
  jazz: ["jazz essentials", "smooth jazz", "jazz classics"],
  classical: ["classical essentials", "piano classical", "focus classical"],
  gospel: ["gospel hits", "worship", "christian"],
  kpop: ["k-pop hits", "kpop essentials"],
  indie: ["indie hits", "indie pop", "bedroom pop"],
  alternative: ["alternative hits", "alt rock", "indie"],
  folk: ["folk essentials", "acoustic", "singer songwriter"],
  blues: ["blues classics", "blues essentials"],
  punk: ["punk essentials", "pop punk"],
  funk: ["funk classics", "funk essentials", "disco"],
  disco: ["disco classics", "funk", "70s hits"],
};

const TITLE_MOODS: [RegExp, string][] = [
  [/\b(love|heart|baby|kiss|romance)\b/i, "love"],
  [/\b(sad|cry|lonely|alone|pain|hurt)\b/i, "sad"],
  [/\b(party|club|night|dance|turn up)\b/i, "party"],
  [/\b(chill|slow|calm|easy|smooth)\b/i, "chill"],
  [/\b(work|grind|money|hustle|boss)\b/i, "hype"],
];

async function dz(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("deezer", { body: { action, params } });
  if (error) throw error;
  return data;
}

const profileCache = new Map<string, SongProfile>();

function normaliseGenre(raw: string): string {
  const g = raw.toLowerCase();
  if (g.includes("hip") || g.includes("rap")) return "hip hop";
  if (g.includes("afro")) return "afrobeats";
  if (g.includes("r&b") || g.includes("rnb")) return "r&b";
  if (g.includes("electro") || g.includes("dance")) return "electronic";
  if (g.includes("latin")) return "latin";
  if (g.includes("rock")) return "rock";
  if (g.includes("pop")) return "pop";
  if (g.includes("reggae")) return "reggae";
  if (g.includes("jazz")) return "jazz";
  if (g.includes("classic")) return "classical";
  if (g.includes("country")) return "country";
  if (g.includes("metal")) return "metal";
  if (g.includes("film") || g.includes("sound")) return "pop";
  return g.trim();
}

/** Analyse the seed track — genre, subgenre, style keywords, mood. */
export async function analyseSong(seed: Track): Promise<SongProfile> {
  const key = `${seed.artist}|${seed.title}`.toLowerCase();
  const cachedProfile = profileCache.get(key);
  if (cachedProfile) return cachedProfile;

  let genre = "";
  let subgenre: string | undefined;

  try {
    const search = await dz("searchArtist", { query: seed.artist, limit: 1 });
    const artistId = search?.data?.[0]?.id;
    if (artistId) {
      const albums = await dz("getArtistAlbums", { artistId, limit: 3 });
      const albumId = albums?.data?.[0]?.id;
      if (albumId) {
        const album = await dz("getAlbum", { albumId });
        const genres: any[] = album?.genres?.data || [];
        if (genres.length) {
          genre = normaliseGenre(genres[0].name || "");
          if (genres[1]) subgenre = normaliseGenre(genres[1].name || "");
        }
      }
    }
  } catch { /* offline / API down — keyword classifier below */ }

  if (!genre) {
    const hay = `${seed.artist} ${seed.title} ${seed.album ?? ""}`.toLowerCase();
    const hit = Object.keys(GENRE_STYLES).find((g) => hay.includes(g));
    genre = hit ?? "pop";
  }

  const style = GENRE_STYLES[genre] ?? GENRE_STYLES[subgenre ?? ""] ?? [`${genre} hits`, `${genre} essentials`];
  const mood = TITLE_MOODS.find(([re]) => re.test(seed.title))?.[1];

  const profile: SongProfile = { artist: seed.artist, title: seed.title, genre, subgenre, style, mood };
  profileCache.set(key, profile);
  return profile;
}

/* ------------------------------------------------------------------ */
/* 2. Query building                                                   */
/* ------------------------------------------------------------------ */

const YEAR = new Date().getFullYear();

/** Builds many *style-first* queries so the same song never resolves to one playlist. */
export function buildQueries(p: SongProfile): string[] {
  const styles = p.style.slice(0, 5);
  const base = [
    ...styles.map((s) => `${s} playlist`),
    ...styles.slice(0, 2).map((s) => `best ${s} ${YEAR} playlist`),
    `${p.genre} top hits playlist`,
    `${p.genre} mix ${YEAR}`,
    p.subgenre ? `${p.subgenre} playlist` : "",
    `${p.artist} type playlist ${p.genre}`,
    `artists like ${p.artist} playlist`,
    p.mood ? `${p.mood} ${p.genre} playlist` : "",
  ].filter(Boolean) as string[];
  return Array.from(new Set(base));
}

/* ------------------------------------------------------------------ */
/* 3. Candidate search (Piped primary, Deezer secondary)               */
/* ------------------------------------------------------------------ */

const searchCache = new Map<string, PlaylistCandidate[]>();

async function pipedPlaylistSearch(q: string, limit = 12): Promise<PlaylistCandidate[]> {
  const cacheKey = `piped:${q}:${limit}`;
  const hit = searchCache.get(cacheKey);
  if (hit) return hit;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/piped-playlists?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } },
    );
    if (!res.ok) return [];
    const j = await res.json();
    const out: PlaylistCandidate[] = (j?.playlists || []).map((p: any) => ({
      id: String(p.id),
      title: p.title || "",
      uploader: p.uploader || "",
      videos: Number(p.videos) || 0,
      thumbnail: p.thumbnail || "",
      source: "piped" as const,
      score: 0,
    })).filter((p: PlaylistCandidate) => p.id);
    searchCache.set(cacheKey, out);
    return out;
  } catch {
    return [];
  }
}

async function deezerPlaylistSearch(q: string, limit = 8): Promise<PlaylistCandidate[]> {
  const cacheKey = `dz:${q}:${limit}`;
  const hit = searchCache.get(cacheKey);
  if (hit) return hit;
  try {
    const d = await dz("searchPlaylist", { query: q, limit });
    const out: PlaylistCandidate[] = (d?.data || []).map((p: any) => ({
      id: String(p.id),
      title: p.title || "",
      uploader: p.user?.name || p.creator?.name || "",
      videos: Number(p.nb_tracks) || 0,
      thumbnail: p.picture_medium || p.picture || "",
      source: "deezer" as const,
      score: 0,
    })).filter((p: PlaylistCandidate) => p.id);
    searchCache.set(cacheKey, out);
    return out;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* 4. Scoring + rotation                                               */
/* ------------------------------------------------------------------ */

const QUALITY_WORDS = [
  "official", "editorial", "top hits", "best of", "essentials", "curated",
  "hits", "top 50", "top 100", "trending", "mix", "radio", "the sound of",
];
const JUNK_WORDS = ["lyrics", "karaoke", "cover", "sped up", "slowed", "nightcore", "8d", "instrumental", "reaction", "type beat"];

const ROTATION_KEY = "tunestream_playlist_rotation";

function loadRotation(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(ROTATION_KEY) || "{}"); } catch { return {}; }
}
function rememberUsed(seedKey: string, playlistId: string) {
  try {
    const store = loadRotation();
    const list = [playlistId, ...(store[seedKey] || []).filter((x) => x !== playlistId)].slice(0, 12);
    store[seedKey] = list;
    const keys = Object.keys(store);
    if (keys.length > 200) delete store[keys[0]];
    localStorage.setItem(ROTATION_KEY, JSON.stringify(store));
  } catch { /* storage disabled */ }
}

function scoreCandidate(c: PlaylistCandidate, p: SongProfile, recentlyUsed: string[]): number {
  const t = `${c.title} ${c.uploader}`.toLowerCase();
  let score = 0;

  // genre / style relevance
  if (t.includes(p.genre)) score += 30;
  if (p.subgenre && t.includes(p.subgenre)) score += 20;
  for (const s of p.style) if (t.includes(s.split(" ")[0])) score += 8;
  if (p.mood && t.includes(p.mood)) score += 6;

  // quality signals
  for (const w of QUALITY_WORDS) if (t.includes(w)) score += 7;
  if (/\b(20\d\d)\b/.test(t)) score += 5;
  if (/vevo|records|music|official|topic/i.test(c.uploader)) score += 8;

  // size — real curated playlists have many tracks, but not 1000s of junk
  if (c.videos >= 20 && c.videos <= 400) score += 12;
  else if (c.videos > 400) score += 4;
  else if (c.videos > 0 && c.videos < 8) score -= 15;

  // diversity: a playlist named after the seed artist alone is artist-only
  const artistWord = p.artist.toLowerCase();
  if (t.includes(artistWord)) {
    score -= /mix|radio|friends|type|and|&|feat/i.test(t) ? 4 : 22;
  }

  // junk
  for (const w of JUNK_WORDS) if (t.includes(w)) score -= 25;

  // rotation: strongly demote playlists used for this seed recently
  const idx = recentlyUsed.indexOf(c.id);
  if (idx >= 0) score -= 60 - idx * 4;

  // deezer is secondary
  if (c.source === "deezer") score -= 6;

  // freshness jitter so equally-good playlists rotate
  score += Math.random() * 12;
  return score;
}

/* ------------------------------------------------------------------ */
/* 5. Track resolution + metadata enrichment                           */
/* ------------------------------------------------------------------ */

function cleanTitle(raw: string): { title: string; artist?: string } {
  let t = raw
    .replace(/\((?:official\s*)?(?:music\s*)?video\)/gi, "")
    .replace(/\[(?:official\s*)?(?:music\s*)?video\]/gi, "")
    .replace(/\b(official audio|official video|lyrics?|visualizer|hd|4k)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const dash = t.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) return { artist: dash[0].trim(), title: dash.slice(1).join(" - ").trim() };
  return { title: t };
}

const metaCache = new Map<string, Track | null>();

/** Enrich a Piped item with Deezer metadata; fall back to Piped data. */
async function enrich(item: { videoId: string; title: string; artist: string; thumbnail: string; duration: number }): Promise<Track> {
  const parsed = cleanTitle(item.title);
  const artist = parsed.artist || item.artist || "Unknown Artist";
  const title = parsed.title || item.title;
  const key = `${artist}|${title}`.toLowerCase();

  let deezer = metaCache.get(key);
  if (deezer === undefined) {
    deezer = null;
    try {
      const d = await dz("searchTrack", { query: `${artist} ${title}`, limit: 1 });
      const hit = d?.data?.[0];
      if (hit) {
        deezer = {
          id: `deezer-${hit.id}`,
          title: toTitleCase(hit.title || title),
          artist: toTitleCase(hit.artist?.name || artist),
          album: hit.album?.title || "",
          artwork: hit.album?.cover_big || hit.album?.cover_medium || "",
          duration: hit.duration || item.duration || 0,
          preview: hit.preview,
        } as Track;
      }
    } catch { /* Deezer down — Piped fallback below */ }
    metaCache.set(key, deezer);
  }

  if (deezer) return { ...deezer, youtubeId: item.videoId };

  // Piped fallback — never leave artwork/metadata blank.
  return {
    id: `yt-${item.videoId}`,
    title: toTitleCase(title),
    artist: toTitleCase(artist),
    album: "",
    artwork: item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
    duration: item.duration || 0,
    youtubeId: item.videoId,
  };
}

async function fetchPipedPlaylistTracks(id: string, limit: number): Promise<Track[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/piped-playlists?playlistId=${encodeURIComponent(id)}&limit=${limit}`,
      { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } },
    );
    if (!res.ok) return [];
    const j = await res.json();
    const items: any[] = j?.tracks || [];
    const enriched = await Promise.all(items.slice(0, limit).map((i) => enrich(i).catch(() => null)));
    return enriched.filter(Boolean) as Track[];
  } catch {
    return [];
  }
}

async function fetchDeezerPlaylistTracks(id: string, limit: number): Promise<Track[]> {
  try {
    const d = await dz("getPlaylistTracks", { playlistId: id, limit });
    return (d?.data || []).map((t: any) => ({
      id: `deezer-${t.id}`,
      title: toTitleCase(t.title || t.title_short || "Unknown"),
      artist: toTitleCase(t.artist?.name || "Unknown"),
      album: t.album?.title || "",
      artwork: t.album?.cover_big || t.album?.cover_medium || "",
      duration: t.duration || 0,
      preview: t.preview,
    })) as Track[];
  } catch {
    return [];
  }
}

/** Playlists dominated by a single artist are rejected. */
function artistDiversity(tracks: Track[]): number {
  if (!tracks.length) return 0;
  const counts = new Map<string, number>();
  for (const t of tracks) {
    const k = (t.artist || "").toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return 1 - Math.max(...counts.values()) / tracks.length;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Search + rank playlists that genuinely match the seed song. */
export async function findMatchingPlaylists(seed: Track): Promise<{ profile: SongProfile; candidates: PlaylistCandidate[] }> {
  const profile = await analyseSong(seed);
  const queries = buildQueries(profile);
  const seedKey = `${seed.artist}`.toLowerCase();
  const recentlyUsed = loadRotation()[seedKey] || [];

  // Rotate which queries we run first so results differ between plays.
  const shuffled = queries.slice().sort(() => Math.random() - 0.5);
  const pipedQueries = shuffled.slice(0, 3);
  const deezerQueries = shuffled.slice(0, 2);

  const [pipedResults, deezerResults] = await Promise.all([
    Promise.all(pipedQueries.map((q) => pipedPlaylistSearch(q, 12))),
    Promise.all(deezerQueries.map((q) => deezerPlaylistSearch(q, 8))),
  ]);

  const byId = new Map<string, PlaylistCandidate>();
  for (const c of [...pipedResults.flat(), ...deezerResults.flat()]) {
    if (!byId.has(`${c.source}:${c.id}`)) byId.set(`${c.source}:${c.id}`, c);
  }

  const candidates = Array.from(byId.values())
    .map((c) => ({ ...c, score: scoreCandidate(c, profile, recentlyUsed) }))
    .sort((a, b) => b.score - a.score);

  return { profile, candidates };
}

/**
 * Pick and load the best-matching playlist for a seed track.
 * A *fresh* search runs on every call and previously-used playlists for the
 * same artist are demoted, so the same song never keeps the same playlist.
 */
export async function discoverPlaylistForTrack(seed: Track, limit = 40): Promise<DiscoveredPlaylist | null> {
  const { candidates } = await findMatchingPlaylists(seed);
  if (!candidates.length) return null;

  const seedKey = `${seed.artist}`.toLowerCase();

  // Try the top candidates until one yields a diverse, playable tracklist.
  for (const candidate of candidates.slice(0, 5)) {
    const tracks = candidate.source === "piped"
      ? await fetchPipedPlaylistTracks(candidate.id, limit)
      : await fetchDeezerPlaylistTracks(candidate.id, limit);

    if (tracks.length < 8) continue;
    if (artistDiversity(tracks) < 0.45) continue; // too artist-dominated

    rememberUsed(seedKey, candidate.id);
    return { id: candidate.id, title: candidate.title, source: candidate.source, tracks };
  }

  // Relaxed second pass — accept the best playable list we found.
  for (const candidate of candidates.slice(0, 8)) {
    const tracks = candidate.source === "piped"
      ? await fetchPipedPlaylistTracks(candidate.id, limit)
      : await fetchDeezerPlaylistTracks(candidate.id, limit);
    if (tracks.length >= 5) {
      rememberUsed(seedKey, candidate.id);
      return { id: candidate.id, title: candidate.title, source: candidate.source, tracks };
    }
  }
  return null;
}
