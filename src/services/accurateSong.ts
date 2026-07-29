/**
 * High-accuracy song lookup pipeline.
 *  1. Deezer search → score by Levenshtein similarity (title + artist).
 *  2. If Deezer match ≥ 0.7 → return Deezer metadata + preview.
 *  3. Otherwise fall back to a YouTube edge-function search biased toward
 *     "official audio" / "official music video" queries.
 *  4. Results are cached in localStorage for 7 days, keyed by title|artist.
 *
 *  Returns a normalized object the player layer can consume.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AccurateSongResult {
  success: boolean;
  source?: "deezer" | "youtube" | "cache";
  deezerId?: number;
  videoId?: string;
  title?: string;
  artist?: string;
  cover?: string;
  previewUrl?: string;
  link?: string;
  score?: number;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return 1;
  const m = x.length, n = y.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = x[i - 1] === y[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function cacheKey(track: string, artist: string) {
  return `accsong_${track.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;
}
function readCache(track: string, artist: string): AccurateSongResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(track, artist));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return { ...data, source: "cache" } as AccurateSongResult;
  } catch { return null; }
}
function writeCache(track: string, artist: string, data: AccurateSongResult) {
  try { localStorage.setItem(cacheKey(track, artist), JSON.stringify({ data, ts: Date.now() })); } catch {}
}

async function deezerSearch(track: string, artist: string): Promise<{ best: any; score: number } | null> {
  try {
    const { data } = await supabase.functions.invoke("deezer", {
      body: { action: "searchTrack", params: { query: `${track} ${artist}`, limit: 5 } },
    });
    const arr: any[] = data?.data || [];
    if (!arr.length) return null;
    const scored = arr.map((t) => ({
      t,
      score: (similarity(t.title || "", track) + similarity(t.artist?.name || "", artist)) / 2,
    })).sort((a, b) => b.score - a.score);
    return { best: scored[0].t, score: scored[0].score };
  } catch { return null; }
}

async function youtubeSearch(track: string, artist: string, type: "audio" | "video" = "audio"): Promise<{ videoId: string; title: string; thumb: string } | null> {
  const q = type === "video"
    ? `${track} ${artist} official music video`
    : `${track} ${artist} official audio`;
  try {
    const { data } = await supabase.functions.invoke("youtube", {
      body: { action: "search", params: { query: q, maxResults: 5 } },
    });
    const items: any[] = data?.items || [];
    const cleaned = items.filter((it) => {
      const title = (it?.snippet?.title || "").toLowerCase();
      const bad = ["karaoke", "cover", "remix", "slowed", "reverb", "instrumental"];
      if (bad.some((b) => title.includes(b))) return false;
      return title.includes(artist.toLowerCase()) || title.includes(track.toLowerCase());
    });
    const pick = cleaned[0];
    if (!pick) return null;
    const videoId = typeof pick.id === "string" ? pick.id : pick.id?.videoId;
    if (!videoId) return null;
    return {
      videoId,
      title: pick?.snippet?.title || "",
      thumb: pick?.snippet?.thumbnails?.medium?.url || "",
    };
  } catch { return null; }
}

export async function getAccurateSong(
  track: string,
  artist: string,
  type: "audio" | "video" = "audio",
): Promise<AccurateSongResult> {
  const cached = readCache(track, artist);
  if (cached) return cached;

  const deezer = await deezerSearch(track, artist);
  if (deezer && deezer.score > 0.7) {
    const out: AccurateSongResult = {
      success: true,
      source: "deezer",
      deezerId: deezer.best.id,
      title: deezer.best.title,
      artist: deezer.best.artist?.name,
      cover: deezer.best.album?.cover_big || deezer.best.album?.cover_medium,
      previewUrl: deezer.best.preview,
      link: deezer.best.link,
      score: deezer.score,
    };
    writeCache(track, artist, out);
    return out;
  }

  const yt = await youtubeSearch(deezer?.best?.title || track, deezer?.best?.artist?.name || artist, type);
  if (yt) {
    const out: AccurateSongResult = {
      success: true,
      source: "youtube",
      videoId: yt.videoId,
      title: yt.title,
      artist,
      cover: yt.thumb,
      link: `https://www.youtube.com/watch?v=${yt.videoId}`,
    };
    writeCache(track, artist, out);
    return out;
  }

  return { success: false };
}