/**
 * Home Feed Engine — produces an ordered list of section descriptors and
 * lazy-loads each section's content from AI + Deezer.
 *
 * Every section is content-typed (songs / albums / playlists / artists) so the
 * renderer can pick the right card. A single interleaver rearranges the list
 * so we never place two same-kind sections back to back and so per-artist
 * sections are spread across the feed instead of clumped.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/data/mockData";
import {
  transformTrack, transformAlbum, transformPlaylist, transformArtist,
} from "@/services/deezer";
import { getTopSignalArtists } from "@/services/tasteEvents";
import { cached } from "@/services/homeCache";

import type { FeedVideo } from "@/components/home/cards/UnifiedCards";

export type SectionKind = "songs" | "albums" | "playlists" | "artists" | "mix" | "songlist" | "videos";

export interface SectionResult {
  /** Optional runtime title override (used by dataset-driven sections). */
  title?: string;
  songs?: Track[];
  albums?: { id: number; title: string; cover: string; artist: string }[];
  playlists?: { id: number; title: string; cover: string; creator?: string; description?: string }[];
  artists?: { id: number; name: string; picture: string; fans?: number }[];
  videos?: FeedVideo[];
}


export interface SectionDescriptor {
  id: string;
  title: string;
  subtitle?: string;
  kind: SectionKind;
  load: () => Promise<SectionResult>;
}

async function dz(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("deezer", { body: { action, params } });
  if (error) throw error;
  return data;
}

const TTL_DEEZER = 30 * 60 * 1000;
const TTL_AI = 2 * 60 * 60 * 1000;

// -------- Deezer-backed loaders --------
async function loadChartTracks(limit = 20): Promise<SectionResult> {
  return cached(`chart:tracks:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getChart", { type: "tracks", limit });
    return { songs: (d?.data || d?.tracks?.data || []).map(transformTrack) };
  });
}
async function loadChartAlbums(limit = 20): Promise<SectionResult> {
  return cached(`chart:albums:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getChart", { type: "albums", limit });
    return { albums: (d?.data || d?.albums?.data || []).map(transformAlbum) };
  });
}
async function loadChartArtists(limit = 20): Promise<SectionResult> {
  return cached(`chart:artists:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getChart", { type: "artists", limit });
    return { artists: (d?.data || d?.artists?.data || []).map(transformArtist) };
  });
}
async function loadChartPlaylists(limit = 20): Promise<SectionResult> {
  return cached(`chart:playlists:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getChart", { type: "playlists", limit });
    return { playlists: (d?.data || d?.playlists?.data || []).map(transformPlaylist) };
  });
}
async function loadEditorialReleases(limit = 20): Promise<SectionResult> {
  return cached(`editorial:releases:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getEditorialReleases", { limit });
    return { albums: (d?.data || []).map(transformAlbum) };
  });
}
async function loadEditorialPlaylists(limit = 20): Promise<SectionResult> {
  return cached(`editorial:playlists:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getEditorialPlaylists", { limit });
    return { playlists: (d?.data || []).map(transformPlaylist) };
  });
}
async function loadGenreTracks(genreId: number | string, limit = 20): Promise<SectionResult> {
  return cached(`genre:${genreId}:tracks:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getGenreTracks", { genreId, limit });
    return { songs: (d?.data || d?.tracks?.data || []).map(transformTrack) };
  });
}
async function loadGenreArtists(genreId: number | string, limit = 20): Promise<SectionResult> {
  return cached(`genre:${genreId}:artists:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("getGenreArtists", { genreId, limit });
    return { artists: (d?.data || []).map(transformArtist) };
  });
}
/** YouTube music videos for the video rows on the homepage. */
async function loadYouTubeVideos(query: string, limit = 12): Promise<SectionResult> {
  return cached(`yt:videos:${query}:${limit}`, TTL_DEEZER, async () => {
    const { data } = await supabase.functions.invoke("youtube", {
      body: { action: "search", params: { query, maxResults: limit } },
    });
    const items: any[] = data?.items || data?.results || data?.videos || (Array.isArray(data) ? data : []);
    return {
      videos: items
        .filter((v) => v?.id)
        .map((v) => ({
          id: `ytv-${v.id}`,
          videoId: v.id,
          title: v.title || "",
          artist: (v.channelTitle || "YouTube").replace(/\s*-\s*Topic$/i, ""),
          thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          duration: Number(v.duration) || 0,
          views: Number(v.views) || undefined,
          publishedAt: v.publishedAt,
        })),
    };
  });
}

