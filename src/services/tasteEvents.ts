/**
 * Taste signals — lightweight behavioural logging used to personalise the
 * Deezer-backed homepage feed. No AI, just recent-interaction memory.
 */
import { supabase } from "@/integrations/supabase/client";

export type TasteEventType =
  | "play" | "like" | "unlike" | "skip" | "search" | "save_playlist" | "follow_artist" | "repeat";

export interface TasteEvent {
  type: TasteEventType;
  title?: string;
  artist?: string;
  genre?: string;
  trackId?: string;
  weight?: number;
}

const RECENT_KEY = "routenet.taste.recent.v1";
const MAX_LOCAL = 100;

function loadRecent(): TasteEvent[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

export function getRecentSignals(limit = 40): TasteEvent[] {
  return loadRecent().slice(0, limit);
}

/** Most-played artists first, derived from local signals. */
export function getTopSignalArtists(limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const ev of loadRecent()) {
    if (!ev.artist) continue;
    const weight = ev.type === "skip" ? -0.5 : (ev.weight ?? 1);
    counts.set(ev.artist, (counts.get(ev.artist) || 0) + weight);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export async function recordTasteEvent(ev: TasteEvent): Promise<void> {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([ev, ...loadRecent()].slice(0, MAX_LOCAL)));
  } catch { /* ignore */ }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_taste_events").insert({
      user_id: user.id,
      event_type: ev.type,
      track_id: ev.trackId ?? null,
      track_title: ev.title ?? null,
      artist: ev.artist ?? null,
      genre: ev.genre ?? null,
      weight: ev.weight ?? 1,
    });
  } catch { /* ignore */ }
}
