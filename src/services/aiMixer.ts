import { Track } from "@/data/mockData";

/**
 * AI mixing helper — anti-repeat interleave.
 *
 * Reorders a track list so no two consecutive tracks share the same artist,
 * preserving overall track order as much as possible. Simple, deterministic
 * greedy algorithm that mirrors what pro streaming apps do to keep mixes
 * feeling varied without dropping any of the source tracks.
 */
export function interleaveByArtist<T extends { artist?: string; id?: string }>(tracks: T[]): T[] {
  if (!tracks || tracks.length < 3) return tracks || [];
  const remaining = tracks.slice();
  const out: T[] = [];
  let lastArtist = "";

  while (remaining.length) {
    // Prefer the earliest track whose artist differs from the previous slot.
    let pickIdx = remaining.findIndex((t) => (t.artist || "").toLowerCase() !== lastArtist);
    if (pickIdx === -1) pickIdx = 0; // fall back — only same-artist tracks left
    const [pick] = remaining.splice(pickIdx, 1);
    out.push(pick);
    lastArtist = (pick.artist || "").toLowerCase();
  }
  return out;
}

/**
 * Same-artist streak breaker for an already-ordered queue.
 * If the incoming queue has runs of the same artist, pull later tracks up
 * to break the streak; otherwise it's a no-op.
 */
export function breakArtistStreaks<T extends { artist?: string }>(tracks: T[]): T[] {
  if (!tracks || tracks.length < 3) return tracks || [];
  const out = tracks.slice();
  for (let i = 1; i < out.length; i++) {
    const prev = (out[i - 1].artist || "").toLowerCase();
    const cur = (out[i].artist || "").toLowerCase();
    if (prev && cur && prev === cur) {
      // find swap candidate ahead with different artist
      const swapIdx = out.findIndex(
        (t, k) => k > i && (t.artist || "").toLowerCase() !== prev,
      );
      if (swapIdx > -1) {
        const tmp = out[i];
        out[i] = out[swapIdx];
        out[swapIdx] = tmp;
      }
    }
  }
  return out;
}
