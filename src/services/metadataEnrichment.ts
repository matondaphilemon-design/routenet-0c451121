/**
 * Shared Deezer metadata enrichment.
 *
 * Playback always stays on the YouTube/Piped id. Deezer is used only to
 * upgrade presentation: title, artist, album, high-resolution artwork,
 * release date and the explicit flag. Every lookup is cached (memory +
 * localStorage) and concurrency-limited so a homepage row never fires
 * dozens of parallel requests.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/data/mockData";
import { toTitleCase } from "@/utils/toTitleCase";

export interface DeezerMeta {
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  explicit?: boolean;
  releaseDate?: string;
  artistPicture?: string;
}

const CACHE_PREFIX = "routenet.dzmeta.v1:";
const TTL = 7 * 24 * 60 * 60 * 1000;
const memory = new Map<string, DeezerMeta | null>();

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const stripNoise = (s: string) =>
  String(s || "")
    .replace(/[\(\[][^\)\]]*(official|lyric|lyrics|audio|video|visualizer|hd|4k|mv|remaster[^\)\]]*)[^\)\]]*[\)\]]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

function keyOf(title: string, artist: string) {
  return `${norm(artist)}::${norm(title)}`;
}

function readCache(key: string): DeezerMeta | null | undefined {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt < Date.now()) return undefined;
    memory.set(key, parsed.value);
    return parsed.value as DeezerMeta | null;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: DeezerMeta | null) {
  memory.set(key, value);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, expiresAt: Date.now() + TTL }));
  } catch { /* quota */ }
}

function mapTrack(t: any): DeezerMeta {
  return {
    title: t?.title || "",
    artist: t?.artist?.name || "",
    album: t?.album?.title || "",
    artwork: t?.album?.cover_xl || t?.album?.cover_big || t?.album?.cover_medium || t?.album?.cover || "",
    duration: Number(t?.duration) || 0,
    explicit: Boolean(t?.explicit_lyrics),
    releaseDate: t?.release_date,
    artistPicture: t?.artist?.picture_xl || t?.artist?.picture_big || "",
  };
}

async function deezerSearch(query: string, limit = 8): Promise<any[]> {
  try {
    const { data, error } = await supabase.functions.invoke("deezer", {
      body: { action: "searchTrack", params: { query, limit } },
    });
    if (error) return [];
    return (data?.data || []) as any[];
  } catch {
    return [];
  }
}

/** Pick the Deezer row that actually matches the requested title + artist. */
function bestMatch(rows: any[], title: string, artist: string): DeezerMeta | null {
  if (!rows.length) return null;
  const t = norm(stripNoise(title));
  const a = norm(artist);
  const metas = rows.map(mapTrack).filter((m) => m.title);
  const exact = metas.find((m) => norm(m.title) === t && norm(m.artist) === a);
  if (exact) return exact;
  const titleOnly = metas.find((m) => norm(m.title) === t);
  if (titleOnly && (!a || norm(titleOnly.artist).includes(a) || a.includes(norm(titleOnly.artist)))) return titleOnly;
  const loose = metas.find(
    (m) => (t.includes(norm(m.title)) || norm(m.title).includes(t)) && (!a || norm(m.artist) === a),
  );
  return loose || null;
}

/** Look up Deezer metadata for one title/artist pair. */
export async function lookupMeta(title: string, artist: string): Promise<DeezerMeta | null> {
  const clean = stripNoise(title);
  if (!clean) return null;
  const key = keyOf(clean, artist);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const rows = await deezerSearch(`${artist ? artist + " " : ""}${clean}`.trim(), 8);
  let match = bestMatch(rows, clean, artist);
  if (!match) {
    const rows2 = await deezerSearch(clean, 8);
    match = bestMatch(rows2, clean, artist);
  }
  writeCache(key, match);
  return match;
}

function apply(track: Track, meta: DeezerMeta | null): Track {
  if (!meta) {
    return {
      ...track,
      artwork: track.artwork || (track.youtubeId ? `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg` : "/placeholder.svg"),
    };
  }
  return {
    ...track,
    title: toTitleCase(meta.title || track.title),
    artist: toTitleCase(meta.artist || track.artist),
    album: meta.album || track.album,
    artwork: meta.artwork || track.artwork,
    duration: track.duration || meta.duration,
    ...(meta.explicit !== undefined ? { explicit: meta.explicit } : {}),
    ...(meta.releaseDate ? { releaseDate: meta.releaseDate } : {}),
  } as Track;
}

/** Enrich a single track (used by the player). */
export async function enrichTrack(track: Track): Promise<Track> {
  if (!track) return track;
  const meta = await lookupMeta(track.title, track.artist).catch(() => null);
  return apply(track, meta);
}

/**
 * Enrich a list of tracks with bounded concurrency. Anything that fails or
 * has no Deezer match keeps its YouTube metadata, so nothing renders blank.
 */
export async function enrichTracks(tracks: Track[], concurrency = 6): Promise<Track[]> {
  if (!tracks?.length) return tracks || [];
  const out = tracks.slice();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tracks.length) }, async () => {
    while (cursor < tracks.length) {
      const i = cursor++;
      const meta = await lookupMeta(tracks[i].title, tracks[i].artist).catch(() => null);
      out[i] = apply(tracks[i], meta);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Synchronous read for already-cached metadata (no network). */
export function peekMeta(title: string, artist: string): DeezerMeta | null | undefined {
  return readCache(keyOf(stripNoise(title), artist));
}
