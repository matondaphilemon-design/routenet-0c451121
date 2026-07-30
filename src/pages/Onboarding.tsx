import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Check,
  Sparkles,
  Music2,
  Bell,
  Mail,
  Apple,
  ArrowRight,
  Loader2,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { genreArtistMap } from "@/constants/genreArtists";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type Step =
  | "welcome"
  | "signin"
  | "genres"
  | "subgenres"
  | "artists"
  | "similar"
  | "notifications"
  | "mood"
  | "done";

const STEP_ORDER: Step[] = [
  "welcome",
  "signin",
  "genres",
  "subgenres",
  "artists",
  "similar",
  "notifications",
  "mood",
  "done",
];

interface ArtistPick {
  id: number;
  name: string;
  picture?: string;
  monthlyListeners?: string;
}
interface GenrePick {
  id: number;
  name: string;
  gradient: string;
}

const GENRES: GenrePick[] = [
  { id: 1, name: "Hip-Hop", gradient: "from-secondary/80 to-background" },
  { id: 2, name: "Pop", gradient: "from-secondary/80 to-background" },
  { id: 3, name: "R&B", gradient: "from-secondary/80 to-background" },
  { id: 4, name: "Rock", gradient: "from-secondary/80 to-background" },
  { id: 5, name: "Electronic", gradient: "from-secondary/80 to-background" },
  { id: 6, name: "Afrobeats", gradient: "from-secondary/80 to-background" },
  { id: 7, name: "Indie", gradient: "from-secondary/80 to-background" },
  { id: 8, name: "Jazz", gradient: "from-secondary/80 to-background" },
  { id: 9, name: "Classical", gradient: "from-secondary/70 to-background" },
  { id: 10, name: "Country", gradient: "from-secondary/80 to-background" },
  { id: 11, name: "Reggae", gradient: "from-secondary/80 to-background" },
  { id: 12, name: "Metal", gradient: "from-secondary/80 to-background" },
  { id: 13, name: "Latin", gradient: "from-secondary/80 to-background" },
  { id: 14, name: "K-Pop", gradient: "from-secondary/80 to-background" },
  { id: 15, name: "Lo-fi", gradient: "from-secondary/80 to-background" },
  { id: 16, name: "Gospel", gradient: "from-secondary/80 to-background" },
];

const SUBGENRES_BY_GENRE: Record<string, string[]> = {
  "Hip-Hop": ["Trap", "Old School", "Drill", "Boom Bap", "Cloud Rap", "Alternative Hip-Hop"],
  "Pop": ["Synth Pop", "Electropop", "Dream Pop", "Bedroom Pop", "Dance Pop"],
  "R&B": ["Neo-Soul", "Alternative R&B", "Contemporary R&B", "Funk"],
  "Rock": ["Alternative", "Punk", "Grunge", "Classic Rock", "Indie Rock"],
  "Electronic": ["House", "Techno", "Dubstep", "Future Bass", "Ambient", "Drum & Bass"],
  "Afrobeats": ["Amapiano", "Alté", "Afro-fusion", "Highlife"],
  "Indie": ["Indie Folk", "Indie Pop", "Indie Rock", "Bedroom Pop"],
  "Jazz": ["Smooth Jazz", "Bebop", "Fusion", "Cool Jazz"],
  "Classical": ["Baroque", "Romantic", "Contemporary Classical", "Piano Solo"],
  "Country": ["Country Pop", "Bluegrass", "Outlaw", "Modern Country"],
  "Reggae": ["Dancehall", "Dub", "Roots Reggae", "Reggae Fusion"],
  "Metal": ["Metalcore", "Progressive Metal", "Death Metal", "Black Metal", "Thrash"],
  "Latin": ["Reggaeton", "Bachata", "Salsa", "Latin Trap", "Cumbia"],
  "K-Pop": ["K-Pop Boy Groups", "K-Pop Girl Groups", "K-R&B", "K-Hip-Hop"],
  "Lo-fi": ["Chillhop", "Vaporwave", "Study Beats", "Jazzhop"],
  "Gospel": ["Contemporary Gospel", "Traditional Gospel", "Christian R&B"],
};

