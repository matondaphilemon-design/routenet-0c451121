/**
 * Genre detection.
 *
 * Order of resolution:
 *   1. Deezer `/search/track` → album genres (via the `deezer` edge function).
 *   2. Static artist → genre map.
 *   3. Inference from playlist titles that contain the track.
 */
import { supabase } from "@/integrations/supabase/client";
import { artistGenreMap } from "@/constants/genreArtists";

export async function fetchDeezer(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("deezer", { body: { action, params } });
  if (error) throw error;
  return data;
}

const DEEZER_GENRE_ALIASES: Record<string, string> = {
  "hip hop": "Hip-Hop",
  "hip hop/rap": "Hip-Hop",
  rap: "Hip-Hop",
  "rap/hip hop": "Hip-Hop",
  pop: "Pop",
  "r&b": "R&B",
  rnb: "R&B",
  soul: "R&B",
  rock: "Rock",
  metal: "Metal",
  electro: "Electronic",
  electronic: "Electronic",
  dance: "Electronic",
  afrobeats: "Afrobeats",
  afro: "Afrobeats",
  "african music": "Afrobeats",
  trap: "Trap",
  drill: "Drill",
  amapiano: "Amapiano",
  gospel: "Gospel",
  reggae: "Reggae",
  dancehall: "Reggae",
  latin: "Latin",
  "latin music": "Latin",
  country: "Country",
  jazz: "Jazz",
  classical: "Classical",
  "films/games": "Classical",
  alternative: "Indie",
  indie: "Indie",
  "k-pop": "K-Pop",
  kpop: "K-Pop",
};

const GENRE_KEYWORDS = [
  "trap", "drill", "afrobeats", "amapiano", "hip-hop", "hip hop", "rap", "pop",
  "r&b", "rnb", "soul", "gospel", "reggae", "dancehall", "latin", "reggaeton",
  "rock", "metal", "indie", "jazz", "classical", "country", "electronic", "edm",
  "house", "lo-fi", "k-pop",
];

function canonical(raw: string): string {
  const key = raw.toLowerCase().trim();
  if (DEEZER_GENRE_ALIASES[key]) return DEEZER_GENRE_ALIASES[key];
  const partial = Object.keys(DEEZER_GENRE_ALIASES).find((k) => key.includes(k));
  return partial ? DEEZER_GENRE_ALIASES[partial] : raw;
}

const cache = new Map<string, string>();

/** Detect the genre of a song. Returns a canonical genre name or "Unknown". */
export async function detectGenre(artist: string, track: string): Promise<string> {
  const normalizedArtist = (artist || "").toLowerCase().trim();
  const cacheKey = `${normalizedArtist}|${(track || "").toLowerCase().trim()}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const remember = (g: string) => { cache.set(cacheKey, g); return g; };

  // 1. Deezer track → album genres
  try {
    const result = await fetchDeezer("searchTrack", { query: `${artist} ${track}`.trim(), limit: 1 });
    const deezerTrack = result?.data?.[0];
    const albumId = deezerTrack?.album?.id;
    if (albumId) {
      const album = await fetchDeezer("getAlbum", { albumId });
      const name = album?.genres?.data?.[0]?.name;
      if (name) return remember(canonical(name));
    }
  } catch { /* ignore — fall through */ }

  // 2. Static artist map
  if (artistGenreMap[normalizedArtist]) return remember(artistGenreMap[normalizedArtist]);
  const loose = Object.keys(artistGenreMap).find(
    (a) => normalizedArtist.includes(a) || a.includes(normalizedArtist),
  );
  if (loose && normalizedArtist) return remember(artistGenreMap[loose]);

  // 3. Infer from the titles of playlists that contain this track
  try {
    const search = await fetchDeezer("searchPlaylist", { query: `${artist} ${track}`.trim(), limit: 20 });
    const counts: Record<string, number> = {};
    for (const pl of search?.data || []) {
      const title = String(pl?.title || "").toLowerCase();
      for (const g of GENRE_KEYWORDS) if (title.includes(g)) counts[g] = (counts[g] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) return remember(canonical(top[0]));
  } catch { /* ignore */ }

  return remember("Unknown");
}
