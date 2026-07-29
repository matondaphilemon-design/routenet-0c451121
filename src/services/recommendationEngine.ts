/**
 * Smart recommendation engine — pulls from artists, genres, chart, local
 * chart, editorial releases, and genre playlists to build the diverse,
 * personalized homepage feed. Scores tracks by artist affinity, popularity,
 * recency and diversity, then caps to 3 tracks per artist.
 */
import {
  getArtistTopTracks,
  getArtistAlbums,
  getChart,
  getLocalChart,
  getGenreTracks,
  getEditorialReleases,
  searchArtist,
  searchPlaylists,
  getPlaylistTracks,
  transformTrack,
  transformArtist,
  transformPlaylist,
  transformAlbum,
} from "./deezer";
import { saveTracks, savePlaylists } from "./trackCacheDB";
import type { Track } from "@/data/mockData";

export interface RecoInput {
  artists: string[];
  genres: string[];
  subgenres?: string[];
  country?: string;
  likedSongs?: string[];
}

export interface HomeFeed {
  hero: Track[];
  justForYou: Track[];
  becauseYouLiked: Track[];
  newReleases: Track[];
  trendingNow: Track[];
  freshFinds: Track[];
  chartTracks: Track[];
  localChart: Track[];
  trendingArtists: { id: number; name: string; picture: string }[];
  madeForYouPlaylists: ReturnType<typeof transformPlaylist>[];
  perArtist: { artist: string; tracks: Track[] }[];
  heavyRotation: Track[];
  albumSpotlight: ReturnType<typeof transformAlbum>[];
  browseGenres: string[];
  subgenreMixes: { name: string; tracks: Track[] }[];
  deepCuts: Track[];
}

// In-memory caches (per-session)
const playlistCache = new Map<number, Track[]>();
const trackCache = new Map<string, Track>();

async function resolveArtistId(name: string): Promise<number | null> {
  try {
    const res = await searchArtist(name, 1);
    return res?.[0]?.id ?? null;
  } catch { return null; }
}

function dedupeById<T extends { id: any }>(arr: T[]): T[] {
  const seen = new Set();
  const out: T[] = [];
  for (const t of arr) if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
  return out;
}

function limitPerArtist<T extends { artistId?: number; artist?: string }>(tracks: T[], max = 3): T[] {
  const c = new Map<string, number>();
  const out: T[] = [];
  for (const t of tracks) {
    const k = String(t.artistId || t.artist || "");
    const n = c.get(k) || 0;
    if (n < max) { out.push(t); c.set(k, n + 1); }
  }
  return out;
}

function scoreTracks(tracks: any[], artistIds: Set<number>, likedIds: Set<string>) {
  const now = Date.now();
  return tracks.map((t) => {
    let score = 0;
    if (t.artistId && artistIds.has(t.artistId)) score += 40;
    if (likedIds.has(String(t.id))) score += 15;
    score += Math.min(Math.log10((t.streams || 0) + 1) * 5, 20);
    if (t.releaseDate) {
      const days = (now - new Date(t.releaseDate).getTime()) / 86_400_000;
      if (days < 30) score += 10;
      else if (days < 90) score += 5;
      else if (days < 365) score += 2;
    }
    score += (Math.random() * 10 - 5); // diversity jitter
    return { ...t, score };
  }).sort((a, b) => b.score - a.score);
}

