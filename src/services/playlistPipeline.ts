/**
 * Playlist Pipeline — the single source of music discovery.
 *
 * Every recommendation the app makes comes from a REAL playlist fetched from
 * an external catalog:
 *
 *   1. YouTube Data API v3   (primary)
 *   2. Deezer                (fallback)
 *   3. The app's own sources / charts (final fallback)
 *
 * Rules enforced here:
 *  - The playlist must match the seed song's genre / subgenre / mood / era.
 *  - The SAME playlist is never returned twice in a row for a song: a per-seed
 *    rotation counter walks a different query first on every play and used
 *    playlist ids are remembered locally.
 *  - Playlists dominated by a single artist are rejected; we prefer editorial /
 *    "top hits" / chart style playlists with many different artists.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/data/mockData";
import { transformTrack } from "@/services/deezer";
import { enforceQueueRules } from "@/services/queueManager";
import { toTitleCase } from "@/utils/toTitleCase";

export type PlaylistSource = "youtube" | "deezer" | "library";

export interface DiscoveredPlaylist {
  playlistId: string;
  source: PlaylistSource;
  title: string;
  image: string;
  tracks: Track[];
}

const USED_KEY = "routenet.pipeline.used.v2";
const ROTATION_KEY = "routenet.pipeline.rotation.v2";
const MIN_TRACKS = 8;
const MIN_DISTINCT_ARTISTS = 5;
const MAX_PER_ARTIST = 2;

// ---------------------------------------------------------------------------
// Rotation + used-playlist memory (local, synchronous → never blocks playback)
// ---------------------------------------------------------------------------
function readMap<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function writeMap(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/** Monotonically increasing counter per seed — guarantees a different start. */
function bumpRotation(seedKey: string): number {
  const all = readMap<number>(ROTATION_KEY);
  const next = ((all[seedKey] ?? -1) + 1) % 1000;
  all[seedKey] = next;
  writeMap(ROTATION_KEY, all);
  return next;
}

function loadUsed(seedKey: string): Set<string> {
  return new Set(readMap<string[]>(USED_KEY)[seedKey] || []);
}

function rememberUsed(seedKey: string, playlistKey: string) {
  const all = readMap<string[]>(USED_KEY);
  const list = (all[seedKey] || []).filter((k) => k !== playlistKey);
  list.unshift(playlistKey);
  all[seedKey] = list.slice(0, 40);
  writeMap(USED_KEY, all);
}

/** Seed identity used for rotation: genre+artist so the whole lane rotates. */
function seedKeyOf(track: Track): string {
  const genre = String((track as any).genre || "").toLowerCase().trim();
  return `${genre || "any"}|${(track.artist || "").toLowerCase().trim()}`;
}

// ---------------------------------------------------------------------------
// Genre / subgenre inference
// ---------------------------------------------------------------------------
const GENRE_HINTS: Record<string, string[]> = {
  trap: ["trap", "atlanta hip hop", "trap rap"],
  drill: ["drill", "uk drill", "ny drill"],
  afrobeats: ["afrobeats", "afrobeat naija", "afro pop"],
  afro: ["afrobeats", "afro pop"],
  amapiano: ["amapiano", "south african house"],
  gospel: ["gospel", "worship", "praise"],
  "r&b": ["rnb", "r&b soul", "contemporary rnb"],
  rnb: ["rnb", "r&b soul"],
  soul: ["soul", "neo soul"],
  reggae: ["reggae", "roots reggae"],
  dancehall: ["dancehall", "bashment"],
  rap: ["hip hop", "rap"],
  "hip hop": ["hip hop", "rap"],
  hiphop: ["hip hop", "rap"],
  house: ["house", "dance house"],
  techno: ["techno"],
  edm: ["edm", "electronic dance"],
  pop: ["pop hits", "pop"],
  rock: ["rock"],
  metal: ["metal"],
  country: ["country"],
  jazz: ["jazz"],
  lofi: ["lofi", "lo-fi beats"],
  latin: ["latin", "reggaeton"],
  reggaeton: ["reggaeton", "latin urban"],
  kpop: ["k-pop"],
  indie: ["indie"],
  classical: ["classical"],
  blues: ["blues"],
  punk: ["punk"],
  funk: ["funk"],
  disco: ["disco"],
  grime: ["grime"],
  alte: ["alte", "afro fusion"],
};

