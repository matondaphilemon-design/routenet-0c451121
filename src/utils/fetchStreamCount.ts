/**
 * Fetch exact stream/view count from Piped API.
 * Cached for 1 hour per video ID.
 */

const CACHE_DURATION = 3600000; // 1 hour
const cache = new Map<string, { count: number; timestamp: number }>();

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.video",
  "https://pipedapi.lunar.icu",
];

export async function fetchStreamCount(videoId: string): Promise<number | null> {
  if (!videoId) return null;

  const cached = cache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.count;
  }

  for (const base of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${base}/streams/${videoId}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const views = data.views || 0;
      cache.set(videoId, { count: views, timestamp: Date.now() });
      return views;
    } catch {
      continue;
    }
  }
  return null;
}
