/**
 * Unified search engine.
 *
 *   Playback source : YouTube via Piped (primary)
 *   Metadata source : Deezer (artwork, album, genre, release date, explicit)
 *   Metadata fallback: the Piped result itself (thumbnail, title, channel)
 *
 * Piped and Deezer are queried in parallel so metadata enrichment never
 * delays playback, and results are cached locally to avoid repeat lookups.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/data/mockData";
import { toTitleCase } from "@/utils/toTitleCase";

export interface SearchTrack extends Track {
  /** Where the audio comes from. */
  playbackSource: "piped" | "deezer";
  /** Whether Deezer metadata was matched. */
  enriched: boolean;
  explicit?: boolean;
  releaseDate?: string;
  genre?: string;
}

const CACHE_PREFIX = "routenet.search.v1:";
const CACHE_TTL = 30 * 60 * 1000;

function readCache(key: string): SearchTrack[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt < Date.now()) return null;
    return parsed.value as SearchTrack[];
  } catch { return null; }
}

function writeCache(key: string, value: SearchTrack[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, expiresAt: Date.now() + CACHE_TTL }));
  } catch { /* quota */ }
}

const NOISE = /\s*[\(\[](official|lyric|lyrics|audio|video|visualizer|hd|4k|mv|m\/v|explicit|prod\.?[^\)\]]*)[^\)\]]*[\)\]]\s*/gi;

