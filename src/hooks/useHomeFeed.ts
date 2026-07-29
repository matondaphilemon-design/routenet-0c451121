import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildHomeFeed, type HomeFeed } from "@/services/recommendationEngine";
import { loadFeed, saveFeed } from "@/services/trackCacheDB";
import { useOnboardingPrefs } from "./useOnboardingPrefs";

const CACHE_KEY = "tunestream_home_feed_v3";
const CACHE_DATE_KEY = "tunestream_home_feed_v3_date";
const today = () => new Date().toISOString().slice(0, 10);
const ONE_DAY = 24 * 60 * 60 * 1000;

function readLocalCache(): HomeFeed | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const d = localStorage.getItem(CACHE_DATE_KEY);
    if (!raw || d !== today()) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function writeLocalCache(feed: HomeFeed) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(feed));
    localStorage.setItem(CACHE_DATE_KEY, today());
  } catch {}
}

export function useHomeFeed() {
  const { prefs, loading } = useOnboardingPrefs();
  const artists = prefs?.artists || [];
  const genres = prefs?.genres || [];
  const subgenres = prefs?.subgenres || [];
  const country = (prefs as any)?.country || (prefs as any)?.location || "";

  const feedKey = `${artists.join("|")}::${genres.join("|")}::${country}`;
  const [seed, setSeed] = useState<HomeFeed | null>(() => readLocalCache());

  // Hydrate from IndexedDB on mount (survives localStorage clears)
  useEffect(() => {
    if (seed) return;
    loadFeed(feedKey).then((res) => {
      if (res && Date.now() - res.cachedAt < ONE_DAY * 2) setSeed(res.feed as HomeFeed);
    }).catch(() => {});
  }, [feedKey, seed]);

  const query = useQuery<HomeFeed>({
    queryKey: ["home-feed-v3", feedKey],
    queryFn: async () => {
      const cached = readLocalCache();
      if (cached) return cached;
      const feed = await buildHomeFeed({ artists, genres, subgenres, country });
      writeLocalCache(feed);
      saveFeed(feedKey, feed).catch(() => {});
      return feed;
    },
    enabled: !loading && (artists.length > 0 || genres.length > 0),
    initialData: seed || undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  return {
    feed: query.data || seed || undefined,
    isLoading: loading || (!seed && query.isLoading),
    hasPrefs: artists.length > 0 || genres.length > 0,
  };
}
