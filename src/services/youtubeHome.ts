/**
 * YouTube homepage content source.
 *
 * The homepage is powered entirely by YouTube (videos, playlists, artists,
 * albums). No Deezer calls happen here.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/data/mockData";
import { toTitleCase } from "@/utils/toTitleCase";
import { cached } from "@/services/homeCache";
import type { FeedVideo } from "@/components/home/cards/UnifiedCards";

const TTL = 30 * 60 * 1000;

export async function yt(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("youtube", { body: { action, params } });
  if (error) throw error;
  return data;
}

const JUNK = /(karaoke|lyrics video|reaction|type beat|1 hour|instrumental|slowed|sped up|nightcore|8d audio)/i;

function cleanChannel(name?: string) {
  return toTitleCase((name || "YouTube").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim());
}

/** Split "Artist - Title" style YouTube titles into artist + title. */
function splitTitle(raw: string, channel?: string): { title: string; artist: string } {
  const cleaned = (raw || "")
    .replace(/\((official\s*)?(music\s*)?(video|audio|visualizer|lyric[s]?)\)/gi, "")
    .replace(/\[(official\s*)?(music\s*)?(video|audio|visualizer|lyric[s]?)\]/gi, "")
    .replace(/\|\s*official.*$/i, "")
    .trim();
  const m = cleaned.split(/\s+[-–—]\s+/);
  if (m.length >= 2) {
    return { artist: toTitleCase(m[0].trim()), title: toTitleCase(m.slice(1).join(" - ").trim()) };
  }
  return { artist: cleanChannel(channel), title: toTitleCase(cleaned) };
}

interface RawVideo {
  id: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  duration?: number | string;
  views?: number;
  publishedAt?: string;
}

async function searchVideos(query: string, limit = 20): Promise<RawVideo[]> {
  const data = await yt("search", { query, maxResults: limit });
  const items: any[] = data?.items || data?.results || data?.videos || (Array.isArray(data) ? data : []);
  return items
    .filter((v) => v?.id && v?.title && !JUNK.test(v.title))
    .map((v) => ({
      id: String(v.id),
      title: String(v.title),
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      channelTitle: v.channelTitle,
      duration: v.duration,
      views: v.views,
      publishedAt: v.publishedAt,
    }));
}

function toTrack(v: RawVideo): Track {
  const { title, artist } = splitTitle(v.title, v.channelTitle);
  return {
    id: `yt-${v.id}`,
    title,
    artist,
    album: "",
    artwork: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    duration: Number(v.duration) || 0,
    youtubeId: v.id,
  };
}

function toFeedVideo(v: RawVideo): FeedVideo {
  const { title, artist } = splitTitle(v.title, v.channelTitle);
  return {
    id: `ytv-${v.id}`,
    videoId: v.id,
    title,
    artist,
    thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    duration: Number(v.duration) || 0,
    views: Number(v.views) || undefined,
    publishedAt: v.publishedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Public loaders                                                      */
/* ------------------------------------------------------------------ */

export async function ytSongs(query: string, limit = 20): Promise<Track[]> {
  return cached(`yth:songs:${query}:${limit}`, TTL, async () => {
    const raw = await searchVideos(query, limit + 6);
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const v of raw) {
      const t = toTrack(v);
      const key = `${t.title}|${t.artist}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= limit) break;
    }
    return out;
  }).catch(() => []);
}

export async function ytTrendingSongs(limit = 20): Promise<Track[]> {
  return cached(`yth:trending:${limit}`, TTL, async () => {
    const data = await yt("getTrending", { maxResults: limit + 10 });
    const items: any[] = data?.items || [];
    return items
      .filter((v) => v?.id && v?.title && !JUNK.test(v.title))
      .map((v) => toTrack(v))
      .slice(0, limit);
  }).catch(() => []);
}

export async function ytVideos(query: string, limit = 12): Promise<FeedVideo[]> {
  return cached(`yth:videos:${query}:${limit}`, TTL, async () => {
    const raw = await searchVideos(query, limit);
    return raw.map(toFeedVideo);
  }).catch(() => []);
}

export async function ytTrendingVideos(limit = 12): Promise<FeedVideo[]> {
  return cached(`yth:tvideos:${limit}`, TTL, async () => {
    const data = await yt("getTrending", { maxResults: limit + 6 });
    const items: any[] = data?.items || [];
    return items.filter((v) => v?.id && v?.title).map((v) => toFeedVideo(v)).slice(0, limit);
  }).catch(() => []);
}

export interface YTPlaylist {
  id: string;
  title: string;
  cover: string;
  creator?: string;
  description?: string;
}

const PLAYLIST_QUALITY = /(official|topic|vevo|records|music|hits|essentials|mix|top|best|charts|playlist|radio)/i;

export async function ytPlaylists(query: string, limit = 20): Promise<YTPlaylist[]> {
  return cached(`yth:playlists:${query}:${limit}`, TTL, async () => {
    const data = await yt("searchPlaylists", { query, limit });
    const items: any[] = data?.data || [];
    const mapped: YTPlaylist[] = items
      .filter((p) => p?.id && !JUNK.test(p.title || ""))
      .map((p) => ({
        id: `yt-${p.id}`,
        title: toTitleCase(p.title || "Playlist"),
        cover: p.image || "",
        creator: cleanChannel(p.channelTitle),
        description: p.description || "",
      }));
    // Prefer official / topic / editorial-looking playlists.
    return mapped.sort((a, b) => {
      const sa = PLAYLIST_QUALITY.test(`${a.title} ${a.creator}`) ? 1 : 0;
      const sb = PLAYLIST_QUALITY.test(`${b.title} ${b.creator}`) ? 1 : 0;
      return sb - sa;
    });
  }).catch(() => []);
}

export interface YTAlbum { id: string; title: string; cover: string; artist: string }

/** Albums are surfaced from YouTube "full album" playlists. */
export async function ytAlbums(query: string, limit = 20): Promise<YTAlbum[]> {
  const playlists = await ytPlaylists(`${query} full album`, limit);
  return playlists.map((p) => ({
    id: p.id,
    title: p.title.replace(/\s*\(?full album\)?/i, "").trim() || p.title,
    cover: p.cover,
    artist: p.creator || "",
  }));
}

export interface YTArtist { id: string; name: string; picture: string; fans?: number }

/** Artists are derived from the channels behind music results. */
export async function ytArtists(query: string, limit = 20): Promise<YTArtist[]> {
  return cached(`yth:artists:${query}:${limit}`, TTL, async () => {
    const raw = await searchVideos(`${query} official music video`, limit + 20);
    const seen = new Map<string, YTArtist>();
    for (const v of raw) {
      const { artist } = splitTitle(v.title, v.channelTitle);
      const key = artist.toLowerCase();
      if (!artist || artist.toLowerCase() === "youtube" || seen.has(key)) continue;
      seen.set(key, {
        id: key,
        name: artist,
        picture: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      });
      if (seen.size >= limit) break;
    }
    return Array.from(seen.values());
  }).catch(() => []);
}