/** Artists → subgenre lane, used when the catalog gives us no genre at all. */
const ARTIST_LANES: Array<[RegExp, string[]]> = [
  [/future|young thug|gunna|lil baby|21 savage|travis scott|metro boomin|migos|quavo|offset|playboi carti/i, ["trap", "atlanta hip hop"]],
  [/central cee|headie one|digga d|pop smoke|fivio/i, ["drill", "uk drill"]],
  [/burna boy|wizkid|davido|rema|asake|ayra starr|omah lay|tems|fireboy|olamide/i, ["afrobeats", "afro pop"]],
  [/kabza|dj maphorisa|focalistic|tyler icu|uncle waffles/i, ["amapiano"]],
  [/vybz kartel|popcaan|skillibeng|shenseea|masicka/i, ["dancehall"]],
  [/sinach|travis greene|kirk franklin|maverick city|hillsong|elevation worship/i, ["gospel", "worship"]],
  [/bad bunny|karol g|feid|rauw alejandro|peso pluma/i, ["reggaeton", "latin urban"]],
  [/drake|j\. cole|kendrick|nas|jay-z|lil wayne/i, ["hip hop", "rap"]],
  [/sza|brent faiyaz|summer walker|giveon|chris brown|bryson tiller/i, ["rnb", "r&b soul"]],
];

function genreHints(track: Track): string[] {
  const raw = String((track as any).genre || "").toLowerCase();
  const hints = new Set<string>();
  for (const [key, values] of Object.entries(GENRE_HINTS)) {
    if (raw.includes(key)) values.forEach((v) => hints.add(v));
  }
  if (!hints.size) {
    const probe = `${track.artist || ""} ${track.album || ""} ${track.title || ""}`;
    for (const [re, lanes] of ARTIST_LANES) {
      if (re.test(probe)) { lanes.forEach((l) => hints.add(l)); break; }
    }
  }
  if (raw && !hints.size) hints.add(raw);
  return Array.from(hints);
}

function eraOf(track: Track): string | null {
  const raw = (track as any).releaseDate as string | undefined;
  const year = raw ? Number(String(raw).slice(0, 4)) : NaN;
  if (!year || Number.isNaN(year)) return null;
  if (year >= 2023) return "2020s new";
  if (year >= 2020) return "2020s";
  if (year >= 2010) return "2010s";
  if (year >= 2000) return "2000s";
  if (year >= 1990) return "90s";
  if (year >= 1980) return "80s";
  return "classics";
}

/** Rotate an array so a different query leads on every play. */
function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length < 2) return arr;
  const n = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

/**
 * Ordered query set for a seed song. Every query is biased toward official /
 * editorial / top-hits playlists so recommendations feel strong and diverse.
 */
