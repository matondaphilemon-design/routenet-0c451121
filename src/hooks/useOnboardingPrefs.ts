import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingPrefs {
  genres: string[];
  subgenres: string[];
  artists: string[];
  age: string;
  country?: string;
}

const GENRE_QUERY_MAP: Record<string, string> = {
  "Hip-Hop": "hip hop rap trending",
  "Pop": "pop hits 2025",
  "R&B": "r&b soul new",
  "Electronic": "electronic dance edm",
  "Rock": "rock classic anthem",
  "Indie": "indie alternative rock",
  "Afrobeats": "afrobeats amapiano",
  "Jazz": "jazz smooth instrumental",
  "Classical": "classical piano orchestra",
  "Country": "country new releases",
  "Reggae": "reggae dancehall",
  "Metal": "metal heavy rock",
  "Lo-fi": "chill lofi beats",
  "K-Pop": "k-pop korean",
  "Latin": "latin reggaeton",
  "Gospel": "gospel worship praise",
};

const SUBGENRE_QUERY_MAP: Record<string, string> = {
  "Trap": "trap beats 2025",
  "Old School": "old school hip hop classic",
  "Drill": "drill uk ny",
  "Synth Pop": "synth pop retro",
  "Electropop": "electropop dance",
  "Dream Pop": "dream pop shoegaze",
  "Neo-Soul": "neo soul erykah badu",
  "House": "house music deep",
  "Techno": "techno berlin underground",
  "Dubstep": "dubstep bass",
  "Amapiano": "amapiano south africa",
  "Reggaeton": "reggaeton perreo",
  "Bachata": "bachata romantic",
  "Smooth Jazz": "smooth jazz chill",
  "Bebop": "bebop jazz classic",
  "Alternative": "alternative rock indie",
  "Punk": "punk rock energy",
  "Grunge": "grunge 90s seattle",
  "Chillhop": "chillhop lofi study",
  "Vaporwave": "vaporwave aesthetic",
  "K-Pop Boy Groups": "kpop boy group",
  "K-Pop Girl Groups": "kpop girl group",
  "Contemporary Gospel": "contemporary gospel praise",
  "Metalcore": "metalcore heavy breakdown",
  "Progressive Metal": "progressive metal djent",
  "Country Pop": "country pop crossover",
  "Bluegrass": "bluegrass acoustic",
  "Dancehall": "dancehall caribbean",
  "Dub": "dub reggae bass",
  "Indie Folk": "indie folk acoustic",
  "Bedroom Pop": "bedroom pop chill",
  "Future Bass": "future bass melodic",
  "Ambient": "ambient electronic relaxing",
};

function parseLegacyPrefs(raw: string): OnboardingPrefs | null {
  try {
    const parsed = JSON.parse(raw);
    const genres = Array.isArray(parsed.genres) ? parsed.genres.filter(Boolean) : [];
    const artists = Array.isArray(parsed.artists) ? parsed.artists.filter(Boolean) : [];
    const subgenres = Array.isArray(parsed.subgenres) ? parsed.subgenres.filter(Boolean) : [];
    const age = typeof parsed.age === "string" ? parsed.age : "";
    if (genres.length === 0 && artists.length === 0) return null;
    return { genres, artists, subgenres, age };
  } catch {
    return null;
  }
}

function parseOnboardingPrefs(raw: string): OnboardingPrefs | null {
  try {
    const parsed = JSON.parse(raw);
    const genres = Array.isArray(parsed.genres)
      ? parsed.genres.map((g: any) => (typeof g === "string" ? g : g?.name)).filter(Boolean)
      : [];
    const artists = Array.isArray(parsed.artists)
      ? parsed.artists.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean)
      : [];
    const subgenres = Array.isArray(parsed.subgenres)
      ? parsed.subgenres.map((s: any) => (typeof s === "string" ? s : s?.name)).filter(Boolean)
      : [];
    const age = typeof parsed.ageRange === "string" ? parsed.ageRange : typeof parsed.age === "string" ? parsed.age : "";
    const country = typeof parsed.country === "string" ? parsed.country : typeof parsed.location === "string" ? parsed.location : "";
    if (genres.length === 0 && artists.length === 0) return null;
    return { genres, artists, subgenres, age, country };
  } catch {
    return null;
  }
}

function readStoredPrefs(): OnboardingPrefs | null {
  try {
    const legacy = localStorage.getItem("tunestream-prefs");
    if (legacy) {
      const prefs = parseLegacyPrefs(legacy);
      if (prefs) return prefs;
    }
    const onboarding = localStorage.getItem("onboarding");
    if (onboarding) {
      const prefs = parseOnboardingPrefs(onboarding);
      if (prefs) return prefs;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function useOnboardingPrefs() {
  const [prefs, setPrefs] = useState<OnboardingPrefs | null>(() => {
    if (typeof window === "undefined") return null;
    return readStoredPrefs();
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("bio")
            .eq("user_id", user.id)
            .single();
          if (data?.bio) {
            const parsed = JSON.parse(data.bio);
            if (parsed.genres || parsed.artists) {
              setPrefs({ ...parsed, subgenres: parsed.subgenres || [] } as OnboardingPrefs);
              setLoading(false);
              return;
            }
          }
        }
      } catch { /* ignore */ }

      const stored = readStoredPrefs();
      if (stored) {
        setPrefs(stored);
      }
      setLoading(false);
    })();
  }, []);

  return { prefs, loading };
}

export function getPersonalizedQueries(prefs: OnboardingPrefs | null) {
  if (!prefs || prefs.genres.length === 0) return null;

  const queries: { query: string; label: string; sub: string; emoji: string }[] = [];

  // Add subgenre-based queries first (more specific)
  if (prefs.subgenres && prefs.subgenres.length > 0) {
    for (const sg of prefs.subgenres) {
      const q = SUBGENRE_QUERY_MAP[sg];
      if (q) {
        queries.push({
          query: q,
          label: `${sg} Mix`,
          sub: "Matched to your sub-genre taste",
          emoji: "🎯",
        });
      } else {
        queries.push({
          query: sg.toLowerCase(),
          label: `${sg} Mix`,
          sub: "Based on your taste",
          emoji: "🎯",
        });
      }
    }
  }

  // Add genre-based queries
  for (const genre of prefs.genres) {
    const q = GENRE_QUERY_MAP[genre];
    if (q) {
      queries.push({
        query: q,
        label: `${genre} For You`,
        sub: "Based on your taste",
        emoji: "",
      });
    }
  }

  // Add artist-based queries
  for (const artist of prefs.artists) {
    queries.push({
      query: `${artist} similar artists`,
      label: `Because you like ${artist}`,
      sub: "Similar sounds",
      emoji: "🎯",
    });
  }

  return queries;
}
