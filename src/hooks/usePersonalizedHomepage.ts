import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnboardingPrefs } from "./useOnboardingPrefs";
import { useCallback, useMemo } from "react";
import { toTitleCase } from "@/utils/toTitleCase";

export interface HomepageSection {
  id: string;
  title: string;
  subtitle: string;
  layout: "hero_large" | "horizontal_medium" | "circular_artists" | "wide_landscape" | "grid_small";
  searchQueries: string[];
  contentType: "tracks" | "artists" | "albums";
  /** 40/25/15/20 mix bucket */
  category?: "new" | "hits" | "made_for_you" | "playlists";
}

const CACHE_KEY = "tunestream_homepage_cache";
const CACHE_TIMESTAMP_KEY = "tunestream_homepage_cache_ts";
const CACHE_DATE_KEY = "tunestream_homepage_cache_date";
const ONE_DAY = 24 * 60 * 60 * 1000;
const SESSION_FLAG = "tunestream_homepage_session_loaded";

function todayKey() { return new Date().toISOString().slice(0, 10); }

function getCachedHomepage(): HomepageSection[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const date = localStorage.getItem(CACHE_DATE_KEY);
    if (!cached || !ts || date !== todayKey()) return null;
    // Once the homepage has been built in this browser session, always
    // return the cached version — no auto-refresh on focus, navigation,
    // or stale-time. Only manual refresh or full page reload re-fetches.
    if (sessionStorage.getItem(SESSION_FLAG) === "1") {
      return JSON.parse(cached);
    }
    if (Date.now() - parseInt(ts, 10) > ONE_DAY) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedHomepage(sections: HomepageSection[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(sections));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    localStorage.setItem(CACHE_DATE_KEY, todayKey());
    sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {}
}

// fallback sections when ai is unavailable
function buildFallbackSections(artists: string[], genres: string[]): HomepageSection[] {
  const top = artists[0] || "Popular";
  const titleTop = top.charAt(0).toUpperCase() + top.slice(1);
  const g0 = genres[0] || "pop";
  const g1 = genres[1] || g0;
  // 6 new + 4 hits + 2 made_for_you + 3 playlists = 15 (40/27/13/20 ≈ 40/25/15/20)
  return [
    // NEW (6)
    { id: "hero", title: `${titleTop} - Newest Tracks`, subtitle: "Fresh from your top artist", layout: "hero_large", searchQueries: [`${top} new`, `${top} 2025`], contentType: "tracks", category: "new" },
    { id: "fresh-drops", title: "Fresh Drops For You", subtitle: "New from your artists", layout: "horizontal_medium", searchQueries: artists.slice(0, 3).map(a => `${a} 2025`), contentType: "tracks", category: "new" },
    { id: "new-in-genre", title: `New In ${g0}`, subtitle: "Latest in your favorite sound", layout: "horizontal_medium", searchQueries: [`${g0} new 2025`, `${g0} latest`], contentType: "tracks", category: "new" },
    { id: "collabs", title: "Fresh Collaborations", subtitle: "New features and remixes", layout: "horizontal_medium", searchQueries: artists.slice(0, 2).map(a => `${a} featuring 2025`), contentType: "tracks", category: "new" },
    { id: "gems", title: "Hidden New Gems", subtitle: "Under-the-radar releases", layout: "horizontal_medium", searchQueries: artists.map(a => `${a} deep cuts 2025`), contentType: "tracks", category: "new" },
    { id: "radio", title: `${titleTop} Radio`, subtitle: "Infinite mix of newest tracks", layout: "hero_large", searchQueries: [...artists.slice(0, 2), `${g0} new`], contentType: "tracks", category: "new" },
    // HITS (4)
    { id: "albums", title: "Essential Albums", subtitle: "Must-hear projects", layout: "horizontal_medium", searchQueries: artists.slice(0, 3).map(a => `${a} album`), contentType: "albums", category: "hits" },
    { id: "all-time", title: `All-Time ${titleTop}`, subtitle: "The classics that built the sound", layout: "horizontal_medium", searchQueries: [`${top} hits`, `${top} best`], contentType: "tracks", category: "hits" },
    { id: "timeless", title: `Timeless ${g0}`, subtitle: "Songs that never get old", layout: "horizontal_medium", searchQueries: [`${g0} classic hits`, `${g0} legendary`], contentType: "tracks", category: "hits" },
    { id: "throwback", title: "Throwback Favorites", subtitle: "Older hits, still on repeat", layout: "horizontal_medium", searchQueries: [`${g0} 2010 hits`, `${g1} throwback`], contentType: "tracks", category: "hits" },
    // MADE FOR YOU (2)
    { id: "because", title: `Because You Like ${titleTop}`, subtitle: "Tracks you'll love", layout: "horizontal_medium", searchQueries: [`${top} type beat`, `similar to ${top}`], contentType: "tracks", category: "made_for_you" },
    { id: "similar", title: "You Might Also Like", subtitle: "Similar vibes", layout: "circular_artists", searchQueries: artists.map(a => `${a} similar`), contentType: "artists", category: "made_for_you" },
    // PLAYLISTS (3)
    { id: "latenight", title: "Late Night Drive", subtitle: "Smooth after-hours mix", layout: "wide_landscape", searchQueries: genres.map(g => `${g} chill night`), contentType: "tracks", category: "playlists" },
    { id: "gym", title: "Gym Energy", subtitle: "High-intensity workout mix", layout: "wide_landscape", searchQueries: genres.map(g => `${g} workout energy`), contentType: "tracks", category: "playlists" },
    { id: "vibe-mix", title: "Your Vibe, Mixed", subtitle: "A blend made for your taste", layout: "wide_landscape", searchQueries: [`${g0} ${g1} mix`, `${top} mix`], contentType: "tracks", category: "playlists" },
  ];
}

export function usePersonalizedHomepage() {
  const { prefs, loading: prefsLoading } = useOnboardingPrefs();
  const queryClient = useQueryClient();

  const artists = prefs?.artists || [];
  const genres = prefs?.genres || [];

  const { data: aiSections, isLoading: aiLoading, error } = useQuery<HomepageSection[]>({
    queryKey: ["personalized-homepage", artists.join(","), genres.join(",")],
    queryFn: async () => {
      // Check localStorage cache first
      const cached = getCachedHomepage();
      if (cached && cached.length > 0) return cached;

      const fallbackSections = buildFallbackSections(artists, genres);

      try {
        const { data, error } = await supabase.functions.invoke("personalized-homepage", {
          body: { artists, genres },
        });

        if (error || data?.fallback) {
          setCachedHomepage(fallbackSections);
          return fallbackSections;
        }

        const sections = data?.sections || [];
        if (sections.length > 0) {
          setCachedHomepage(sections);
          return sections;
        }

        setCachedHomepage(fallbackSections);
        return fallbackSections;
      } catch (err) {
        console.warn("personalized homepage fallback used", err);
        setCachedHomepage(fallbackSections);
        return fallbackSections;
      }
    },
    enabled: artists.length > 0 || genres.length > 0,
    // Static for the entire session — never re-fetch on focus/remount.
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const refreshHomepage = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATE_KEY);
    sessionStorage.removeItem(SESSION_FLAG);
    queryClient.invalidateQueries({ queryKey: ["personalized-homepage"] });
  }, [queryClient]);

  const sections: HomepageSection[] = useMemo(() => {
    const raw = aiSections && aiSections.length > 0
      ? aiSections
      : (artists.length > 0 || genres.length > 0)
        ? buildFallbackSections(artists, genres)
        : [];
    // 1) Drop legacy "AI Playground" / "AI Experimental" sections from any source (including cached AI output).
    const banned = /\b(ai\s*(playground|experimental|background|sandbox)|experimentals?)\b/i;
    let filtered = raw.filter(s => !banned.test(s.title || ""));
    // 2) Enforce 50% genre coverage: inject a user genre into queries that don't reference one.
    if (genres.length > 0) {
      const lower = genres.map(g => g.toLowerCase());
      const target = Math.ceil(filtered.length / 2);
      let covered = filtered.filter(s =>
        s.searchQueries?.some(q => lower.some(g => q.toLowerCase().includes(g)))
      ).length;
      filtered = filtered.map(s => {
        const hasGenre = s.searchQueries?.some(q => lower.some(g => q.toLowerCase().includes(g)));
        if (hasGenre || covered >= target) return s;
        covered++;
        const g = genres[covered % genres.length];
        return { ...s, searchQueries: [`${s.searchQueries?.[0] || s.title} ${g}`, ...(s.searchQueries || []).slice(1)] };
      });
    }
    // 3) Title Case + subtitle capitalization
    return filtered.map(s => ({
      ...s,
      title: toTitleCase(s.title || ""),
      subtitle: s.subtitle ? s.subtitle.charAt(0).toUpperCase() + s.subtitle.slice(1) : s.subtitle,
    }));
  }, [aiSections, artists, genres]);

  return {
    sections,
    isLoading: prefsLoading || aiLoading,
    hasPrefs: artists.length > 0 || genres.length > 0,
    error,
    prefs,
    refreshHomepage,
  };
}
