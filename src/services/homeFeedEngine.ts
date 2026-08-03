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
import { getListeningHistory } from "@/hooks/useListeningHistory";
import {
  ytSongs, ytTrendingSongs, ytVideos, ytTrendingVideos,
} from "@/services/youtubeHome";
import {
  getChart, getEditorialReleases, searchAlbums, searchArtists,
  getArtistRelated, getArtistTopTracks, getArtistRadio, getGenreTracks,
  getGenreChartAlbums, getGenreChartPlaylists, getGenreChartArtists,
  getGenreReleases, getEditorialSelection, getLocalChart, searchPlaylists,
  resolveArtistId,
  transformAlbum, transformArtist, transformTrack, transformPlaylist,
} from "@/services/deezer";
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

/** Real Deezer chart / editorial rows — live data, never mock data. */
const deezerTrack = (t: any): Track => {
  const d = transformTrack(t);
  return {
    id: d.id, title: d.title, artist: d.artist, album: d.album,
    artwork: d.artwork, duration: d.duration,
  } as Track;
};
const deezerChart = (limit = 25) => async (): Promise<SectionResult> => ({
  songs: (await getChart(limit)).map(deezerTrack),
});
const deezerReleases = (limit = 20) => async (): Promise<SectionResult> => ({
  albums: (await getEditorialReleases(limit)).map(transformAlbum),
});

/* ------------------------------------------------------------------ */
/* Personalization helpers                                             */
/* ------------------------------------------------------------------ */

/** Artists the listener actually engages with, strongest signal first. */
function taste(followedArtists: string[]): string[] {
  const history = getListeningHistory().map((t) => t.artist).filter(Boolean);
  return Array.from(new Set([...getTopSignalArtists(10), ...history, ...followedArtists])).filter(Boolean);
}

/** Tracks the listener already heard — kept out of discovery rows. */
function heardKeys(): Set<string> {
  return new Set(
    getListeningHistory().map((t) => `${(t.artist || "").toLowerCase()}::${(t.title || "").toLowerCase()}`),
  );
}

