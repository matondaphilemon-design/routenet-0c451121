/**
 * Home Feed Engine.
 *
 * Songs and music videos come from YouTube (they are what actually plays);
 * their presentation is enriched with Deezer metadata. Albums and artists
 * come straight from Deezer, which has the correct covers, names and
 * artwork. YouTube playlists are not shown on the homepage.
 */
import type { Track } from "@/data/mockData";
import { getTopSignalArtists } from "@/services/tasteEvents";
import {
  ytSongs, ytTrendingSongs, ytVideos, ytTrendingVideos,
} from "@/services/youtubeHome";
import { searchAlbums, searchArtists, transformAlbum, transformArtist } from "@/services/deezer";
import { enrichTracks } from "@/services/metadataEnrichment";
import type { FeedVideo } from "@/components/home/cards/UnifiedCards";

export type SectionKind = "songs" | "albums" | "playlists" | "artists" | "mix" | "songlist" | "videos";

export interface SectionResult {
  title?: string;
  songs?: Track[];
  albums?: { id: string | number; title: string; cover: string; artist: string }[];
  playlists?: { id: string | number; title: string; cover: string; creator?: string; description?: string }[];
  artists?: { id: string | number; name: string; picture: string; fans?: number }[];
  videos?: FeedVideo[];
}

export interface SectionDescriptor {
  id: string;
  title: string;
  subtitle?: string;
  kind: SectionKind;
  load: () => Promise<SectionResult>;
}

const YEAR = new Date().getFullYear();

/** How many tracks per row get a Deezer metadata upgrade. */
const ENRICH_LIMIT = 12;

/** Upgrade the visible part of a row with Deezer metadata. */
async function withDeezer(list: Track[]): Promise<Track[]> {
  if (!list.length) return list;
  const head = await enrichTracks(list.slice(0, ENRICH_LIMIT)).catch(() => list.slice(0, ENRICH_LIMIT));
  return [...head, ...list.slice(ENRICH_LIMIT)];
}

// -------- Loaders (YouTube playback + Deezer metadata) --------
const songs = (q: string, limit = 20) => async (): Promise<SectionResult> => ({ songs: await withDeezer(await ytSongs(q, limit)) });
const trending = (limit = 20) => async (): Promise<SectionResult> => {
  const list = await ytTrendingSongs(limit);
  return { songs: await withDeezer(list.length ? list : await ytSongs(`trending music ${YEAR}`, limit)) };
};
const albums = (q: string, limit = 20) => async (): Promise<SectionResult> => ({
  albums: (await searchAlbums(q, limit)).map(transformAlbum),
});
const artists = (q: string, limit = 20) => async (): Promise<SectionResult> => ({
  artists: (await searchArtists(q, limit)).map(transformArtist),
});
const videos = (q: string, limit = 12) => async (): Promise<SectionResult> => ({ videos: await ytVideos(q, limit) });