export async function buildHomeFeed(input: RecoInput): Promise<HomeFeed> {
  const { artists, genres, country, subgenres = [], likedSongs = [] } = input;
  const topArtists = artists.slice(0, 6);
  const likedSet = new Set(likedSongs);

  // 1. Resolve artist IDs, fetch main data in parallel
  const [artistIds, chart, editorial, localChartRaw] = await Promise.all([
    Promise.all(topArtists.map(resolveArtistId)),
    getChart(40).catch(() => []),
    getEditorialReleases(24).catch(() => []),
    country ? getLocalChart(country, 20).catch(() => []) : Promise.resolve([]),
  ]);

  // 2. Fetch per-artist top tracks + albums, genre tracks, subgenre searches
  const [artistTopTracksResults, artistAlbumsResults, genreTracksResults, subgenreResults] = await Promise.all([
    Promise.all(artistIds.map((id) => (id ? getArtistTopTracks(id, 10).catch(() => []) : Promise.resolve([])))),
    Promise.all(artistIds.slice(0, 4).map((id) => (id ? getArtistAlbums(id, 4).catch(() => []) : Promise.resolve([])))),
    Promise.all(genres.slice(0, 3).map((g) => searchArtist(g, 1).then((r) => r?.[0]?.id).then((gid) => gid ? getGenreTracks(gid, 15).catch(() => []) : []).catch(() => []))),
    Promise.all(subgenres.slice(0, 3).map((sg) => searchArtist(sg, 6).catch(() => []))),
  ]);

  // 3. Trending artist buckets from genres/country
  const trendingQueries = [...genres.slice(0, 3), ...(country ? [country + " artists"] : [])];
  const trendingArtistsRaw = await Promise.all(
    (trendingQueries.length ? trendingQueries : ["pop"]).map((q) => searchArtist(q, 6).catch(() => [])),
  );

  // 4. Playlist search + hydrate top playlists
  const playlistSearches = await Promise.all(
    [...genres.slice(0, 2), ...topArtists.slice(0, 2), ...(country ? [country] : [])].map((q) =>
      searchPlaylists(q, 4).catch(() => []),
    ),
  );
  const flatPlaylists = playlistSearches.flat().slice(0, 12);

  await Promise.all(
    flatPlaylists.slice(0, 4).map(async (p: any) => {
      if (playlistCache.has(p.id)) return;
      try {
        const tracks = await getPlaylistTracks(p.id, 10);
        playlistCache.set(p.id, tracks.map(transformTrack));
      } catch { /* skip */ }
    }),
  );

  // 5. Transform + aggregate
  const chartT: Track[] = chart.map(transformTrack);
  const localChartT: Track[] = localChartRaw.map(transformTrack);
  const editorialT: Track[] = editorial.map((a: any) =>
    transformTrack({
      id: a.id,
      title: a.title,
      artist: a.artist,
      album: { title: a.title, cover_big: a.cover_big, cover_medium: a.cover_medium },
      duration: 0,
      release_date: a.release_date,
    }),
  );

  const perArtist = topArtists.map((name, i) => ({
    artist: name,
    tracks: (artistTopTracksResults[i] || []).map(transformTrack) as Track[],
  }));

  const knownArtistIds = new Set<number>(artistIds.filter(Boolean) as number[]);

  // 6. Build the master track pool for scoring
  const pool = dedupeById([
    ...perArtist.flatMap((p) => p.tracks),
    ...chartT,
    ...editorialT,
    ...localChartT,
    ...genreTracksResults.flat().map(transformTrack),
    ...Array.from(playlistCache.values()).flat(),
  ]);
  const scored = scoreTracks(pool, knownArtistIds, likedSet);

  // 7. Sections
  const justForYou = limitPerArtist(scored, 2).slice(0, 12);
  const trendingNow = scored.filter((t) => (t.streams || 0) > 500_000).slice(0, 12);
  const freshFinds = scored.filter((t) => (t.streams || 0) < 50_000 && t.artwork).slice(0, 12);
  const newReleases = editorialT.slice(0, 12);
  const becauseYouLiked = scored.filter((t) => likedSet.has(String(t.deezerId || t.id))).slice(0, 10);

  const hero = dedupeById([
    ...editorialT.slice(0, 4),
    ...perArtist.flatMap((p) => p.tracks.slice(0, 1)),
    ...chartT.slice(0, 4),
  ]).slice(0, 6);

  const trendingArtistNames = new Set<string>();
  const trendingArtists: { id: number; name: string; picture: string }[] = [];
  for (const bucket of trendingArtistsRaw) {
    for (const a of bucket) {
      // Filter out Deezer's playlist-shaped "artists" (fake profiles with no fans / no picture)
      if (!a?.picture_medium || (a?.nb_fan ?? 0) < 5000) continue;
      const ta = transformArtist(a);
      if (!trendingArtistNames.has(ta.name)) {
        trendingArtistNames.add(ta.name);
        trendingArtists.push(ta);
      }
      if (trendingArtists.length >= 14) break;
    }
    if (trendingArtists.length >= 14) break;
  }

  const heavyRotation = limitPerArtist(scored, 2).slice(0, 10);

  const madeForYouPlaylists = dedupeById<ReturnType<typeof transformPlaylist>>(flatPlaylists.map(transformPlaylist)).slice(0, 10);

  const albumSpotlight = dedupeById<ReturnType<typeof transformAlbum>>(
    artistAlbumsResults.flat().map(transformAlbum),
  ).slice(0, 12);

  const subgenreMixes = subgenres.slice(0, 3).map((name, i) => ({
    name,
    tracks: (subgenreResults[i] || [])
      .flatMap((a: any) => [])
      .slice(0, 10) as Track[],
  })).filter((m) => m.tracks.length > 0);

  const deepCuts = scored.slice(-15).reverse().slice(0, 10);

  // 8. Cache
  for (const t of justForYou) trackCache.set(String(t.id), t as any);
  saveTracks([...justForYou, ...newReleases, ...chartT.slice(0, 20)]).catch(() => {});
  savePlaylists(madeForYouPlaylists).catch(() => {});

  return {
    hero,
    justForYou,
    becauseYouLiked,
    newReleases,
    trendingNow,
    freshFinds,
    chartTracks: chartT.slice(0, 20),
    localChart: localChartT,
    trendingArtists,
    madeForYouPlaylists,
    perArtist,
    heavyRotation,
    albumSpotlight,
    browseGenres: genres.slice(0, 8),
    subgenreMixes,
    deepCuts,
  };
}

export function getCachedTrack(id: string) { return trackCache.get(id) || null; }
export function getCachedPlaylist(id: number) { return playlistCache.get(id) || []; }
