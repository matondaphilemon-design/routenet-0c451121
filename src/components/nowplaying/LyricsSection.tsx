import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, ChevronDown, ChevronUp, Music2, Maximize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface LyricLine {
  time: number;
  text: string;
}

function parseSyncedLyrics(synced: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
  let match;
  while ((match = regex.exec(synced)) !== null) {
    const mins = parseInt(match[1]);
    const secs = parseInt(match[2]);
    const ms = parseInt(match[3]);
    const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
    const text = match[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines;
}

interface LyricsSectionProps {
  title: string;
  artist: string;
  currentTime: number;
  duration: number;
}

export function LyricsSection({ title, artist, currentTime, duration }: LyricsSectionProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const activeRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", title, artist],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lyrics", {
        body: { title, artist },
      });
      if (error) throw error;
      return data as { lyrics: string | null; syncedLyrics?: string | null; source?: string };
    },
    enabled: !!title && !!artist,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const syncedLines = useMemo(() => {
    if (data?.syncedLyrics) return parseSyncedLyrics(data.syncedLyrics);
    return null;
  }, [data?.syncedLyrics]);

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
    if (expanded && activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, expanded]);

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mx-5 mt-4 rounded-2xl bg-white/[0.07] p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Lyrics</p>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-white/30" />
        </div>
      </motion.div>
    );
  }

  if (!data?.lyrics) return null;

  const hasSynced = !!syncedLines && syncedLines.length > 0;
  const plainLines = !hasSynced ? data.lyrics.split("\n").filter((l) => l.trim()) : [];

  const handleFullLyrics = () => {
    // Navigate to a full lyrics view, passing data via state
    navigate("/lyrics", {
      state: {
        title,
        artist,
        lyrics: data.lyrics,
        syncedLyrics: data.syncedLyrics,
        source: data.source,
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="mx-5 mt-4 rounded-2xl bg-gradient-to-br from-primary/20 via-white/[0.07] to-white/[0.04] p-4 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            {hasSynced ? "Synced Lyrics" : "Lyrics"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.source && (
            <span className="text-[9px] text-white/20 uppercase">{data.source}</span>
          )}
          <button onClick={handleFullLyrics} className="p-1 text-white/40 hover:text-primary">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`overflow-hidden transition-all duration-500 ${expanded ? "max-h-[60vh] overflow-y-auto" : "max-h-48"}`}
      >
        {hasSynced ? (
          <div className="space-y-2 py-1">
            {syncedLines!.map((line, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              return (
                <p key={i} ref={isActive ? activeRef : undefined}
                  className={`text-base leading-relaxed transition-colors duration-300 ${
                    isActive ? "text-white bg-primary/25 rounded px-1" : isPast ? "text-white/40" : "text-white/75"
                  }`}>
                  {line.text}
                </p>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 py-1">
            {plainLines.map((line, i) => (
              <p key={i} className="text-base text-white/85 leading-relaxed">{line}</p>
            ))}
          </div>
        )}
      </div>

      {!expanded && (
        <div className="pointer-events-none absolute bottom-12 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      )}

      <div className="mt-2 flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs font-semibold text-primary">
          {expanded ? <>Show less <ChevronUp className="h-3 w-3" /></> : <>Show more <ChevronDown className="h-3 w-3" /></>}
        </button>
        <button onClick={handleFullLyrics} className="text-xs font-semibold text-primary">
          View Full Lyrics →
        </button>
      </div>
    </motion.div>
  );
}