/** Blend several artist searches so no single artist dominates a row. */
const mixOfArtists = (seeds: string[], suffix: string, limit = 20) => async (): Promise<SectionResult> => {
  const pool = Array.from(new Set([...seeds, ...getTopSignalArtists(8)])).filter(Boolean);
  if (!pool.length) return { songs: await ytTrendingSongs(limit) };
  const chosen = pool.slice(0, 3);
  const lists = await Promise.all(chosen.map((a) => ytSongs(`${a} ${suffix}`, Math.ceil(limit / chosen.length) + 4)));
  const seen = new Set<string>();
  const out: Track[] = [];
  for (let i = 0; out.length < limit; i++) {
    let added = false;
    for (const list of lists) {
      const t = list[i];
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return { songs: out };
};

export interface FeedInput {
  followedArtists: string[];
  followedGenres: { id: number | string; name: string }[];
  recentSeed?: Track | null;
}

function pool<T>(arr: T[]): T[] { return arr.filter(Boolean); }

function globalSections(input: FeedInput): SectionDescriptor[] {
  const { followedArtists, followedGenres, recentSeed } = input;
  const primaryArtist = followedArtists[0];
  const genreNames = followedGenres.map((g) => g.name);
  const g1 = genreNames[0] || "";
  const g2 = genreNames[1] || g1;
  const g3 = genreNames[2] || g1;
  const q = (suffix: string, genre = g1) => `${genre ? genre + " " : ""}${suffix}`.trim();

  return pool<SectionDescriptor | null>([
    // ---- Personal ----
    { id: "made-for-you", title: "Made For You", subtitle: "Built from the artists you love", kind: "songs",
      load: mixOfArtists(followedArtists, "songs", 25) },
    { id: "daily-mix", title: "Your Daily Mix", subtitle: "A fresh blend every day", kind: "songs",
      load: mixOfArtists(followedArtists, "mix", 25) },
    { id: "daily-mix-2", title: "Daily Mix 2", subtitle: "Another corner of your taste", kind: "songs",
      load: mixOfArtists(followedArtists, `best songs ${YEAR}`, 25) },
    recentSeed && { id: "because-you-played", title: `Because You Played ${recentSeed.artist}`, subtitle: "More in that vibe", kind: "songs",
      load: songs(`${recentSeed.artist} radio mix`, 25) },
    { id: "similar-favorites", title: "Similar To Your Favorites", subtitle: "Artists close to what you love", kind: "songs",
      load: songs(primaryArtist ? `artists like ${primaryArtist}` : q("top songs"), 20) },
    { id: "fresh-discoveries", title: "Fresh Discoveries", subtitle: "New sounds in your lane", kind: "songs",
      load: songs(q(`new music ${YEAR}`), 20) },
    { id: "missed", title: "Songs You Might Have Missed", subtitle: "From your favorite artists", kind: "songs",
      load: mixOfArtists(followedArtists, "deep cuts", 20) },

    // ---- Trending / charts / releases ----
    { id: "trending-songs", title: g1 ? `Trending in ${g1}` : "Trending Now", subtitle: "Climbing right now", kind: "songs",
      load: g1 ? songs(q(`trending songs ${YEAR}`), 20) : trending(20) },
    { id: "top-songs", title: g2 ? `Top ${g2}` : "Top Songs", subtitle: "What everyone's playing", kind: "songs",
      load: songs(q("top hits", g2), 20) },
    { id: "genre-charts", title: g3 ? `${g3} Charts` : "Global Charts", kind: "songs",
      load: songs(q(`charts ${YEAR}`, g3), 20) },
    { id: "new-releases", title: "New Releases", subtitle: `Fresh on YouTube`, kind: "albums",
      load: albums(q(`new ${YEAR}`), 20) },
    { id: "featured-albums", title: "Featured Albums", kind: "albums",
      load: albums(q("best"), 20) },
    { id: "recommended-albums", title: "Recommended Albums", subtitle: primaryArtist ? `Because you follow ${primaryArtist}` : undefined, kind: "albums",
      load: albums(primaryArtist || q("popular"), 20) },

    // ---- Artists ----
    { id: "popular-artists", title: g1 ? `Popular ${g1} Artists` : "Popular Artists", kind: "artists",
      load: artists(q("top artists"), 20) },
    { id: "rising-artists", title: "Rising Artists", kind: "artists",
      load: artists(q(`new artists ${YEAR}`, g2), 20) },
    { id: "artists-you-may-like", title: "Artists You May Like", subtitle: "Discover your next favorite", kind: "artists",
      load: artists(primaryArtist ? `artists like ${primaryArtist}` : q("artists"), 20) },

    // ---- Moods (song rows — no YouTube playlists on the homepage) ----
    { id: "mix-late-night", title: "Late Night", kind: "songs", load: songs(q("late night songs"), 15) },
    { id: "mix-workout", title: "Workout", kind: "songs", load: songs(q("workout songs"), 15) },
    { id: "mix-focus", title: "Focus Flow", kind: "songs", load: songs(q("focus songs"), 15) },
    { id: "mix-chill", title: "Chill & Unwind", kind: "songs", load: songs(q("chill songs"), 15) },
    { id: "mix-party", title: "Party Mixes", kind: "songs", load: songs(q("party songs"), 15) },
    { id: "mix-weekend", title: "Weekend Vibes", kind: "songs", load: songs(q("weekend songs"), 15) },

    { id: "throwback", title: "Throwback Hits", kind: "songs", load: songs(q("2000s classics"), 20) },
    { id: "viral", title: "Viral Right Now", kind: "songs", load: songs(q(`viral songs ${YEAR}`), 20) },

    // ---- Compact list rows ----
    { id: "list-trending", title: "Trending Songs", subtitle: "Quick list", kind: "songlist", load: trending(16) },
    { id: "list-top-hits", title: "Top Hits Right Now", kind: "songlist", load: songs(q("top hits"), 16) },
    { id: "list-new", title: "Recently Added", kind: "songlist", load: songs(q(`new songs ${YEAR}`), 16) },
    { id: "list-for-you", title: "Recommended For You", subtitle: "Based on your taste", kind: "songlist",
      load: mixOfArtists(followedArtists, "top songs", 16) },
    { id: "list-genre", title: g1 ? `Popular in ${g1}` : "Popular Songs", kind: "songlist", load: songs(q("popular songs"), 16) },

    // ---- Music videos ----
    { id: "vid-trending", title: "Trending Music Videos", kind: "videos",
      load: async () => {
        const v = await ytTrendingVideos(12);
        return { videos: v.length ? v : await ytVideos(`trending music videos ${YEAR}`, 12) };
      } },
    { id: "vid-new", title: "New Official Videos", kind: "videos", load: videos(q(`new official music video ${YEAR}`), 12) },
    { id: "vid-for-you", title: "Recommended Videos", subtitle: primaryArtist ? `Because you follow ${primaryArtist}` : undefined, kind: "videos",
      load: videos(primaryArtist ? `${primaryArtist} official music video` : q("music video"), 12) },
    { id: "vid-live", title: "Live Performances", kind: "videos", load: videos(q("live performance"), 12) },
    { id: "vid-acoustic", title: "Acoustic Sessions", kind: "videos", load: videos(q("acoustic session"), 12) },
    { id: "vid-popular", title: "Popular Uploads", kind: "videos", load: videos(q("most popular music video"), 12) },
  ]) as SectionDescriptor[];
}

const ARTIST_SECTION_TEMPLATES: Array<(name: string) => SectionDescriptor> = [
  (name) => ({ id: `art:${name}:best`, title: `Best of ${name}`, kind: "songs", load: songs(`${name} best songs`, 15) }),
  (name) => ({ id: `art:${name}:essentials`, title: `${name} Essentials`, kind: "songs", load: songs(`${name} greatest hits`, 15) }),
  (name) => ({ id: `art:${name}:latest`, title: `${name}'s Latest Releases`, kind: "albums", load: albums(`${name} ${YEAR}`, 12) }),
  (name) => ({ id: `art:${name}:radio`, title: `${name} Radio`, kind: "songs", load: songs(`${name} radio mix`, 20) }),
  (name) => ({ id: `art:${name}:similar`, title: `Similar to ${name}`, kind: "artists", load: artists(`artists like ${name}`, 15) }),
  (name) => ({ id: `art:${name}:inspired`, title: `Inspired by ${name}`, kind: "songs", load: songs(`music like ${name}`, 20) }),
  (name) => ({ id: `art:${name}:collabs`, title: `${name} Collaborations`, kind: "songs", load: songs(`${name} feat`, 20) }),
  (name) => ({ id: `art:${name}:albums`, title: `${name} Albums`, kind: "albums", load: albums(name, 15) }),
  (name) => ({ id: `art:${name}:videos`, title: `${name} Music Videos`, kind: "videos", load: videos(`${name} official music video`, 12) }),
];

function artistSections(followedArtists: string[]): SectionDescriptor[] {
  return followedArtists.flatMap((name) => ARTIST_SECTION_TEMPLATES.map((tpl) => tpl(name)));
}

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

/** Never place two same-kind sections back to back. */
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
    const keys = Array.from(buckets.keys()).sort((a, b) => buckets.get(b)!.length - buckets.get(a)!.length);
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