async function loadArtistTop(artistName: string, limit = 15): Promise<SectionResult> {
  return cached(`artist:${artistName}:top:${limit}`, TTL_DEEZER, async () => {
    const search = await dz("searchArtist", { name: artistName, limit: 1 });
    const id = search?.data?.[0]?.id;
    if (!id) return { songs: [] };
    const d = await dz("getArtistTopTracks", { artistId: id, limit });
    return { songs: (d?.data || []).map(transformTrack) };
  });
}
async function loadArtistAlbums(artistName: string, limit = 15): Promise<SectionResult> {
  return cached(`artist:${artistName}:albums:${limit}`, TTL_DEEZER, async () => {
    const search = await dz("searchArtist", { name: artistName, limit: 1 });
    const id = search?.data?.[0]?.id;
    if (!id) return { albums: [] };
    const d = await dz("getArtistAlbums", { artistId: id, limit });
    return { albums: (d?.data || []).map(transformAlbum) };
  });
}
async function loadArtistRadio(artistName: string, limit = 20): Promise<SectionResult> {
  return cached(`artist:${artistName}:radio:${limit}`, TTL_DEEZER, async () => {
    const search = await dz("searchArtist", { name: artistName, limit: 1 });
    const id = search?.data?.[0]?.id;
    if (!id) return { songs: [] };
    const d = await dz("getArtistRadio", { artistId: id, limit });
    return { songs: (d?.data || []).map(transformTrack) };
  });
}
async function loadArtistRelated(artistName: string, limit = 15): Promise<SectionResult> {
  return cached(`artist:${artistName}:related:${limit}`, TTL_DEEZER, async () => {
    const search = await dz("searchArtist", { name: artistName, limit: 1 });
    const id = search?.data?.[0]?.id;
    if (!id) return { artists: [] };
    const d = await dz("getArtistRelated", { artistId: id, limit });
    return { artists: (d?.data || []).map(transformArtist) };
  });
}
async function loadArtistPlaylists(artistName: string, limit = 15): Promise<SectionResult> {
  return cached(`artist:${artistName}:playlists:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("searchPlaylist", { query: artistName, limit });
    return { playlists: (d?.data || []).map(transformPlaylist) };
  });
}
async function loadSearchTracks(query: string, limit = 20): Promise<SectionResult> {
  return cached(`search:tracks:${query}:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("searchTrack", { query, limit });
    return { songs: (d?.data || []).map(transformTrack) };
  });
}
async function loadSearchPlaylists(query: string, limit = 15): Promise<SectionResult> {
  return cached(`search:playlists:${query}:${limit}`, TTL_DEEZER, async () => {
    const d = await dz("searchPlaylist", { query, limit });
    return { playlists: (d?.data || []).map(transformPlaylist) };
  });
}

// -------- Live fallback loaders (no bundled dataset) --------
// Everything is fetched from the live APIs; nothing is shipped statically.
async function loadDatasetPopular(index: number, limit = 15): Promise<SectionResult> {
  return loadChartTracks(limit + index);
}
async function loadDatasetMood(mood: string, limit = 15): Promise<SectionResult> {
  return loadSearchTracks(`${mood} mix`, limit);
}
async function loadDatasetGenre(genre: string, limit = 15): Promise<SectionResult> {
  return loadSearchTracks(`${genre} hits`, limit);
}
async function loadDatasetForArtists(artists: string[], limit = 15): Promise<SectionResult> {
  if (!artists.length) return loadChartTracks(limit);
  return loadArtistRadio(artists[Math.floor(Math.random() * artists.length)], limit);
}
async function loadDatasetSeed(seed: Track, limit = 15): Promise<SectionResult> {
  return loadSearchTracks(`${seed.artist} mix`, limit);
}
async function loadDatasetTaste(genres: string[], limit = 15): Promise<SectionResult> {
  if (!genres.length) return loadChartTracks(limit);
  return loadSearchTracks(`${genres[0]} top songs`, limit);
}

