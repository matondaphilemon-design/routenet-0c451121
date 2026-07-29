import { supabase } from "@/integrations/supabase/client";
import type { SectionSlot } from "@/constants/sections";

export interface ResolvedTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;
  coverBig?: string;
  streams: number;
  previewUrl?: string;
  duration?: number;
  /** When set, this is an album entity — clicking should navigate to /album/{albumId}. */
  albumId?: string;
}

export interface OnboardingData {
  name?: string;
  artists?: { id?: number; name: string }[];
  genres?: { id?: number; name: string }[];
  location?: string;
  ageRange?: string;
}

const CACHE_PREFIX = "ai_section_v2_";
const TTL = 24 * 60 * 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cacheKey(section: SectionSlot, user: OnboardingData) {
  const fp = JSON.stringify({
    a: (user.artists || []).map((a) => a.name).slice(0, 5),
    g: (user.genres || []).map((g) => g.name).slice(0, 5),
    l: user.location,
    age: user.ageRange,
  });
  return `${CACHE_PREFIX}${todayKey()}_${section.id}_${btoa(unescape(encodeURIComponent(fp))).slice(0, 24)}`;
}

function readCache(key: string): ResolvedTrack[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: ResolvedTrack[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full — clear old entries
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
      }
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* ignore */ }
  }
}

function filterExcluded(items: ResolvedTrack[], excludeIds?: string[]) {
  if (!excludeIds || excludeIds.length === 0) return items;
  const ex = new Set(excludeIds);
  return items.filter((item) => !ex.has(item.id));
}

export function clearDailySectionCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("ai_section_v1_") || k.startsWith(CACHE_PREFIX))) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

function transformDeezerTrack(t: any): ResolvedTrack {
  return {
    id: `deezer-${t.id}`,
    title: t.title,
    artist: t.artist?.name || "Unknown",
    album: t.album?.title,
    cover: t.album?.cover_medium || t.album?.cover || "/placeholder.svg",
    coverBig: t.album?.cover_big || t.album?.cover_medium,
    streams: typeof t.rank === "number" ? t.rank : (t.nb_streaming || 0),
    previewUrl: t.preview,
    duration: t.duration,
  };
}

function transformDeezerAlbum(a: any): ResolvedTrack {
  return {
    id: `album-${a.id}`,
    title: a.title,
    artist: a.artist?.name || "Unknown",
    album: a.title,
    cover: a.cover_medium || a.cover || "/placeholder.svg",
    coverBig: a.cover_big || a.cover_medium,
    streams: a.nb_tracks || 0,
    albumId: String(a.id),
  };
}

async function resolveAlbum(query: string): Promise<ResolvedTrack | null> {
  try {
    const { data } = await supabase.functions.invoke("deezer", {
      body: { action: "searchAlbum", params: { query, limit: 1 } },
    });
    const first = data?.data?.[0];
    return first ? transformDeezerAlbum(first) : null;
  } catch {
    return null;
  }
}

async function resolveOne(query: string): Promise<ResolvedTrack | null> {
  try {
    const { data } = await supabase.functions.invoke("deezer", {
      body: { action: "searchTrack", params: { query, limit: 1 } },
    });
    const first = data?.data?.[0];
    return first ? transformDeezerTrack(first) : null;
  } catch {
    return null;
  }
}

/** Direct Deezer search fallback used when AI returns no usable suggestions. */
async function searchDeezerMany(query: string, limit: number): Promise<ResolvedTrack[]> {
  try {
    const { data } = await supabase.functions.invoke("deezer", {
      body: { action: "searchTrack", params: { query, limit } },
    });
    const arr: any[] = data?.data || [];
    return arr.map(transformDeezerTrack);
  } catch {
    return [];
  }
}

async function searchDeezerAlbumsMany(query: string, limit: number): Promise<ResolvedTrack[]> {
  try {
    const { data } = await supabase.functions.invoke("deezer", {
      body: { action: "searchAlbum", params: { query, limit } },
    });
    const arr: any[] = data?.data || [];
    return arr.map(transformDeezerAlbum);
  } catch {
    return [];
  }
}

