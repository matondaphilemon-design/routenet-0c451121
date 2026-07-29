import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search as SearchIcon, WifiOff } from "lucide-react";
import type { Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useOnboardingPrefs } from "@/hooks/useOnboardingPrefs";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { useOfflineDetection } from "@/hooks/useOfflineDetection";
import { buildFeed, type SectionDescriptor } from "@/services/homeFeedEngine";
import { HomeSectionRow } from "@/components/home/HomeSectionRow";
import { QuickAccessGrid } from "@/components/home/QuickAccessGrid";
import { recordTasteEvent } from "@/services/tasteEvents";
import { AppLogo } from "@/components/brand/AppLogo";

import { supabase } from "@/integrations/supabase/client";

const INITIAL_BATCH = 6;
const BATCH_SIZE = 4;

function useUserSeed(): string {
  const [seed, setSeed] = useState<string>("anon");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setSeed(data.user.id);
    }).catch(() => {});
  }, []);
  return seed;
}

function getDisplayName(): string {
  try {
    const raw = localStorage.getItem("onboarding");
    if (raw) {
      const profile = JSON.parse(raw);
      if (typeof profile?.name === "string" && profile.name.trim()) return profile.name.trim();
    }
  } catch {}
  return "there";
}

export default function Home() {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { prefs, loading } = useOnboardingPrefs();
  const { history } = useListeningHistory();
  const { isOffline } = useOfflineDetection();
  const userSeed = useUserSeed();

  const followedArtists = useMemo(() => (prefs?.artists as string[] | undefined) || [], [prefs]);
  const followedGenres = useMemo(
    () => (((prefs as any)?.genres as any[] | undefined) || []).map((g, i) => ({
      id: typeof g === "object" ? (g.id ?? i) : i,
      name: typeof g === "object" ? String(g.name ?? g) : String(g),
    })),
    [prefs],
  );

  const hasPrefs = followedArtists.length > 0 || followedGenres.length > 0;
  // Frozen at mount: playing a song must NOT rebuild the feed (that collapsed
  // every loaded card row back to skeletons).
  const seedRef = useRef<Track | null>(null);
  if (seedRef.current === null && history.length > 0) seedRef.current = history[0];
  const recentSeed = seedRef.current;
  const seedKey = recentSeed ? `${recentSeed.title}|${recentSeed.artist}` : "";

  const sections: SectionDescriptor[] = useMemo(
    () => buildFeed({ followedArtists, followedGenres, recentSeed }, userSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followedArtists, followedGenres, seedKey, userSeed],
  );

  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleCount((c) => Math.min(c + BATCH_SIZE, sections.length));
      }
    }, { rootMargin: "600px 0px" });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [sections.length]);

  const handlePlay = useCallback((track: Track, source: Track[]) => {
    // One canonical path: the player owns discovery so a song can never
    // trigger two competing playlist fetches.
    playTrack(track, source);
    recordTasteEvent({ type: "play", title: track.title, artist: track.artist, trackId: track.id }).catch(() => {});
  }, [playTrack]);


  const displayName = getDisplayName();

  if (isOffline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-8 pb-24 text-center">
        <WifiOff className="mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-xl font-extrabold text-foreground">You're Offline</h1>
        <p className="mb-6 text-sm text-muted-foreground">Listen to your downloaded songs</p>
        <button onClick={() => navigate("/library")} className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground">
          Go to Downloads
        </button>
      </div>
    );
  }

  if (!hasPrefs && !loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-8 pb-24 text-center">
        <AppLogo className="mb-6 h-20 w-20 rounded-2xl border border-border/60 p-2 shadow-card" />
        <h1 className="mb-2 text-2xl font-extrabold text-foreground">
          Welcome to <span className="text-primary">routenet</span>
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">Tell us what you love and we'll build your feed</p>
        <button onClick={() => navigate("/onboarding")} className="w-64 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground">
          Get started
        </button>
      </div>
    );
  }

  const visibleSections = sections.slice(0, visibleCount);

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-28">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 pb-3 pt-9">
          <AppLogo className="h-9 w-9 rounded-lg border border-border/50 p-1" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">routenet</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">Good to see you, {displayName}</h1>
          </div>
          <button onClick={() => navigate("/search")} aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-muted">
            <SearchIcon className="h-4 w-4" />
          </button>
          <button onClick={() => navigate("/settings")} aria-label="Settings" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-muted">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="space-y-8 px-4 pt-5">
        <QuickAccessGrid />
        {visibleSections.map((section) => (
          <HomeSectionRow key={section.id} section={section} onPlay={handlePlay} />
        ))}
        {visibleCount < sections.length && (
          <div ref={sentinelRef} className="h-24 w-full" />
        )}
      </main>
    </div>
  );
}