/**
 * Wraps a live loader so the curated dataset takes over whenever the API
 * fails or returns nothing.
 */
function withDatasetFallback(
  primary: () => Promise<SectionResult>,
  fallback: () => Promise<SectionResult>,
): () => Promise<SectionResult> {
  return async () => {
    try {
      const res = await primary();
      const count =
        (res.songs?.length ?? 0) + (res.albums?.length ?? 0) +
        (res.playlists?.length ?? 0) + (res.artists?.length ?? 0);
      if (count > 0) return res;
    } catch { /* fall through */ }
    try { return await fallback(); } catch { return {}; }
  };
}


// -------- Taste-driven Deezer loaders (no AI) --------
/**
 * A personal mix built purely from Deezer: rotate through the artists the
 * user follows (plus the artists they actually listen to) and blend their
 * radios together. Falls back to the curated dataset when Deezer is down.
 */
async function loadTasteMix(
  key: string,
  seeds: string[],
  limit = 25,
  offset = 0,
): Promise<SectionResult> {
  const pool = Array.from(new Set([...seeds, ...getTopSignalArtists(8)])).filter(Boolean);
  if (!pool.length) return loadChartTracks(limit);
  const chosen = [0, 1, 2].map((i) => pool[(offset + i) % pool.length]).filter(Boolean);
  return cached(`taste:${key}:${chosen.join("|")}:${limit}`, TTL_DEEZER, async () => {
    const results = await Promise.all(
      Array.from(new Set(chosen)).map((name) => loadArtistRadio(name, Math.ceil(limit / chosen.length) + 6).catch(() => ({ songs: [] }))),
    );
    const seen = new Set<string>();
    const songs: Track[] = [];
    // Round-robin so no single artist dominates the row.
    const lists = results.map((r) => r.songs ?? []);
    for (let i = 0; songs.length < limit; i++) {
      let added = false;
      for (const list of lists) {
        const t = list[i];
        if (!t || seen.has(t.id)) continue;
        seen.add(t.id);
        songs.push(t);
        added = true;
        if (songs.length >= limit) break;
      }
      if (!added) break;
    }
    return { songs };
  });
}

/** Songs from artists related to what the user loves. */
async function loadRelatedArtistSongs(seeds: string[], limit = 20, offset = 0): Promise<SectionResult> {
  const pool = Array.from(new Set([...seeds, ...getTopSignalArtists(6)])).filter(Boolean);
  if (!pool.length) return loadChartTracks(limit);
  const anchor = pool[offset % pool.length];
  return cached(`related-songs:${anchor}:${limit}`, TTL_DEEZER, async () => {
    const related = await loadArtistRelated(anchor, 6);
    const names = (related.artists ?? []).map((a) => a.name).slice(0, 4);
    if (!names.length) return loadArtistTop(anchor, limit);
    const results = await Promise.all(names.map((n) => loadArtistTop(n, 6).catch(() => ({ songs: [] }))));
    const seen = new Set<string>();
    const songs: Track[] = [];
    for (const r of results) {
      for (const t of r.songs ?? []) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        songs.push(t);
      }
    }
    return { songs: songs.slice(0, limit) };
  });
}


// -------- Section catalog --------
export interface FeedInput {
  followedArtists: string[];
  followedGenres: { id: number | string; name: string }[];
  recentSeed?: Track | null;
}

function pool<T>(arr: T[]): T[] { return arr.filter(Boolean); }