const MOODS = [
  { name: "Chill", gradient: "from-secondary/80 to-background" },
  { name: "Party", gradient: "from-secondary/80 to-background" },
  { name: "Focus", gradient: "from-secondary/70 to-background" },
  { name: "Workout", gradient: "from-secondary/80 to-background" },
  { name: "Sleep", gradient: "from-secondary/70 to-background" },
  { name: "Romance", gradient: "from-secondary/80 to-background" },
  { name: "Sad", gradient: "from-secondary/80 to-background" },
  { name: "Happy", gradient: "from-secondary/80 to-background" },
];


const TOP_ARTISTS_BY_GENRE = genreArtistMap;

function saveOnboarding(data: any) {
  try {
    const existing = JSON.parse(localStorage.getItem("onboarding") || "{}");
    localStorage.setItem("onboarding", JSON.stringify({ ...existing, ...data }));
  } catch {
    localStorage.setItem("onboarding", JSON.stringify(data));
  }
}

async function deezer<T = any>(action: string, params: Record<string, any> = {}): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("deezer", {
      body: { action, params },
    });
    if (error) throw error;
    return data as T;
  } catch (e) {
    console.error(`deezer ${action} failed`, e);
    return null;
  }
}

function toArtistPick(a: any, i = 0): ArtistPick | null {
  const name = a?.name || a?.artist;
  if (!name) return null;
  const picture = a?.picture_xl || a?.picture_big || a?.picture_medium || a?.picture;
  if (!picture) return null;
  return {
    id: Number(a.id ?? i),
    name,
    picture,
    monthlyListeners: a?.nb_fan ? `${(a.nb_fan / 1_000_000).toFixed(1)}M fans` : undefined,
  };
}

/**
 * Real artists for a genre or sub-genre.
 *
 * Deezer's /search/artist returns junk acts literally named "Trap" or
 * "Amapiano", and its genre charts ignore the genre id, so we instead read the
 * artists off the top editorial playlists for that style.
 */
async function fetchArtistsForStyle(query: string, limit = 10): Promise<ArtistPick[]> {
  const playlists = await deezer<any>("searchPlaylist", { query, limit: 3 });
  const ids: number[] = (playlists?.data || [])
    .filter((p: any) => p?.id && (p?.nb_tracks ?? 1) > 0)
    .slice(0, 3)
    .map((p: any) => p.id);

  const trackLists = await Promise.all(
    ids.map((playlistId) => deezer<any>("getPlaylistTracks", { playlistId, limit: 30 })),
  );

  const seen = new Set<string>();
  const out: ArtistPick[] = [];
  // Round-robin across playlists so one playlist can't dominate.
  const lists = trackLists.map((d) => (d?.data || []) as any[]);
  const depth = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < depth && out.length < limit; i++) {
    for (const list of lists) {
      const pick = list[i]?.artist ? toArtistPick(list[i].artist) : null;
      if (!pick) continue;
      const key = pick.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pick);
      if (out.length >= limit) break;
    }
  }
  return out;
}

async function fetchRelatedArtists(artistId: number, limit = 8): Promise<ArtistPick[]> {
  const data = await deezer<any>("getArtistRelated", { artistId, limit });
  const list: any[] = data?.data || [];
  return list.map((a, i) => toArtistPick(a, i)).filter(Boolean) as ArtistPick[];
}

async function resolveKnownArtists(names: string[], limit = 16): Promise<ArtistPick[]> {
  const lists = await Promise.all(
    names.slice(0, limit).map(async (name) => {
      const res = await deezer<any>("searchArtist", { name, limit: 1 });
      const artist = res?.data?.[0];
      return artist ? toArtistPick(artist) : null;
    }),
  );
  return lists.filter(Boolean) as ArtistPick[];
}

function ProgressDots({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={
            i === index
              ? "h-1.5 w-6 rounded-full bg-primary transition-all"
              : i < index
              ? "h-1.5 w-1.5 rounded-full bg-primary/50"
              : "h-1.5 w-1.5 rounded-full bg-muted"
          }
        />
      ))}
    </div>
  );
}