function buildFallbackQuery(section: SectionSlot, user: OnboardingData): string {
  const g = (user.genres || []).map((x) => x?.name || "").filter(Boolean);
  const a = (user.artists || []).map((x) => x?.name || "").filter(Boolean);
  const top = a[0] || "";
  const g0 = g[0] || "";
  const rule = (section.aiRule || "").toLowerCase();
  // Heuristic: combine the section title with a relevant user signal.
  if (rule.includes("my favorite") || rule.includes("my artists") || rule.includes("similar to")) {
    return [section.title, top].filter(Boolean).join(" ");
  }
  if (rule.includes("genre") || rule.includes("my preferred")) {
    return [section.title, g0].filter(Boolean).join(" ");
  }
  return [section.title, g0 || top].filter(Boolean).join(" ");
}

/**
 * Get section content via AI curation, resolved to real Deezer tracks.
 * Cached per (section + user fingerprint) for 24h.
 */
export async function getSectionContent(
  section: SectionSlot,
  user: OnboardingData,
  excludeIds?: string[],
): Promise<ResolvedTrack[]> {
  const key = cacheKey(section, user);
  const cached = readCache(key);
  if (cached && cached.length > 0) {
    const filtered = filterExcluded(cached, excludeIds);
    const minUsable = section.id === "dailyMix" ? 20 : section.contentType === "album" ? 6 : 8;
    if (filtered.length >= minUsable) return filtered;
  }

  // Album sections: resolve real Deezer albums
  if (section.contentType === "album") {
    let albums: ResolvedTrack[] = [];
    // 1) Try AI for {title, artist} album pairs
    try {
      const { data } = await supabase.functions.invoke("ai-section", {
        body: { section, user, excludeIds: excludeIds?.slice(0, 60) },
      });
      const suggestions = (data?.tracks || []) as { title: string; artist: string }[];
      if (suggestions.length > 0) {
        const sliced = suggestions.slice(0, 12);
        const results = await Promise.all(
          sliced.map((s) => resolveAlbum(`${s.title} ${s.artist}`)),
        );
        albums = results.filter(Boolean) as ResolvedTrack[];
      }
    } catch (e) {
      console.warn("ai-section (album) failed", e);
    }
    // Dedupe by albumId and section exclusions.
    const seen = new Set<string>();
    const ex = new Set(excludeIds || []);
    albums = albums.filter((a) => {
      if (!a.albumId || seen.has(a.albumId)) return false;
      if (ex.has(a.id)) return false;
      seen.add(a.albumId);
      return true;
    });
    // 2) Fallback to direct Deezer album search so the section is never empty.
    if (albums.length === 0) {
      const fb = await searchDeezerAlbumsMany(buildFallbackQuery(section, user), 12);
      const seen2 = new Set<string>();
      albums = fb.filter((a) => {
        if (!a.albumId || seen2.has(a.albumId)) return false;
        if (ex.has(a.id)) return false;
        seen2.add(a.albumId);
        return true;
      });
    }
    if (albums.length > 0) writeCache(key, albums);
    return albums;
  }

  // 1) AI suggestions
  let suggestions: { title: string; artist: string }[] = [];
  try {
    const { data, error } = await supabase.functions.invoke("ai-section", {
      body: { section, user, excludeIds: excludeIds?.slice(0, 60) },
    });
    if (error) throw error;
    suggestions = (data?.tracks || []) as { title: string; artist: string }[];
  } catch (e) {
    console.warn("ai-section failed, falling back to direct Deezer search", e);
  }

  let tracks: ResolvedTrack[] = [];

  if (suggestions.length > 0) {
    // 2) Resolve each suggestion to a real Deezer track (parallel, cap 12)
    const sliced = suggestions.slice(0, section.id === "dailyMix" ? 30 : 15);
    const results = await Promise.all(
      sliced.map((s) => resolveOne(`${s.title} ${s.artist}`)),
    );
    tracks = results.filter(Boolean) as ResolvedTrack[];
    // Filter out exclusions and dedupe
    if (excludeIds && excludeIds.length > 0) {
      const ex = new Set(excludeIds);
      tracks = tracks.filter((t) => !ex.has(t.id));
    }
  }

  // 3) Direct Deezer fallback — guarantees the section has data even when AI fails.
  if (tracks.length === 0) {
    const q = buildFallbackQuery(section, user);
    const wanted = section.id === "dailyMix" ? 30 : 15;
    const fb = await searchDeezerMany(q, wanted);
    const ex = new Set(excludeIds || []);
    tracks = fb.filter((t) => !ex.has(t.id));
  }

  if (tracks.length > 0) writeCache(key, tracks);
  return tracks;
}