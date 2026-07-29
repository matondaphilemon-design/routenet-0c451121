/**
 * Infinite radio queue wrapper around queueManager.
 * - Tracks a global history Set of recently-seen IDs to avoid repeats.
 * - Tracks per-section exclusion sets so a song shown in a homepage section
 *   doesn't immediately re-appear in radio for that section.
 *
 * Wired into the player via queueManager.startRadio / maybeRefill.
 */
import { Track } from "@/data/mockData";
import { queueManager } from "./queueManager";

const globalHistory = new Set<string>();
const sectionExclusions = new Map<string, Set<string>>();

export function rememberSectionTracks(sectionId: string, ids: string[]) {
  let set = sectionExclusions.get(sectionId);
  if (!set) { set = new Set(); sectionExclusions.set(sectionId, set); }
  for (const id of ids) set.add(id);
}

export function getExclusionsForSection(sectionId?: string): Set<string> {
  const out = new Set(globalHistory);
  if (sectionId) {
    const s = sectionExclusions.get(sectionId);
    if (s) s.forEach(id => out.add(id));
  }
  return out;
}

/**
 * Seed the radio queue with a clicked track. Returns the extra tracks to append.
 * If `sectionId` is provided, tracks already shown in that section are filtered out.
 */
export async function seedRadio(seed: Track, sectionId?: string): Promise<Track[]> {
  globalHistory.add(seed.id);
  const extras = await queueManager.startRadio(seed);
  const exclude = getExclusionsForSection(sectionId);
  const filtered = extras.filter(t => !exclude.has(t.id));
  filtered.forEach(t => globalHistory.add(t.id));
  return filtered;
}

export async function seedRadioQueue(seed: Track, visibleTracks: Track[] = [], sectionId?: string): Promise<Track[]> {
  if (sectionId && visibleTracks.length > 0) {
    rememberSectionTracks(sectionId, visibleTracks.map((t) => t.id));
  }
  const visibleIds = new Set(visibleTracks.map((t) => t.id));
  const extras = await seedRadio(seed, sectionId);
  return [seed, ...extras.filter((t) => t.id !== seed.id && !visibleIds.has(t.id))];
}

export async function seedSearchRadioQueue(seed: Track, searchResults: Track[] = []): Promise<Track[]> {
  const visibleIds = new Set(searchResults.map((t) => t.id).filter((id) => id !== seed.id));
  globalHistory.add(seed.id);
  const extras = await queueManager.startRadio(seed);
  const filtered = extras.filter((t) => t.id !== seed.id && !visibleIds.has(t.id) && !globalHistory.has(t.id));
  filtered.forEach((t) => globalHistory.add(t.id));
  return [seed, ...filtered];
}

export async function maybeRefillRadioQueue(currentTrack: Track | null, queue: Track[], currentIndex: number): Promise<Track[]> {
  if (currentTrack?.id) globalHistory.add(currentTrack.id);
  const fresh = await queueManager.maybeRefill(currentTrack, queue, currentIndex);
  const existing = new Set(queue.map((t) => t.id));
  const filtered = fresh.filter((t) => !existing.has(t.id) && !globalHistory.has(t.id));
  filtered.forEach((t) => globalHistory.add(t.id));
  return filtered;
}

export function recordPlayed(trackId: string) {
  globalHistory.add(trackId);
}

export function clearRadioHistory() {
  globalHistory.clear();
  sectionExclusions.clear();
}
