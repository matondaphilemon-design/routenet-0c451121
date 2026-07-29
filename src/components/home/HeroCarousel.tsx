import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { useDeezerSearchTracks } from "@/hooks/useDeezerGenres";
import { toTitleCase } from "@/utils/toTitleCase";
import { Track } from "@/data/mockData";

interface Props {
  query?: string;
  onPlay?: (t: Track, q: Track[]) => void;
}

function mapDeezer(t: any): Track {
  return {
    id: `deezer-${t.id}`,
    title: toTitleCase(t.title || "Unknown"),
    artist: toTitleCase(t.artist?.name || "Unknown"),
    album: t.album?.title || "",
    artwork: t.album?.cover_xl || t.album?.cover_big || "/placeholder.svg",
    duration: t.duration || 0,
    preview: t.preview,
  };
}

/**
 * Featured hero card — big rounded artwork with "Featured" pill,
 * artist name, and a play button. Matches reference design.
 */
export function HeroFeature({ query = "trending", onPlay }: Props) {
  const { data: raw } = useDeezerSearchTracks(query, 8);
  const tracks = useMemo(() => (raw || []).map(mapDeezer), [raw]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (tracks.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % tracks.length), 6000);
    return () => clearInterval(id);
  }, [tracks.length]);

  const current = tracks[i];

  return (
    <section className="relative h-[200px] w-full rounded-3xl overflow-hidden neon-card shadow-elevated">
      {!current ? (
        <div className="absolute inset-0 animate-pulse bg-white/5" />
      ) : (
        <>
          <img
            src={current.artwork}
            alt={current.title}
            className="absolute inset-0 h-full w-full object-cover"
            key={current.id}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/25 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground border border-primary/40">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Featured
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 truncate">
                  {current.artist}
                </p>
                <h2 className="text-2xl font-bold text-white truncate leading-tight">
                  {current.title}
                </h2>
              </div>
              <button
                onClick={() => onPlay?.(current, tracks)}
                aria-label="Play featured"
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-glow text-white active:scale-95 transition-transform"
              >
                <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
              </button>
            </div>
          </div>
          {tracks.length > 1 && (
            <div className="absolute top-4 right-4 flex gap-1">
              {tracks.slice(0, 6).map((_, k) => (
                <span
                  key={k}
                  className={`h-1 rounded-full transition-all ${k === i ? "w-4 bg-white" : "w-1 bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* Legacy export kept so older imports don't break. */
export const HeroCarousel = HeroFeature;