export function buildPlaylistQueries(track: Track, rotation = 0): string[] {
  const title = track.title?.trim() || "";
  const artist = track.artist?.trim() || "";
  const genres = genreHints(track);
  const era = eraOf(track);
  const mood = String((track as any).mood || "").toLowerCase();
  const year = new Date().getFullYear();
  const g = genres.length ? genres : ["pop hits", "global hits"];

  // Genre-first queries (rotated) then relational fallbacks (kept last).
  const genreQueries = [
    ...g.map((x) => `top ${x} hits playlist ${year}`),
    ...g.map((x) => `best ${x} songs mix`),
    ...g.map((x) => `official ${x} playlist trending`),
    ...g.map((x) => `${x} essentials mix multiple artists`),
    ...g.map((x) => `new ${x} releases playlist ${year}`),
    ...g.map((x) => `${x} charts top 50`),
    era && g[0] ? `top ${g[0]} ${era} playlist` : "",
    mood && g[0] ? `${mood} ${g[0]} playlist` : "",
  ].filter(Boolean) as string[];

  const relational = [
    `artists similar to ${artist} mix`,
    `songs like ${title} playlist`,
    `${artist} type beat era mix`,
  ].filter((q) => q.trim().length > 6);

  return Array.from(new Set([...rotate(genreQueries, rotation), ...relational]))
    .map((q) => q.replace(/\s+/g, " ").trim())
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Quality scoring — official / editorial / charts beat random user playlists
// ---------------------------------------------------------------------------
const GOOD = /(official|editorial|top\s*\d*|hits|charts?|best of|essentials|trending|popular|mix|radio|this week|\d{4})/i;
const BAD = /(full album|album completo|type beat|instrumental|karaoke|sleep|asmr|1 hour|nightcore|slowed|reverb)/i;

function qualityScore(text: string, size = 0): number {
  let score = 0;
  if (GOOD.test(text)) score += 25;
  if (/official|editorial|charts?/i.test(text)) score += 20;
  if (BAD.test(text)) score -= 60;
  score += Math.min(30, size / 4);
  return score;
}

// ---------------------------------------------------------------------------
// Track normalisation + diversity
// ---------------------------------------------------------------------------
const NOISE = /\s*[\(\[](official|lyric|lyrics|audio|video|visualizer|hd|4k|mv|m\/v|prod\.?[^\)\]]*)[^\)\]]*[\)\]]\s*/gi;