function dedupeTracks(list: Track[], skipHeard = false): Track[] {
  const heard = skipHeard ? heardKeys() : null;
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of list) {
    if (!t?.title) continue;
    const key = `${(t.artist || "").toLowerCase()}::${(t.title || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    if (heard?.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Round-robin merge so no single source dominates a row. */
function roundRobin<T>(lists: T[][], limit: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < limit; i++) {
    let added = false;
    for (const list of lists) {
      if (i >= list.length) continue;
      out.push(list[i]);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out;
}

/** Deezer rows always fall back to the global chart so nothing renders empty. */
async function songsOrChart(rows: any[], limit: number, skipHeard = false): Promise<SectionResult> {
  let songs = dedupeTracks(rows.map(deezerTrack), skipHeard);
  if (songs.length < 4) {
    const chart = (await getChart(limit)).map(deezerTrack);
    songs = dedupeTracks([...songs, ...chart]);
  }
  return { songs: await withDeezer(songs.slice(0, limit)) };
}

/* ------------------------------------------------------------------ */
/* Personalized Deezer sections                                        */
/* ------------------------------------------------------------------ */

/** Your Daily Flow — an endless personal radio built from top artists + genres. */
const dailyFlow = (artists: string[], genres: { id: number | string }[], limit = 25) =>
  async (): Promise<SectionResult> => {
    const seeds = artists.slice(0, 3);
    const ids = (await Promise.all(seeds.map(resolveArtistId))).filter(Boolean) as number[];
    const radios = await Promise.all(ids.map((id) => getArtistRadio(id, 15)));
    const genreLists = await Promise.all(genres.slice(0, 2).map((g) => getGenreTracks(Number(g.id), 15)));
    const merged = roundRobin([...radios, ...genreLists], limit + 10);
    return songsOrChart(merged, limit, true);
  };

/**
 * Top Picks — the strongest personal matches, songs only. Padding from the
 * global chart is deliberately avoided when we know the listener's artists,
 * so nothing unrelated to their taste can leak into the row.
 */
const topPicks = (artists: string[], genres: { id: number | string }[], limit = 20) =>
  async (): Promise<SectionResult> => {
    const ids = (await Promise.all(artists.slice(0, 6).map(resolveArtistId))).filter(Boolean) as number[];
    const tops = await Promise.all(ids.map((id) => getArtistTopTracks(id, 5)));
    const related = (await Promise.all(ids.slice(0, 3).map((id) => getArtistRelated(id, 4)))).flat();
    const relatedIds = related.map((a: any) => a?.id).filter(Boolean).slice(0, 5) as number[];
    const relatedTops = await Promise.all(relatedIds.map((id) => getArtistTopTracks(id, 4)));
    const merged = roundRobin([...tops, ...relatedTops], limit + 8);
    if (merged.length >= 6) return { songs: await withDeezer(dedupeTracks(merged.map(deezerTrack)).slice(0, limit)) };
    const genreLists = await Promise.all(genres.slice(0, 2).map((g) => getGenreTracks(Number(g.id), 12)));
    return songsOrChart(roundRobin([...merged, ...genreLists], limit + 8), limit);
  };

/**
 * Made For You — songs (not albums) drawn from artists close to the ones the
 * listener actually plays, skipping anything already heard.
 */
const madeForYouSongs = (artists: string[], genres: { id: number | string }[], limit = 20) =>
  async (): Promise<SectionResult> => {
    const ids = (await Promise.all(artists.slice(0, 4).map(resolveArtistId))).filter(Boolean) as number[];
    const radios = await Promise.all(ids.map((id) => getArtistRadio(id, 12)));
    const related = (await Promise.all(ids.slice(0, 3).map((id) => getArtistRelated(id, 5)))).flat();
    const relatedIds = related.map((a: any) => a?.id).filter(Boolean).slice(0, 6) as number[];
    const relatedTops = await Promise.all(relatedIds.map((id) => getArtistTopTracks(id, 4)));
    const merged = roundRobin([...radios, ...relatedTops], limit + 10);
    if (merged.length >= 6) return { songs: await withDeezer(dedupeTracks(merged.map(deezerTrack), true).slice(0, limit)) };
    const genreLists = await Promise.all(genres.slice(0, 2).map((g) => getGenreTracks(Number(g.id), 12)));
    return songsOrChart(roundRobin([...merged, ...genreLists], limit + 8), limit, true);
  };

/** Made For You — recommended albums (kept for genre-specific album rows). */
const madeForYouAlbums = (artists: string[], genres: { id: number | string }[], limit = 20) =>
  async (): Promise<SectionResult> => {
    const ids = (await Promise.all(artists.slice(0, 3).map(resolveArtistId))).filter(Boolean) as number[];
    const related = (await Promise.all(ids.map((id) => getArtistRelated(id, 6)))).flat();
    const names = related.map((a: any) => a?.name).filter(Boolean).slice(0, 4);
    const lists = await Promise.all([
      ...names.map((n: string) => searchAlbums(n, 6)),
      ...genres.slice(0, 2).map((g) => getGenreChartAlbums(Number(g.id), 10)),
    ]);
    let albums = roundRobin(lists, limit).map(transformAlbum);
    if (albums.length < 4) albums = (await getEditorialReleases(limit)).map(transformAlbum);
    return { albums };
  };

const madeForYouArtists = (artists: string[], genres: { id: number | string }[], limit = 20) =>
  async (): Promise<SectionResult> => {
    const ids = (await Promise.all(artists.slice(0, 4).map(resolveArtistId))).filter(Boolean) as number[];
    const lists = await Promise.all([
      ...ids.map((id) => getArtistRelated(id, 8)),
      ...genres.slice(0, 2).map((g) => getGenreChartArtists(Number(g.id), 10)),
    ]);
    let rows = roundRobin(lists, limit + 6);
    if (rows.length < 4) rows = await searchArtists(artists[0] || "top artists", limit);
    const seen = new Set<string>();
    const out = rows.map(transformArtist).filter((a: any) => {
      const k = (a.name || "").toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { artists: out.slice(0, limit) };
  };

const madeForYouPlaylists = (genres: { id: number | string; name: string }[], limit = 20) =>
  async (): Promise<SectionResult> => {
    const lists = await Promise.all(genres.slice(0, 3).map((g) => getGenreChartPlaylists(Number(g.id), 8)));
    let rows = roundRobin(lists, limit);
    if (rows.length < 4) rows = await searchPlaylists(genres[0]?.name || "top hits", limit);
    return { playlists: rows.map(transformPlaylist) };
  };

/** Flow Moods — personalized mood playlists, ordered by the user's genres. */
const MOODS = ["Chill", "Party", "Focus", "Motivation", "Melancholy", "Feel Good"];
const flowMoods = (mood: string, genreName: string, limit = 15) =>
  async (): Promise<SectionResult> => {
    const rows = await searchPlaylists(`${genreName ? genreName + " " : ""}${mood} flow`, limit);
    const fallback = rows.length ? rows : await searchPlaylists(`${mood} mood`, limit);
    return { playlists: fallback.map(transformPlaylist) };
  };

/** New Releases filtered by the listener's genres. */
const genreReleases = (genreId: number | string, limit = 20) =>
  async (): Promise<SectionResult> => {
    let rows = await getGenreReleases(genreId, limit);
    if (rows.length < 4) rows = await getEditorialReleases(limit);
    return { albums: rows.map(transformAlbum) };
  };

/** "Inspired by <newest release>" — seeded by the freshest release we can find. */
const inspiredByLatest = (genreId: number | string, limit = 20) =>
  async (): Promise<SectionResult> => {
    const releases = await getGenreReleases(genreId, 10);
    const newest = releases
      .slice()
      .sort((a: any, b: any) => String(b?.release_date || "").localeCompare(String(a?.release_date || "")))[0];
    const artistName = newest?.artist?.name;
    if (!artistName) return songsOrChart(await getGenreTracks(Number(genreId) || 0, limit), limit);
    const id = await resolveArtistId(artistName);
    const rows = id ? await getArtistRadio(id, limit + 5) : [];
    return {
      title: `Inspired by ${newest.title || artistName}`,
      ...(await songsOrChart(rows, limit, true)),
    };
  };

/** Genre chart (`/chart/{genre_id}`). */
const genreChart = (genreId: number | string, limit = 20) =>
  async (): Promise<SectionResult> => songsOrChart(await getGenreTracks(Number(genreId) || 0, limit), limit);

/** Similar artists to the user's top artist + their best songs. */
const similarArtistSongs = (artistName: string, limit = 20) =>
  async (): Promise<SectionResult> => {
    const id = await resolveArtistId(artistName);
    if (!id) return songsOrChart([], limit);
    const related = await getArtistRelated(id, 6);
    const tops = await Promise.all(
      related.slice(0, 5).map((a: any) => getArtistTopTracks(a.id, 5)),
    );
    return songsOrChart(roundRobin(tops, limit + 5), limit, true);
  };

const similarArtistList = (artistName: string, limit = 20) =>
  async (): Promise<SectionResult> => {
    const id = await resolveArtistId(artistName);
    const related = id ? await getArtistRelated(id, limit) : [];
    const rows = related.length ? related : await searchArtists(artistName || "popular", limit);
    return { artists: rows.map(transformArtist) };
  };

/** Global + regional charts, re-ranked towards the listener's genres. */
const globalChartRow = (limit = 25) => async (): Promise<SectionResult> =>
  songsOrChart(await getChart(limit), limit);

const regionalChartRow = (country: string, limit = 20) => async (): Promise<SectionResult> =>
  songsOrChart(await getLocalChart(country, limit), limit);

const editorialSelection = (genreId: number | string, limit = 20) =>
  async (): Promise<SectionResult> => songsOrChart(await getEditorialSelection(genreId, limit), limit);


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

/**
 * Sections pinned to the top of the feed, directly under the quick-access
 * grid: Made For You first, then Top Picks.
 */
export function pinnedSections(input: FeedInput): SectionDescriptor[] {
  const artists = taste(input.followedArtists);
  const genres = input.followedGenres;
  return pool<SectionDescriptor | null>([
    { id: "p-made-for-you", title: "Made For You", subtitle: "Songs picked from the artists you play", kind: "songs",
      load: madeForYouSongs(artists, genres, 20) },
    { id: "p-top-picks", title: "Top Picks For You", subtitle: "Your strongest matches right now", kind: "songs",
      load: topPicks(artists, genres, 20) },
  ]) as SectionDescriptor[];
}

/** Deezer-powered personalized rows mixed into the rest of the feed. */
function personalizedDeezerSections(input: FeedInput): SectionDescriptor[] {
  const artists = taste(input.followedArtists);
  const genres = input.followedGenres;
  const top = artists[0] || "";
  const country = (typeof navigator !== "undefined" && navigator.language?.split("-")[1]) || "US";

  return pool<SectionDescriptor | null>([
    { id: "dz-daily-flow", title: "Your Daily Flow", subtitle: "An endless station built around your taste", kind: "songs",
      load: dailyFlow(artists, genres, 25) },
    { id: "dz-daily-flow-list", title: "Flow Continues", kind: "songlist", load: dailyFlow(artists, genres, 16) },
    { id: "dz-mfy-artists", title: "Artists Made For You", subtitle: "Close to what you already love", kind: "artists",
      load: madeForYouArtists(artists, genres, 20) },
    genres.length ? { id: "dz-mfy-playlists", title: "Playlists Made For You", kind: "playlists",
      load: madeForYouPlaylists(genres, 20) } : null,

    // Flow Moods
    ...MOODS.map((mood, i) => ({
      id: `dz-mood-${mood.toLowerCase()}`,
      title: `${mood} Flow`,
      subtitle: genres[i % Math.max(genres.length, 1)]?.name ? `In ${genres[i % genres.length].name}` : undefined,
      kind: "playlists" as SectionKind,
      load: flowMoods(mood, genres[i % Math.max(genres.length, 1)]?.name || "", 15),
    })),

    // New releases, filtered by genre + inspired-by-latest song rows
    ...genres.slice(0, 3).map((g) => ({
      id: `dz-rel-${g.id}`,
      title: `New in ${g.name}`,
      subtitle: "Fresh releases in your genre",
      kind: "albums" as SectionKind,
      load: genreReleases(g.id, 20),
    })),
    ...genres.slice(0, 3).map((g) => ({
      id: `dz-inspired-${g.id}`,
      title: `Inspired by the latest ${g.name} release`,
      kind: "songs" as SectionKind,
      load: inspiredByLatest(g.id, 20),
    })),

    // Genre charts
    ...genres.slice(0, 4).map((g) => ({
      id: `dz-chart-${g.id}`,
      title: `${g.name} Chart`,
      subtitle: "Biggest songs in your genre",
      kind: "songs" as SectionKind,
      load: genreChart(g.id, 20),
    })),
    ...genres.slice(0, 2).map((g) => ({
      id: `dz-sel-${g.id}`,
      title: `${g.name} Selection`,
      kind: "songlist" as SectionKind,
      load: editorialSelection(g.id, 16),
    })),

    // Similar artists
    top ? { id: "dz-similar-songs", title: `Because You Play ${top}`, subtitle: "Songs from related artists", kind: "songs",
      load: similarArtistSongs(top, 20) } : null,
    top ? { id: "dz-similar-artists", title: `Similar to ${top}`, kind: "artists",
      load: similarArtistList(top, 20) } : null,

    // Charts
    { id: "dz-global-chart", title: "Global Chart", subtitle: "Top 25 worldwide", kind: "songs", load: globalChartRow(25) },
    { id: "dz-regional-chart", title: "Charting Near You", kind: "songs", load: regionalChartRow(country, 20) },
    { id: "dz-global-list", title: "Worldwide Top Songs", kind: "songlist", load: globalChartRow(16) },
  ]) as SectionDescriptor[];
}



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
    { id: "deezer-chart", title: "Global Top Chart", subtitle: "The world's biggest songs right now", kind: "songs",
      load: deezerChart(25) },
    { id: "deezer-chart-list", title: "Chart Toppers", kind: "songlist", load: deezerChart(16) },
    { id: "new-releases", title: "New Releases", subtitle: "Just out", kind: "albums",
      load: deezerReleases(20) },
    { id: "new-releases-genre", title: g1 ? `New in ${g1}` : "New This Year", kind: "albums",
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
  const global = seededShuffle(
    [...globalSections(input), ...personalizedDeezerSections(input)],
    seed,
  );
  const perArtist = seededShuffle(artistSections(input.followedArtists), seed ^ 0x9e3779b9);
  const mixed = interleave([...global, ...perArtist]);
  // Made For You + Top Picks always sit directly under the quick-access grid.
  const pinned = pinnedSections(input);
  const pinnedIds = new Set(pinned.map((s) => s.id));
  return [...pinned, ...mixed.filter((s) => !pinnedIds.has(s.id))];
}