function globalSections(input: FeedInput): SectionDescriptor[] {
  const { followedArtists, followedGenres, recentSeed } = input;
  const primaryArtist = followedArtists[0];
  const primaryGenre = followedGenres[0];
  const secondaryGenre = followedGenres[1] ?? followedGenres[0];
  const tertiaryGenre = followedGenres[2] ?? followedGenres[0];
  const genreNames = followedGenres.map((g) => g.name);

  /**
   * Trending / charts are scoped to the genres the user picked. Only when the
   * user has no genres at all do we fall back to the global Deezer chart.
   */
  const trending = (limit: number, genreIndex = 0) => {
    const g = followedGenres[genreIndex % Math.max(followedGenres.length, 1)];
    return g
      ? withDatasetFallback(() => loadGenreTracks(g.id, limit), () => loadDatasetGenre(g.name, 15))
      : withDatasetFallback(() => loadChartTracks(limit), () => loadDatasetPopular(0, 15));
  };
  const genreArtists = (limit: number, genreIndex = 0) => {
    const g = followedGenres[genreIndex % Math.max(followedGenres.length, 1)];
    return g ? () => loadGenreArtists(g.id, limit) : () => loadChartArtists(limit);
  };
  const genreQuery = (suffix: string) =>
    `${genreNames[0] ? genreNames[0] + " " : ""}${suffix}`.trim();

  return pool<SectionDescriptor | null>([
    // ---- Personal, taste-driven (Deezer artist radios) ----
    { id: "made-for-you", title: "Made For You", subtitle: "Built from the artists you love", kind: "songs",
      load: withDatasetFallback(() => loadTasteMix("made-for-you", followedArtists, 25, 0), () => loadDatasetForArtists(followedArtists, 15)) },
    { id: "daily-mix", title: "Your Daily Mix", subtitle: "A fresh blend every day", kind: "songs",
      load: withDatasetFallback(() => loadTasteMix("daily-mix", followedArtists, 25, 1), () => loadDatasetTaste(genreNames, 15)) },
    { id: "daily-mix-2", title: "Daily Mix 2", subtitle: "Another corner of your taste", kind: "songs",
      load: withDatasetFallback(() => loadTasteMix("daily-mix-2", followedArtists, 25, 2), () => loadDatasetTaste(genreNames, 15)) },
    recentSeed && { id: "because-you-played", title: `Because You Played ${recentSeed.artist}`, subtitle: "More in that vibe", kind: "songs",
      load: withDatasetFallback(() => loadArtistRadio(recentSeed.artist, 25), () => loadDatasetSeed(recentSeed, 15)) },
    { id: "similar-favorites", title: "Similar To Your Favorites", subtitle: "Artists close to what you love", kind: "songs",
      load: withDatasetFallback(() => loadRelatedArtistSongs(followedArtists, 20, 0), () => loadDatasetForArtists(followedArtists, 15)) },
    { id: "fresh-discoveries", title: "Fresh Discoveries", subtitle: "New sounds in your lane", kind: "songs",
      load: withDatasetFallback(() => loadRelatedArtistSongs(followedArtists, 20, 1), () => loadDatasetTaste(genreNames, 15)) },
    { id: "missed", title: "Songs You Might Have Missed", subtitle: "From your favorite artists", kind: "songs",
      load: withDatasetFallback(() => loadTasteMix("missed", followedArtists, 20, 3), () => loadDatasetForArtists(followedArtists, 15)) },

    // ---- Deezer catalog: trending, charts, releases, editorial ----
    { id: "trending-songs", title: primaryGenre ? `Trending in ${primaryGenre.name}` : "Trending Now", subtitle: "Climbing right now", kind: "songs",
      load: trending(20, 0) },
    { id: "top-songs", title: secondaryGenre ? `Top ${secondaryGenre.name}` : "Top Songs", subtitle: "What everyone's playing", kind: "songs",
      load: trending(20, 1) },
    { id: "genre-charts", title: tertiaryGenre ? `${tertiaryGenre.name} Charts` : "Global Charts", kind: "songs",
      load: trending(20, 2) },
    { id: "new-releases", title: "New Releases", subtitle: "Fresh on Deezer", kind: "albums",
      load: () => loadEditorialReleases(20) },
    { id: "featured-albums", title: "Featured Albums", kind: "albums",
      load: () => loadChartAlbums(20) },
    { id: "recommended-albums", title: "Recommended Albums", subtitle: primaryArtist ? `Because you follow ${primaryArtist}` : undefined, kind: "albums",
      load: primaryArtist ? () => loadArtistAlbums(primaryArtist, 20) : () => loadChartAlbums(20) },
    { id: "popular-playlists", title: "Popular Playlists", kind: "playlists",
      load: () => loadChartPlaylists(20) },
    { id: "editors-picks", title: "Editorial Picks", subtitle: "Curated by Deezer editors", kind: "playlists",
      load: () => loadEditorialPlaylists(20) },
    { id: "genre-playlists", title: primaryGenre ? `${primaryGenre.name} Playlists` : "Genre Playlists", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("playlist"), 20) },
    { id: "featured-collections", title: "Featured Collections", subtitle: "Hand-picked collections", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("essentials"), 20) },

    // ---- Artists ----
    { id: "popular-artists", title: primaryGenre ? `Popular ${primaryGenre.name} Artists` : "Popular Artists", kind: "artists",
      load: genreArtists(20, 0) },
    { id: "rising-artists", title: "Rising Artists", kind: "artists",
      load: genreArtists(20, 1) },
    { id: "artists-you-may-like", title: "Artists You May Like", subtitle: "Discover your next favorite", kind: "artists",
      load: () => (primaryArtist ? loadArtistRelated(primaryArtist, 20) : loadChartArtists(20)) },

    // ---- Moods, scoped to the user's genres ----
    { id: "mix-late-night", title: "Late Night", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("late night"), 15) },
    { id: "mix-workout", title: "Workout", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("workout energy"), 15) },
    { id: "mix-focus", title: "Focus Flow", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("focus"), 15) },
    { id: "mix-chill", title: "Chill & Unwind", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("chill"), 15) },
    { id: "mix-party", title: "Party Mixes", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("party"), 15) },
    { id: "mix-weekend", title: "Weekend Vibes", kind: "playlists",
      load: () => loadSearchPlaylists(genreQuery("weekend"), 15) },
    { id: "throwback", title: "Throwback Hits", kind: "songs",
      load: withDatasetFallback(() => loadSearchTracks(genreQuery("2000s classics"), 20), () => loadDatasetGenre("90s 2000s", 15)) },
    { id: "viral", title: "Viral Right Now", kind: "songs",
      load: withDatasetFallback(() => loadSearchTracks(genreQuery(`viral ${new Date().getFullYear()}`), 20), () => loadDatasetPopular(4, 15)) },

    // ---- Curated playlist-library sections (offline-safe) ----
    followedArtists.length > 0 && { id: "ds-followed", title: "Playlists With Your Artists", subtitle: "From the curated library", kind: "songs",
      load: () => loadDatasetForArtists(followedArtists, 15) },
    followedGenres.length > 0 && { id: "ds-taste", title: "Matched To Your Taste", subtitle: "From the curated library", kind: "songs",
      load: () => loadDatasetTaste(genreNames, 15) },
    ...genreNames.slice(0, 3).map((name, i) => ({
      id: `ds-genre-${i}`, title: `${name} Essentials`, subtitle: "From the curated library", kind: "songs" as const,
      load: () => loadDatasetGenre(name, 15),
    })),
    recentSeed && { id: "ds-seed", title: `Played Alongside ${recentSeed.title}`, subtitle: "Playlist co-occurrence", kind: "songs",
      load: () => loadDatasetSeed(recentSeed, 15) },

    // ---- Compact song-list rows (list layout instead of cards) ----
    { id: "list-trending", title: "Trending Songs", subtitle: "Quick list", kind: "songlist",
      load: trending(16, 3) },
    { id: "list-top-hits", title: "Top Hits Right Now", kind: "songlist",
      load: () => loadChartTracks(16) },
    { id: "list-new", title: "Recently Released", kind: "songlist",
      load: () => loadSearchTracks(genreQuery(`new songs ${new Date().getFullYear()}`), 16) },
    { id: "list-for-you", title: "Recommended For You", subtitle: "Based on your taste", kind: "songlist",
      load: withDatasetFallback(() => loadRelatedArtistSongs(followedArtists, 16, 2), () => loadDatasetTaste(genreNames, 16)) },
    { id: "list-genre", title: primaryGenre ? `Popular in ${primaryGenre.name}` : "Popular Songs", kind: "songlist",
      load: () => loadSearchTracks(genreQuery("popular"), 16) },

    // ---- Music videos from YouTube ----
    { id: "vid-trending", title: "Trending Music Videos", kind: "videos",
      load: () => loadYouTubeVideos(`trending music videos ${new Date().getFullYear()}`, 12) },
    { id: "vid-new", title: "New Official Videos", kind: "videos",
      load: () => loadYouTubeVideos(genreQuery("new official music video"), 12) },
    { id: "vid-for-you", title: "Recommended Videos", subtitle: primaryArtist ? `Because you follow ${primaryArtist}` : undefined, kind: "videos",
      load: () => loadYouTubeVideos(primaryArtist ? `${primaryArtist} official music video` : genreQuery("music video"), 12) },
    { id: "vid-live", title: "Live Performances", kind: "videos",
      load: () => loadYouTubeVideos(genreQuery("live performance"), 12) },
  ]) as SectionDescriptor[];

}