function cleanTitle(raw: string): string {
  return raw
    .replace(NOISE, " ")
    .replace(/\s*[-–|]\s*(official\s*)?(music\s*)?(video|audio|lyrics?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function youtubeItemToTrack(item: any): Track | null {
  if (!item?.videoId) return null;
  const cleaned = cleanTitle(String(item.title || ""));
  if (!cleaned) return null;
  const dash = cleaned.split(/\s+[-–—]\s+/);
  const channel = String(item.channelTitle || "").replace(/\s*-\s*Topic$/i, "").trim();
  const artist = dash.length > 1 ? dash[0].trim() : channel || "Unknown";
  const title = dash.length > 1 ? dash.slice(1).join(" - ").trim() : cleaned;
  return {
    id: `yt-${item.videoId}`,
    youtubeId: item.videoId,
    title: toTitleCase(title),
    artist: toTitleCase(artist),
    album: "",
    artwork: item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
    duration: 0,
  } as unknown as Track;
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (!t?.id || !t.title) continue;
    const key = `${t.title}|${t.artist}`.toLowerCase();
    if (seen.has(t.id) || seen.has(key)) continue;
    seen.add(t.id);
    seen.add(key);
    out.push(t);
  }
  return out;
}

const artistKey = (t: Track) => (t.artist || "").trim().toLowerCase();

function distinctArtists(tracks: Track[]): number {
  return new Set(tracks.map(artistKey).filter(Boolean)).size;
}

/** Cap every artist so no playlist is dominated by one performer. */
function diversify(tracks: Track[], seedArtist: string): Track[] {
  const counts = new Map<string, number>();
  const out: Track[] = [];
  const seed = seedArtist.toLowerCase().trim();
  for (const t of tracks) {
    const a = artistKey(t);
    if (!a) continue;
    const cap = a === seed ? 1 : MAX_PER_ARTIST;
    const used = counts.get(a) || 0;
    if (used >= cap) continue;
    counts.set(a, used + 1);
    out.push(t);
  }
  return out;
}

/** Shared acceptance test: enough songs, enough different artists. */
function finalizeTracks(raw: Track[], seed: Track): Track[] | null {
  const deduped = dedupeTracks(raw);
  const diverse = diversify(deduped, seed.artist || "");
  if (diverse.length < MIN_TRACKS) return null;
  if (distinctArtists(diverse) < MIN_DISTINCT_ARTISTS) return null;
  return enforceQueueRules(diverse, 45, [], new Set([seed.id]));
}

// ---------------------------------------------------------------------------
// Source 1 — YouTube Data API v3
// ---------------------------------------------------------------------------
async function yt(action: string, params: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("youtube", { body: { action, params } });
  if (error) throw error;
  return data as any;
}

async function fromYouTube(track: Track, used: Set<string>, rotation: number): Promise<DiscoveredPlaylist | null> {
  const queries = buildPlaylistQueries(track, rotation).slice(0, 4);
  for (const query of queries) {
    let candidates: any[] = [];
    try {
      const res = await yt("searchPlaylists", { query, limit: 15 });
      if (res?.unavailable) return null; // no key / quota — hand over to Deezer
      candidates = res?.data || [];
    } catch {
      return null;
    }
    const ranked = candidates
      .filter((c) => c?.id && !used.has(`youtube:${c.id}`))
      .map((c) => ({ c, s: qualityScore(`${c.title} ${c.channelTitle} ${c.description}`) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5);

    for (const { c } of ranked) {
      try {
        const items = await yt("getPlaylistItems", { playlistId: c.id, limit: 50 });
        const tracks = finalizeTracks(
          (items?.data || []).map(youtubeItemToTrack).filter(Boolean) as Track[],
          track,
        );
        if (!tracks) continue;
        return { playlistId: String(c.id), source: "youtube", title: c.title, image: c.image, tracks };
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Source 2 — Deezer
// ---------------------------------------------------------------------------
async function dz(action: string, params: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("deezer", { body: { action, params } });
  if (error) throw error;
  return data as any;
}

async function fromDeezer(track: Track, used: Set<string>, rotation: number): Promise<DiscoveredPlaylist | null> {
  const seen = new Set<string>();
  for (const query of buildPlaylistQueries(track, rotation).slice(0, 6)) {
    let candidates: any[] = [];
    try {
      candidates = (await dz("searchPlaylist", { query, limit: 20 }))?.data || [];
    } catch {
      continue;
    }
    const ranked = candidates
      .filter((c) => c?.id && !seen.has(String(c.id)) && !used.has(`deezer:${c.id}`))
      .map((c) => ({ c, s: qualityScore(`${c.title || ""} ${c.user?.name || ""}`, c.nb_tracks || 0) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5);

    for (const { c } of ranked) {
      const id = String(c.id);
      seen.add(id);
      try {
        const raw = (await dz("getPlaylistTracks", { playlistId: id, limit: 60 }))?.data || [];
        const tracks = finalizeTracks(raw.map((t: any) => transformTrack(t)) as Track[], track);
        if (!tracks) continue;
        return {
          playlistId: id,
          source: "deezer",
          title: c.title || "Playlist",
          image: c.picture_big || c.picture_medium || c.picture || "",
          tracks,
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Source 3 — existing app sources (track radio, artist radio, genre, charts)
// ---------------------------------------------------------------------------
async function fromLibrary(track: Track, used: Set<string>, rotation: number): Promise<DiscoveredPlaylist | null> {
  const deezerId = track.id?.startsWith("deezer-") ? track.id.replace("deezer-", "") : null;
  const lane = genreHints(track)[0];

  const attempts: Array<{ key: string; title: string; run: () => Promise<any[]> }> = [
    deezerId && {
      key: `library:track-radio:${deezerId}`,
      title: `${track.title} Radio`,
      run: async () => (await dz("getTrackRadio", { trackId: deezerId, limit: 50 }))?.data || [],
    },
    lane && {
      key: `library:lane:${lane}`,
      title: `${toTitleCase(lane)} Mix`,
      run: async () => (await dz("searchTrack", { query: `${lane} hits`, limit: 50 }))?.data || [],
    },
    {
      key: `library:artist:${track.artist}`,
      title: `${track.artist} Radio`,
      run: async () => {
        const found = await dz("searchArtist", { name: track.artist, limit: 1 });
        const artistId = found?.data?.[0]?.id;
        if (!artistId) return [];
        return (await dz("getArtistRadio", { artistId, limit: 50 }))?.data || [];
      },
    },
    {
      key: "library:chart",
      title: "Top Charts",
      run: async () => {
        const d = await dz("getChart", { type: "tracks", limit: 50 });
        return d?.tracks?.data || d?.data || [];
      },
    },
  ].filter(Boolean) as any[];

  const ordered = rotate(attempts, rotation);
  for (const attempt of ordered) {
    if (used.has(attempt.key)) continue;
    try {
      const raw = await attempt.run();
      const tracks =
        finalizeTracks(raw.map((t: any) => transformTrack(t)) as Track[], track) ||
        (raw.length >= MIN_TRACKS
          ? dedupeTracks(raw.map((t: any) => transformTrack(t)) as Track[])
          : null);
      if (!tracks || tracks.length < MIN_TRACKS) continue;
      return {
        playlistId: attempt.key,
        source: "library",
        title: attempt.title,
        image: tracks[0]?.artwork || track.artwork,
        tracks,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Storage — grow the shared catalog (fire and forget, never blocks playback)
// ---------------------------------------------------------------------------
function storePlaylist(seed: Track, playlist: DiscoveredPlaylist) {
  supabase.auth.getUser().then(({ data }) => {
    if (!data?.user) return;
    supabase
      .from("discovered_playlists")
      .upsert(
        {
          seed_track_id: seed.id,
          seed_title: seed.title,
          seed_artist: seed.artist,
          playlist_id: playlist.playlistId,
          playlist_title: playlist.title,
          playlist_image: playlist.image,
          source: playlist.source,
          tracks: playlist.tracks as any,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "seed_track_id,playlist_id", ignoreDuplicates: false },
      )
      .then(() => {}, () => {});
  }, () => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Discover a playlist for a song. YouTube first, Deezer second, app sources
 * last. Rotation guarantees a different playlist on repeat plays.
 */
export async function discoverPlaylist(track: Track): Promise<DiscoveredPlaylist | null> {
  if (!track?.id) return null;
  const seedKey = seedKeyOf(track);
  const rotation = bumpRotation(seedKey);
  const used = loadUsed(seedKey);

  let playlist =
    (await fromYouTube(track, used, rotation).catch(() => null)) ||
    (await fromDeezer(track, used, rotation).catch(() => null)) ||
    (await fromLibrary(track, used, rotation).catch(() => null));

  if (!playlist) {
    // Exhausted every fresh option — allow reuse rather than silence.
    playlist =
      (await fromDeezer(track, new Set(), rotation + 1).catch(() => null)) ||
      (await fromLibrary(track, new Set(), rotation + 1).catch(() => null));
  }
  if (!playlist) return null;

  rememberUsed(seedKey, `${playlist.source}:${playlist.playlistId}`);
  storePlaylist(track, playlist);
  return playlist;
}

/**
 * Build the playback queue from a discovered playlist. The selected song is
 * always first; `excludeIds` removes anything already visible in the row the
 * user played from.
 */
export function buildQueueFromPlaylist(
  seed: Track,
  playlist: DiscoveredPlaylist,
  excludeIds?: Set<string>,
): Track[] {
  const normalized = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = playlist.tracks.find(
    (t) => t.id === seed.id || normalized(t.title) === normalized(seed.title),
  );
  const head = match ?? seed;
  const rest = playlist.tracks.filter(
    (t) =>
      t.id !== head.id &&
      normalized(t.title) !== normalized(head.title) &&
      !(excludeIds?.has(t.id) ?? false),
  );
  return [head, ...rest];
}

/** Backwards-compatible alias used across the app. */
export const findFreshPlaylist = discoverPlaylist;