function ArtistSearch({ onPick }: { onPick: (a: ArtistPick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ArtistPick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await deezer<any>("searchArtist", { name: term, limit: 6 });
      const list = (res?.data || [])
        .map((a: any, i: number) => toArtistPick(a, i))
        .filter(Boolean) as ArtistPick[];
      setResults(list);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="relative mt-3">
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any artist"
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-elevated">
          {results.map((a) => (
            <button
              key={a.id}
              onClick={() => { onPick(a); setQ(""); setResults([]); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary"
            >
              {a.picture && <img src={a.picture} className="h-8 w-8 rounded-full object-cover" />}
              <span className="text-sm font-semibold">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedGenres, setSelectedGenres] = useState<GenrePick[]>([]);
  const [selectedSubgenres, setSelectedSubgenres] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<ArtistPick[]>([]);
  const [similarArtists, setSimilarArtists] = useState<ArtistPick[]>([]);
  const [artists, setArtists] = useState<ArtistPick[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [artistsError, setArtistsError] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    newReleases: true,
    artistUpdates: true,
    playlistUpdates: false,
    friendActivity: false,
  });
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [signingIn, setSigningIn] = useState<"google" | "email" | null>(null);
  const stepIdx = STEP_ORDER.indexOf(step);
  const goto = (s: Step) => setStep(s);

  const availableSubgenres = Array.from(
    new Set(selectedGenres.flatMap((g) => SUBGENRES_BY_GENRE[g.name] || [])),
  );

  const loadArtists = async () => {
    setLoadingArtists(true);
    setArtistsError(false);
    try {
      // 1. Recognizable top artists first so onboarding immediately feels relevant.
      const seedNames = Array.from(new Set(selectedGenres.flatMap((g) => TOP_ARTISTS_BY_GENRE[g.name] || [])));
      const knownArtists = await resolveKnownArtists(seedNames, 28);

      // 2. Sub-genres (more specific)
      const subgenreLists = await Promise.all(
        selectedSubgenres.slice(0, 4).map((sg) => fetchArtistsForStyle(sg, 8)),
      );

      // 3. Genres from Deezer playlist tracks.
      const genreLists = await Promise.all(
        selectedGenres.slice(0, 4).map((g) => fetchArtistsForStyle(g.name, 10)),
      );

      // 4. Similar artists from the recognizable seeds.
      const relatedLists = await Promise.all(
        knownArtists.slice(0, 4).map((a) => fetchRelatedArtists(a.id, 6)),
      );

      const buckets = [knownArtists, ...subgenreLists, ...genreLists, ...relatedLists].filter((l) => l.length > 0);
      const results: ArtistPick[] = [];
      const seen = new Set<string>();
      const banned = new Set(
        [...selectedSubgenres, ...selectedGenres.map((g) => g.name)].map((s) => s.toLowerCase()),
      );
      const depth = Math.max(0, ...buckets.map((l) => l.length));
      for (let i = 0; i < depth; i++) {
        for (const bucket of buckets) {
          const a = bucket[i];
          if (!a) continue;
          const k = a.name.toLowerCase();
          if (seen.has(k) || banned.has(k)) continue;
          seen.add(k);
          results.push(a);
        }
      }

      if (results.length === 0) {
        const fallback = await fetchArtistsForStyle("top hits", 24);
        setArtists(fallback);
        if (fallback.length === 0) setArtistsError(true);
        return;
      }
      setArtists(results.slice(0, 24));
    } finally {
      setLoadingArtists(false);
    }
  };

  // Load artists whenever we enter the artists step
  useEffect(() => {
    if (step !== "artists" || selectedGenres.length === 0) return;
    loadArtists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Load similar artists based on picks
  useEffect(() => {
    if (step !== "similar" || selectedArtists.length === 0) return;
    setLoadingSimilar(true);
    (async () => {
      const results: ArtistPick[] = [];
      const seen = new Set(selectedArtists.map((a) => a.name.toLowerCase()));
      const lists = await Promise.all(
        selectedArtists.slice(0, 3).map((a) => fetchRelatedArtists(a.id, 8)),
      );
      for (const list of lists) {
        for (const x of list) {
          const k = x.name.toLowerCase();
          if (!seen.has(k) && x.picture) {
            seen.add(k);
            results.push(x);
          }
        }
      }
      setSimilarArtists(results.slice(0, 18));
      setLoadingSimilar(false);
    })();
  }, [step, selectedArtists]);

  const toggleGenre = (g: GenrePick) => {
    setSelectedGenres((prev) =>
      prev.some((x) => x.id === g.id) ? prev.filter((x) => x.id !== g.id) : [...prev, g],
    );
  };
  const toggleSubgenre = (s: string) => {
    setSelectedSubgenres((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };
  const toggleArtist = (a: ArtistPick) => {
    setSelectedArtists((prev) =>
      prev.some((x) => x.id === a.id) ? prev.filter((x) => x.id !== a.id) : [...prev, a],
    );
  };
  const toggleMood = (m: string) => {
    setSelectedMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleGoogle = async () => {
    setSigningIn("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (e: any) {
      toast.error(e?.message || "Google sign-in failed");
      setSigningIn(null);
    }
  };

  const finish = async () => {
    const onboardingData = {
      genres: selectedGenres,
      subgenres: selectedSubgenres,
      artists: selectedArtists,
      moods: selectedMoods,
      notifPrefs,
      completedAt: new Date().toISOString(),
    };
    saveOnboarding(onboardingData);
    localStorage.setItem("routenet-onboarded", "true");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_settings").upsert({
          user_id: user.id,
          settings: onboardingData as any,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      /* best-effort Cloud persistence */
    }
    toast.success("Welcome to Routenet");
    navigate("/home");
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,hsl(var(--primary)/0.35),transparent_55%),linear-gradient(180deg,hsl(var(--background)),hsl(0_0%_0%))]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-8 pt-12">
        <div className="mb-8 flex items-center justify-between">
          {step !== "welcome" && step !== "done" ? (
            <button
              onClick={() => {
                const prev = STEP_ORDER[stepIdx - 1];
                if (prev) goto(prev);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 backdrop-blur-md"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
          <ProgressDots index={stepIdx} total={STEP_ORDER.length} />
          {step === "genres" || step === "subgenres" || step === "artists" || step === "similar" || step === "mood" ? (
            <button
              onClick={() => {
                const next = STEP_ORDER[stepIdx + 1];
                if (next) goto(next);
              }}
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 flex-col"
          >
            {step === "welcome" && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary"
                >
                  <Music2 className="h-10 w-10 text-primary-foreground" />
                </motion.div>
                <h1 className="text-3xl font-bold tracking-tight">Routenet</h1>
                <p className="mt-3 max-w-xs text-sm font-medium text-muted-foreground">
                  Millions of songs. Personalized by AI. Made for the way you listen.
                </p>
                <button
                  onClick={() => goto("signin")}
                  className="mt-12 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
                >
                  Get Started <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => navigate("/home")}
                  className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Continue as Guest
                </button>
              </div>
            )}

            {step === "signin" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold leading-tight">Sign in to Routenet</h1>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Save your library, sync across devices and unlock personalized recommendations.
                </p>
                <div className="mt-10 space-y-3">
                  <button
                    onClick={handleGoogle}
                    disabled={signingIn === "google"}
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-white text-sm font-semibold text-black transition-transform active:scale-95 disabled:opacity-60"
                  >
                    {signingIn === "google" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.1a6.79 6.79 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                      </svg>
                    )}
                    Continue with Google
                  </button>
                  <button
                    onClick={() => navigate("/auth")}
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-secondary/50 text-sm font-semibold text-foreground transition-transform active:scale-95"
                  >
                    <Mail className="h-5 w-5" /> Continue with Email
                  </button>
                  <button
                    disabled
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-secondary/30 text-sm font-semibold text-muted-foreground"
                  >
                    <Apple className="h-5 w-5" /> Continue with Apple
                  </button>
                </div>
                <div className="mt-auto pt-8">
                  <button
                    onClick={() => goto("genres")}
                    className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}

            {step === "genres" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold leading-tight">
                  What do you <span className="text-primary">love</span> to listen to?
                </h1>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Pick a few genres. We'll use them to tune your recommendations.
                </p>
                <div className="mt-6 grid flex-1 grid-cols-2 gap-3 overflow-y-auto pb-4">
                  {GENRES.map((g) => {
                    const active = selectedGenres.some((x) => x.id === g.id);
                    return (
                      <motion.button
                        key={g.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleGenre(g)}
                        className={`relative h-24 overflow-hidden rounded-2xl bg-gradient-to-br ${g.gradient} p-3 text-left transition-all ${
                          active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                        }`}
                      >
                        <span className="absolute bottom-3 left-3 text-lg font-black text-white drop-shadow">
                          {g.name}
                        </span>
                        {active && (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <button
                  disabled={selectedGenres.length < 1}
                  onClick={() => goto("subgenres")}
                  className="mt-3 h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-all disabled:opacity-40"
                >
                  Continue ({selectedGenres.length} chosen)
                </button>
              </div>
            )}

            {step === "subgenres" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold leading-tight">
                  Pick your <span className="text-primary">sub-genres</span>
                </h1>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Narrow it down. This makes your feed a lot sharper.
                </p>
                <div className="mt-6 flex flex-1 flex-wrap content-start gap-2 overflow-y-auto pb-4">
                  {availableSubgenres.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Pick a genre first to see sub-genres.
                    </p>
                  ) : (
                    availableSubgenres.map((s) => {
                      const active = selectedSubgenres.includes(s);
                      return (
                        <motion.button
                          key={s}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => toggleSubgenre(s)}
                          className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
                          }`}
                        >
                          {s}
                        </motion.button>
                      );
                    })
                  )}
                </div>
                <button
                  onClick={() => goto("artists")}
                  className="mt-3 h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {selectedSubgenres.length > 0 ? `Continue (${selectedSubgenres.length})` : "Skip sub-genres"}
                </button>
              </div>
            )}

            {step === "artists" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold leading-tight">Pick artists you like</h1>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Based on your taste. Or search below for anyone.
                </p>

                <ArtistSearch
                  onPick={(a) => {
                    setArtists((prev) => (prev.some((x) => x.id === a.id) ? prev : [a, ...prev]));
                    setSelectedArtists((prev) =>
                      prev.some((x) => x.id === a.id) ? prev : [...prev, a],
                    );
                  }}
                />

                <div className="mt-4 grid flex-1 grid-cols-3 gap-3 overflow-y-auto pb-4">
                  {loadingArtists ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="shimmer aspect-square rounded-full bg-muted/40" />
                    ))
                  ) : artistsError || artists.length === 0 ? (
                    <div className="col-span-3 flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-sm font-semibold text-foreground">Couldn't load artists</p>
                      <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
                      <button
                        onClick={loadArtists}
                        className="mt-4 rounded-full bg-primary px-5 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    artists.map((a) => {
                      const active = selectedArtists.some((x) => x.id === a.id);
                      return (
                        <motion.button
                          key={a.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleArtist(a)}
                          className="flex flex-col items-center gap-1.5 text-center"
                        >
                          <div
                            className={`relative aspect-square w-full overflow-hidden rounded-full ${
                              active ? "ring-2 ring-primary" : "ring-1 ring-border"
                            }`}
                          >
                            {a.picture ? (
                              <img src={a.picture} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="h-full w-full bg-secondary" />
                            )}
                            {active && (
                              <div className="absolute inset-0 flex items-center justify-center bg-primary/45">
                                <Check className="h-5 w-5 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight">
                            {a.name}
                          </span>
                        </motion.button>
                      );
                    })
                  )}
                </div>
                <button
                  disabled={selectedArtists.length < 3}
                  onClick={() => goto("similar")}
                  className="mt-3 h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-all disabled:opacity-40"
                >
                  Continue ({selectedArtists.length}/3)
                </button>
              </div>
            )}

            {step === "similar" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold leading-tight">More like your picks</h1>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Based on the artists you selected. Add any you love.
                </p>
                <div className="mt-6 grid flex-1 grid-cols-3 gap-3 overflow-y-auto pb-4">
                  {loadingSimilar
                    ? Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="shimmer aspect-square rounded-2xl bg-muted/40" />
                      ))
                    : similarArtists.map((a) => {
                        const active = selectedArtists.some((x) => x.id === a.id);
                        return (
                          <motion.button
                            key={a.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleArtist(a)}
                            className="flex flex-col items-center gap-1.5 text-center"
                          >
                            <div
                              className={`relative aspect-square w-full overflow-hidden rounded-full ${
                                active ? "ring-4 ring-primary" : "ring-1 ring-border"
                              }`}
                            >
                              {a.picture && (
                                <img src={a.picture} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
                              )}
                              {active && (
                                <div className="absolute inset-0 flex items-center justify-center bg-primary/50">
                                  <Check className="h-6 w-6 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                            <span className="line-clamp-2 w-full text-[11px] font-bold leading-tight">
                              {a.name}
                            </span>
                          </motion.button>
                        );
                      })}
                </div>
                <button
                  onClick={() => goto("notifications")}
                  className="mt-3 h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Continue
                </button>
              </div>
            )}

            {step === "notifications" && (
              <div className="flex flex-1 flex-col">
                <div className="mx-auto mb-6 mt-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary">
                  <Bell className="h-10 w-10" />
                </div>
                <h1 className="text-center text-2xl font-bold leading-tight">Stay in the loop</h1>
                <p className="mt-2 text-center text-sm font-medium text-muted-foreground">
                  Only what you care about. You can change these anytime.
                </p>
                <div className="mt-8 space-y-2">
                  {[
                    { key: "newReleases", label: "New releases from artists you follow" },
                    { key: "artistUpdates", label: "Artist announcements & tours" },
                    { key: "playlistUpdates", label: "Playlist updates from friends" },
                    { key: "friendActivity", label: "Friend activity" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() =>
                        setNotifPrefs((p) => ({ ...p, [opt.key]: !p[opt.key as keyof typeof p] }))
                      }
                      className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/50 p-4 text-left"
                    >
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span
                        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                          notifPrefs[opt.key as keyof typeof notifPrefs] ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            notifPrefs[opt.key as keyof typeof notifPrefs] ? "translate-x-5" : ""
                          }`}
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => goto("mood")}
                  className="mt-auto h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Continue
                </button>
              </div>
            )}

            {step === "mood" && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-bold leading-tight">
                  What's your <span className="text-primary">mood</span>?
                </h1>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Pick the vibes you want to hear right now.
                </p>
                <div className="mt-6 grid flex-1 grid-cols-2 gap-3 overflow-y-auto pb-4">
                  {MOODS.map((m) => {
                    const active = selectedMoods.includes(m.name);
                    return (
                      <motion.button
                        key={m.name}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleMood(m.name)}
                        className={`relative h-24 overflow-hidden rounded-2xl bg-gradient-to-br ${m.gradient} p-3 text-left transition-all ${
                          active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                        }`}
                      >
                        <span className="absolute bottom-3 left-3 text-lg font-black text-white drop-shadow">
                          {m.name}
                        </span>
                        {active && (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <button
                  onClick={() => goto("done")}
                  className="mt-3 h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Continue
                </button>
              </div>
            )}

            {step === "done" && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary"
                >
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </motion.div>
                <h1 className="text-2xl font-bold">You're all set</h1>
                <p className="mt-3 max-w-xs text-sm font-medium text-muted-foreground">
                  Your feed is being tuned by AI. It only gets better the more you listen.
                </p>
                <button
                  onClick={finish}
                  className="mt-12 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Start Listening <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