const ARTIST_SECTION_TEMPLATES: Array<(name: string) => SectionDescriptor> = [
  (name) => ({ id: `art:${name}:best`, title: `Best of ${name}`, kind: "songs",
    load: () => loadArtistTop(name, 15) }),
  (name) => ({ id: `art:${name}:essentials`, title: `${name} Essentials`, kind: "songs",
    load: () => loadArtistTop(name, 15) }),
  (name) => ({ id: `art:${name}:latest`, title: `${name}'s Latest Releases`, kind: "albums",
    load: () => loadArtistAlbums(name, 12) }),
  (name) => ({ id: `art:${name}:radio`, title: `${name} Radio`, kind: "songs",
    load: () => loadArtistRadio(name, 25) }),
  (name) => ({ id: `art:${name}:similar`, title: `Similar to ${name}`, kind: "artists",
    load: () => loadArtistRelated(name, 15) }),
  (name) => ({ id: `art:${name}:inspired`, title: `Inspired by ${name}`, kind: "songs",
    load: () => loadRelatedArtistSongs([name], 20, 0) }),
  (name) => ({ id: `art:${name}:fans`, title: `Fans of ${name} Also Listen To`, kind: "songs",
    load: () => loadRelatedArtistSongs([name], 20, 1) }),
  (name) => ({ id: `art:${name}:collabs`, title: `${name} Collaborations`, kind: "songs",
    load: () => loadSearchTracks(`${name} feat`, 20) }),
  (name) => ({ id: `art:${name}:featured-on`, title: `${name} Featured On`, kind: "playlists",
    load: () => loadArtistPlaylists(name, 15) }),
  (name) => ({ id: `art:${name}:mix`, title: `${name} Mix`, kind: "songs",
    load: () => loadTasteMix(`artist-mix:${name}`, [name], 20, 0) }),

];

