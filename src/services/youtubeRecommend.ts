import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

export interface YouTubeTrack {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

const cache = new Map<string, YouTubeTrack[]>();
const FUNCTION_NAME = "youtube-recommend";

async function call(qs: string): Promise<YouTubeTrack[]> {
  const cached = cache.get(qs);
  if (cached) return cached;
  try {
    const url = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}?${qs}`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    if (!res.ok) return [];
    const j = await res.json();
    const tracks: YouTubeTrack[] = j?.tracks ?? [];
    cache.set(qs, tracks);
    return tracks;
  } catch {
    return [];
  }
}

export function topTracksForGenre(genre: string, limit = 15) {
  return call(`genre=${encodeURIComponent(genre)}&limit=${limit}`);
}

export function relatedTo(artistName: string, limit = 15) {
  return call(`relatedTo=${encodeURIComponent(artistName)}&limit=${limit}`);
}
