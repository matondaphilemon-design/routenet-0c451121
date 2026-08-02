/**
 * FullLyrics — immersive, chrome-less lyrics view (image-3 reference).
 * The AppLayout hides the bottom nav + mini player when we're on /lyrics
 * so this page truly fills the viewport.
 */
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Music2, Pause, Play, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/utils/toTitleCase";
import { getDominantColor, gradientFromRGB } from "@/utils/dominantColor";

function useCoverGradient(artwork?: string): string {
  const [bg, setBg] = useState("linear-gradient(180deg, #1a1a1a 0%, #050505 100%)");
  useEffect(() => {
    if (!artwork) return;
    let cancelled = false;
    getDominantColor(artwork).then((rgb) => { if (!cancelled) setBg(gradientFromRGB(rgb)); });
    return () => { cancelled = true; };
  }, [artwork]);
  return bg;
}

interface LyricLine { time: number; text: string; }
function parseSyncedLyrics(synced: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(synced)) !== null) {
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
    if (m[4].trim()) lines.push({ time, text: m[4].trim() });
  }
  return lines;
}

export default function FullLyrics() {
  const navigate = useNavigate();
  const { progress, duration, currentTrack, isPlaying, togglePlay } = usePlayer();
  const activeRef = useRef<HTMLParagraphElement>(null);
  const title = currentTrack?.title || "";
  const artist = currentTrack?.artist || "";
  const actualDuration = duration || currentTrack?.duration || 0;
  const currentTime = Math.floor(progress * actualDuration);
  const dynamicBg = useCoverGradient(currentTrack?.artwork);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lyrics", title, artist],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lyrics", { body: { title, artist } });
      if (error) throw error;
      return data as { lyrics: string | null; syncedLyrics?: string | null };
    },
    enabled: !!title && !!artist,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const syncedLines = useMemo(() => (data?.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null), [data?.syncedLyrics]);

  const activeIndex = useMemo(() => {
    if (!syncedLines) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [syncedLines, currentTime]);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const touchStartX = useRef(0);
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches[0].clientX - touchStartX.current < -80) navigate(-1);
  }, [navigate]);

  const hasSynced = !!syncedLines && syncedLines.length > 0;
  const plainLines = !hasSynced ? (data?.lyrics || "").split("\n").filter((l) => l.trim()) : [];
  const hasLyrics = !!(data?.lyrics || data?.syncedLyrics);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      style={{ background: dynamicBg, fontFamily: "'Instrument Serif', serif" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Full-screen background wash from the album art */}
      {currentTrack?.artwork && (
        <div className="pointer-events-none absolute inset-0 opacity-30 blur-3xl"
          style={{ backgroundImage: `url(${currentTrack.artwork})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-5 pt-10 pb-4">
        <button onClick={() => navigate(-1)} aria-label="Close"
          className="rounded-full bg-white/10 p-2 backdrop-blur text-white/90 hover:text-white">
          <ChevronDown className="h-5 w-5" />
        </button>
        <div className="text-center min-w-0 flex-1 px-3">
          <p className="text-[11px] font-sans font-bold tracking-[0.24em] uppercase text-white/70">Lyrics</p>
          <p className="mt-0.5 truncate text-[13px] font-sans font-semibold text-white/90">
            {toTitleCase(title)}{artist ? ` — ${toTitleCase(artist)}` : ""}
          </p>
        </div>
        <div className="w-9" />
      </header>

      {/* Lyric column */}
      <div className="relative flex-1 overflow-y-auto px-8">
        {isLoading && (
          <div className="flex h-full items-center justify-center gap-3 text-white/60">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="font-sans text-sm">Fetching lyrics…</span>
          </div>
        )}
        {!isLoading && isError && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-white/60">
            <Music2 className="h-10 w-10" />
            <p className="font-sans text-sm">Couldn't load lyrics.</p>
            <button onClick={() => refetch()} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-sans text-sm text-white/80">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        )}
        {!isLoading && !isError && !hasLyrics && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
            <Music2 className="h-10 w-10" />
            <p className="font-sans text-sm">No lyrics available.</p>
          </div>
        )}
        {!isLoading && !isError && hasLyrics && (
          <div className="mx-auto max-w-xl px-2 py-[38vh] space-y-7 text-center">
            {(hasSynced ? syncedLines! : plainLines.map((t, i) => ({ time: i, text: t }))).map((line, i) => {
              const isActive = hasSynced && i === activeIndex;
              const isPast = hasSynced && i < activeIndex;
              return (
                <p key={i} ref={isActive ? activeRef : undefined}
                  className={`mx-auto max-w-[22ch] text-center text-[30px] leading-[1.3] tracking-tight transition-all duration-500 sm:text-[34px] ${
                    isActive ? "text-white scale-[1.03] drop-shadow-[0_0_26px_rgba(255,255,255,0.35)]"
                    : isPast ? "text-white/25"
                    : "text-white/65"
                  }`}>
                  {line.text}
                </p>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative pb-10" />

    </motion.div>
  );
}