function artistSections(followedArtists: string[]): SectionDescriptor[] {
  return followedArtists.flatMap((name) =>
    ARTIST_SECTION_TEMPLATES.map((tpl) => tpl(name)),
  );
}

// Deterministic string hash so section order stays stable within a day.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Interleaver: never place two same-kind sections back to back, and spread
 * artist-scoped sections across the feed instead of grouping them.
 */
function interleave(sections: SectionDescriptor[]): SectionDescriptor[] {
  const buckets = new Map<string, SectionDescriptor[]>();
  for (const s of sections) {
    const key = s.kind + (s.id.startsWith("art:") ? ":artist" : "");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  const out: SectionDescriptor[] = [];
  let lastKind: string | null = null;
  while (buckets.size > 0) {
    let picked = false;
    // biggest bucket that doesn't match lastKind first
    const keys = Array.from(buckets.keys()).sort(
      (a, b) => (buckets.get(b)!.length - buckets.get(a)!.length),
    );
    for (const k of keys) {
      const kindOnly = k.split(":")[0];
      if (kindOnly === lastKind) continue;
      const b = buckets.get(k)!;
      out.push(b.shift()!);
      lastKind = kindOnly;
      if (b.length === 0) buckets.delete(k);
      picked = true;
      break;
    }
    if (!picked) {
      // forced pick when only one kind remains
      const k = keys[0];
      const b = buckets.get(k)!;
      out.push(b.shift()!);
      lastKind = k.split(":")[0];
      if (b.length === 0) buckets.delete(k);
    }
  }
  return out;
}

export function buildFeed(input: FeedInput, userSeed = "anon"): SectionDescriptor[] {
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const seed = hash(userSeed + ":" + day + ":" + input.followedArtists.join("|"));
  const global = seededShuffle(globalSections(input), seed);
  const perArtist = seededShuffle(artistSections(input.followedArtists), seed ^ 0x9e3779b9);
  return interleave([...global, ...perArtist]);
}
