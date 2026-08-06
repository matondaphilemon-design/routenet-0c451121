import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { getChart, transformTrack } from "@/services/deezer";
import type { Track } from "@/data/mockData";

const SLOTS = 8;

/**
 * Home quick access — exactly eight cards (2 across, 4 down) built from real
 * listening history and topped up with chart recommendations when the
 * listener hasn't played much yet.
 */
export function QuickAccessGrid() {
  const { playTrack } = usePlayer();
  const { history } = useListeningHistory();
  const [filler, setFiller] = useState<Track[]>([]);

  const needed = Math.max(0, SLOTS - history.length);

  useEffect(() => {
    if (needed === 0) { setFiller([]); return; }
    let cancelled = false;
    getChart(20)
      .then((rows: any[]) => {
        if (cancelled) return;
        setFiller((rows || []).map(transformTrack) as Track[]);
      })
      .catch(() => { /* history-only is fine */ });
    return () => { cancelled = true; };
  }, [needed]);

  const seen = new Set(history.map((t) => t.id));
  const recentSongs = [
    ...history.slice(0, SLOTS),
    ...filler.filter((t) => !seen.has(t.id)),
  ].slice(0, SLOTS);

  if (recentSongs.length === 0) return null;

  return (
    <div className="mb-6 space-y-6">
      <section className="space-y-2.5">
        <h2 className="px-1 text-[15px] font-extrabold tracking-tight text-foreground">Recently Listened</h2>
        <div className="grid grid-cols-2 grid-rows-4 gap-2">
          {recentSongs.map((t) => (
            <button
              key={t.id}
              onClick={() => playTrack(t, recentSongs)}
              className="group flex h-14 items-center gap-2.5 overflow-hidden rounded-md bg-secondary/60 pr-2 text-left transition-colors hover:bg-secondary active:scale-[0.98]"
            >
              <img src={t.artwork || "/placeholder.svg"} alt="" className="h-full w-14 shrink-0 object-cover" />
              <span className="line-clamp-2 min-w-0 flex-1 text-[12.5px] font-semibold leading-tight text-foreground">{t.title}</span>
              <Play className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" fill="currentColor" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