function cleanTitle(raw: string): string {
  return String(raw || "")
    .replace(NOISE, " ")
    .replace(/\s*[-–|]\s*(official\s*)?(music\s*)?(video|audio|lyrics?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function splitTitle(rawTitle: string, channel: string): { title: string; artist: string } {
  const cleaned = cleanTitle(rawTitle);
  const parts = cleaned.split(/\s+[-–—]\s+/);
  const uploader = String(channel || "").replace(/\s*-\s*Topic$/i, "").trim();
  if (parts.length > 1) {
    return { title: parts.slice(1).join(" - ").trim(), artist: parts[0].trim() };
  }
  return { title: cleaned, artist: uploader || "Unknown" };
}

// ---------------------------------------------------------------------------
// Step 1 — Piped (primary, playable)
// ---------------------------------------------------------------------------

/**
 * Search Engine V2 — Piped is the primary source and everything returned must
 * be playable. Filtering is deliberately light: only obvious non-songs are
 * dropped (karaoke, ringtones, reactions, hour loops), so real releases,
 * remixes and live versions all stay in the list. Ranking does the rest.
 */
const JUNK_TITLE = /(karaoke|ringtone|reaction|1\s*hour|hour version|type beat|full album|album mix|mixtape mix|dj set|compilation)/i;
const JUNK_CHANNEL = /(karaoke|no copyright|type beat)/i;
const OFFICIAL_CHANNEL = /(vevo|- topic|official|records|music)/i;

function isJunk(rawTitle: string, channel: string): boolean {
  return JUNK_TITLE.test(String(rawTitle || "")) || JUNK_CHANNEL.test(String(channel || ""));
}

async function searchPiped(query: string, limit: number): Promise<SearchTrack[]> {
  const { data, error } = await supabase.functions.invoke("youtube", {
    body: { action: "search", params: { query, maxResults: limit + 20 } },
  });
  if (error) return [];
  const items: any[] = data?.items || data?.results || data?.videos || [];
  const mapped = items
    .filter((v) => v?.id)
    .filter((v) => !isJunk(v.title, v.channelTitle))
    .map((v) => {
      const { title, artist } = splitTitle(v.title, v.channelTitle);
      const duration = typeof v.duration === "number" ? v.duration : Number(v.duration) || 0;
      const channel = String(v.channelTitle || "");
      return {
        id: `yt-${v.id}`,
        youtubeId: v.id,
        title: toTitleCase(title),
        artist: toTitleCase(artist),
        album: "",
        artwork: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        duration,
        playbackSource: "piped",
        enriched: false,
        // Relevance helpers (not rendered).
        __official: OFFICIAL_CHANNEL.test(channel),
        __views: Number(v.views) || 0,
      } as SearchTrack & { __official: boolean; __views: number };
    })
    // Songs only — drop anything shorter than 45s or longer than 15 min.
    .filter((t) => !t.duration || (t.duration >= 45 && t.duration <= 900));

  // Remove duplicate uploads of the same song (same title + artist).
  const seen = new Set<string>();
  const unique = mapped.filter((t) => {
    const key = `${norm(t.artist)}::${norm(t.title)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Relevance first: title/artist match, then official uploads, then reach.
  const q = norm(query);
  return unique
    .sort((a: any, b: any) => {
      const rel = (t: any) => {
        const title = norm(t.title);
        const artist = norm(t.artist);
        let s = 0;
        if (title === q || artist === q) s += 60;
        else if (title.startsWith(q) || artist.startsWith(q)) s += 45;
        else if (title.includes(q) || artist.includes(q)) s += 30;
        if (t.__official) s += 20;
        s += Math.min(Math.log10(Math.max(t.__views, 1)) * 4, 24);
        return s;
      };
      return rel(b) - rel(a);
    })
    .slice(0, limit);
}


// ---------------------------------------------------------------------------
// Step 2 — Deezer metadata (artwork, album, genre, release date, explicit)
// ---------------------------------------------------------------------------
interface DeezerMeta {
  artwork: string;
  album: string;
  artist: string;
  title: string;
  duration: number;
  explicit?: boolean;
  releaseDate?: string;
}

async function fetchDeezerMeta(query: string, limit: number): Promise<DeezerMeta[]> {
  const { data, error } = await supabase.functions.invoke("deezer", {
    body: { action: "searchTrack", params: { query, limit } },
  });
  if (error) return [];
  return ((data?.data || []) as any[]).map((t) => ({
    artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "",
    album: t.album?.title || "",
    artist: t.artist?.name || "",
    title: t.title || "",
    duration: t.duration || 0,
    explicit: Boolean(t.explicit_lyrics),
    releaseDate: t.release_date,
  }));
}

/** Attach the best Deezer match to each Piped result. */
function enrich(tracks: SearchTrack[], meta: DeezerMeta[]): SearchTrack[] {
  if (!meta.length) return tracks;
  return tracks.map((t) => {
    const tt = norm(t.title);
    const ta = norm(t.artist);
    const match =
      meta.find((m) => norm(m.title) === tt && norm(m.artist) === ta) ||
      meta.find((m) => norm(m.title) === tt) ||
      meta.find((m) => tt.includes(norm(m.title)) && norm(m.artist) === ta);
    if (!match) return t; // graceful fallback: keep Piped metadata
    return {
      ...t,
      // Playback stays on the Piped result; only presentation is upgraded.
      title: toTitleCase(match.title || t.title),
      artist: toTitleCase(match.artist || t.artist),
      album: match.album || t.album,
      artwork: match.artwork || t.artwork,
      duration: t.duration || match.duration,
      explicit: match.explicit,
      releaseDate: match.releaseDate,
      enriched: true,
    };
  });
}

/**
 * Full pipeline: Piped for playable results, Deezer for polish, Piped again
 * as the metadata fallback. Never returns an empty artwork field.
 */
export async function searchTracksUnified(query: string, limit = 24): Promise<SearchTrack[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cacheKey = `${q.toLowerCase()}:${limit}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const [piped, meta] = await Promise.all([
    searchPiped(q, limit).catch(() => [] as SearchTrack[]),
    fetchDeezerMeta(q, Math.min(limit, 25)).catch(() => [] as DeezerMeta[]),
  ]);

  let results = enrich(piped, meta);

  // Deezer-only rows are intentionally NOT shown in search: every result must
  // be playable, so Deezer is used purely as a metadata layer over Piped.


  // Guarantee artwork.
  results = results.map((t) => ({
    ...t,
    artwork: t.artwork || (t.youtubeId ? `https://i.ytimg.com/vi/${t.youtubeId}/hqdefault.jpg` : "/placeholder.svg"),
  }));

  if (results.length) writeCache(cacheKey, results);
  return results;
}
