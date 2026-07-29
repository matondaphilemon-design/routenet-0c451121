import { supabase } from "@/integrations/supabase/client";

export interface YouTubeTrack {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

const cache = new Map<string, YouTubeTrack[]>();

async function call(qs: string): Promise<YouTubeTrack[]> {
  if (cache.has(qs)) return cache.get(qs)!;
  try {
    const projectRef = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID || "sfxzqctoispfbtatkgnr";
    const url = `https://${projectRef}.supabase.co/functions/v1/youtube-recommend?${qs}`;
    const res = await fetch(url);
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
