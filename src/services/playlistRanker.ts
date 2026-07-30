/**
 * Playlist ranking + selection.
 *
 * Candidates come from Deezer playlist search (multiple genre-driven queries).
 * Each candidate is scored on genre relevance (40), editorial quality (20),
 * popularity (15), recency (10) and a random diversity factor (15).
 * Playlists already played (localStorage `played_playlists`, max 50) are
 * excluded. The winner is a weighted-random pick from the top 5.
 */
import type { Track } from "@/data/mockData";
import { toTitleCase } from "@/utils/toTitleCase";
import { similarGenreTerms } from "@/constants/genreArtists";
import { detectGenre, fetchDeezer } from "./genreDetector";

export interface RankedPlaylist {
  id: string;
  deezerId: string;
  title: string;
  cover: string;
  creator: string;
  trackCount: number;
  genre: string;
  score: number;
}

export interface RecommendedPlaylist extends RankedPlaylist {
  tracks: Track[];
}

const HISTORY_KEY = "played_playlists";
const MAX_HISTORY = 50;

export function getPlayedPlaylists(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

export function addPlayedPlaylist(playlistId: string) {
  try {
    const history = getPlayedPlaylists().filter((id) => id !== playlistId);
    history.push(playlistId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch { /* storage disabled */ }
}

export function clearPlayedPlaylists() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
}

const OFFICIAL_KEYWORDS = ["official", "editorial", "top", "trending", "hits", "essentials", "best", "classic", "selection"];
const JUNK_KEYWORDS = ["karaoke", "lyrics", "cover", "sped up", "slowed", "nightcore", "8d", "type beat", "instrumental"];
const YEAR = new Date().getFullYear();

/** Score a playlist candidate for a detected genre. */
export function scorePlaylist(playlist: RankedPlaylist, genre: string, userHistory: string[]): number {
  const titleLower = `${playlist.title} ${playlist.creator}`.toLowerCase();
  const g = genre.toLowerCase();
  let score = 0;

  // 1. Genre relevance (40%)
  if (titleLower.includes(g)) {
    score += 40;
  } else {
    const terms = similarGenreTerms[g] || [];
    for (const term of terms) {
      if (titleLower.includes(term)) { score += 22; break; }
    }
  }

  // 2. Official / editorial quality (20%)
  let officialScore = 0;
  for (const kw of OFFICIAL_KEYWORDS) if (titleLower.includes(kw)) officialScore += 4;
  if (/deezer|editorial|official/i.test(playlist.creator)) officialScore += 8;
  score += Math.min(officialScore, 20);

  // 3. Popularity (15%) — track count
  score += Math.min(playlist.trackCount / 10, 15);

  // 4. Recency (10%) — current/recent year signals in the title
  if (titleLower.includes(String(YEAR))) score += 10;
  else if (titleLower.includes(String(YEAR - 1))) score += 6;
  else if (/\b20\d\d\b/.test(titleLower)) score += 2;

  // Junk penalty
  for (const kw of JUNK_KEYWORDS) if (titleLower.includes(kw)) score -= 25;

  // 5. User history exclusion
  if (userHistory.includes(playlist.id)) score -= 1000;

  // 6. Diversity factor (15%)
  score += Math.random() * 15;

  return score;
}

function buildQueries(genre: string, artist: string): string[] {
  const g = genre === "Unknown" ? "" : genre;
  const terms = similarGenreTerms[g.toLowerCase()] || [];
  return Array.from(new Set([
    g ? `${g} playlist` : "",
    g ? `${g} hits ${YEAR}` : "",
    g ? `${g} essentials` : "",
    g ? `best ${g} mix` : "",
    terms[1] ? `${terms[1]} playlist` : "",
    terms[2] ? `${terms[2]} mix` : "",
    artist ? `artists like ${artist}` : "",
    artist ? `${artist} radio` : "",
  ].filter(Boolean))) as string[];
}

async function searchDeezerPlaylists(query: string, limit = 20): Promise<RankedPlaylist[]> {
  try {
    const res = await fetchDeezer("searchPlaylist", { query, limit });
    return (res?.data || [])
      .filter((p: any) => p?.id)
      .map((p: any) => ({
        id: `dz_${p.id}`,
        deezerId: String(p.id),
        title: String(p.title || "Playlist"),
        cover: p.picture_big || p.picture_medium || p.picture || "",
        creator: p.user?.name || p.creator?.name || "Deezer",
        trackCount: Number(p.nb_tracks) || 0,
        genre: "",
        score: 0,
      }));
  } catch { return []; }
}

export async function fetchPlaylistTracks(deezerId: string, limit = 50): Promise<Track[]> {
  try {
    const res = await fetchDeezer("getPlaylistTracks", { playlistId: deezerId, limit });
    return (res?.data || [])
      .filter((t: any) => t?.id)
      .map((t: any) => ({
        id: `deezer-${t.id}`,
        title: toTitleCase(t.title || t.title_short || "Unknown"),
        artist: toTitleCase(t.artist?.name || "Unknown"),
        album: t.album?.title || "",
        artwork: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "",
        duration: t.duration || 0,
        preview: t.preview,
      })) as Track[];
  } catch { return []; }
}

/** Playlists dominated by a single artist are poor recommendations. */
function artistDiversity(tracks: Track[]): number {
  if (!tracks.length) return 0;
  const counts = new Map<string, number>();
  for (const t of tracks) {
    const k = (t.artist || "").toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return 1 - Math.max(...counts.values()) / tracks.length;
}

/** Rank playlists for a song without loading their tracks. */
export async function rankPlaylistsForSong(songTitle: string, songArtist: string) {
  const genre = await detectGenre(songArtist, songTitle);
  const userHistory = getPlayedPlaylists();
  const queries = buildQueries(genre, songArtist);

  const results = await Promise.all(queries.slice(0, 6).map((q) => searchDeezerPlaylists(q, 20)));
  const byId = new Map<string, RankedPlaylist>();
  for (const p of results.flat()) if (!byId.has(p.id)) byId.set(p.id, { ...p, genre });

  const all = Array.from(byId.values());
  const genreMatches = all.filter((p) => p.title.toLowerCase().includes(genre.toLowerCase()));
  const candidates = genreMatches.length >= 5 ? genreMatches : all;

  const scored = candidates
    .map((p) => ({ ...p, score: scorePlaylist(p, genre, userHistory) }))
    .filter((p) => p.score > -500) // hard-exclude already played
    .sort((a, b) => b.score - a.score);

  return { genre, scored, fallback: all };
}

/** Weighted-random pick from the top N candidates. */
function weightedPick(list: RankedPlaylist[], top = 5): RankedPlaylist | null {
  const pool = list.slice(0, top);
  if (!pool.length) return null;
  const min = Math.min(...pool.map((p) => p.score));
  const offset = min <= 0 ? Math.abs(min) + 1 : 0;
  const total = pool.reduce((s, p) => s + p.score + offset, 0);
  let rand = Math.random() * total;
  for (const p of pool) {
    rand -= p.score + offset;
    if (rand <= 0) return p;
  }
  return pool[0];
}

/**
 * Main entry point: recommend a fresh, genre-relevant playlist for a song.
 * Never returns a playlist already in the user's played history (unless the
 * history has exhausted every candidate).
 */
export async function recommendPlaylist(
  songTitle: string,
  songArtist: string,
  trackLimit = 50,
): Promise<RecommendedPlaylist | null> {
  const { scored, fallback, genre } = await rankPlaylistsForSong(songTitle, songArtist);
  const pools = scored.length ? [scored] : [fallback.map((p) => ({ ...p, score: Math.random() * 15 }))];

  for (const pool of pools) {
    const attempted = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const remaining = pool.filter((p) => !attempted.has(p.id));
      const picked = weightedPick(remaining, 5);
      if (!picked) break;
      attempted.add(picked.id);
      const tracks = await fetchPlaylistTracks(picked.deezerId, trackLimit);
      if (tracks.length < 8) continue;
      if (artistDiversity(tracks) < 0.4) continue;
      addPlayedPlaylist(picked.id);
      return { ...picked, genre, tracks };
    }
  }
  return null;
}
