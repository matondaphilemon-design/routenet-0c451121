import React, { useMemo } from "react";
import { useDeezerSearchTracks } from "@/hooks/useDeezerGenres";
import { toTitleCase } from "@/utils/toTitleCase";
import { Track } from "@/data/mockData";
import { interleaveByArtist } from "@/services/aiMixer";

function mapDeezer(t: any): Track {
  return {
    id: `deezer-${t.id}`,
    title: toTitleCase(t.title || "Unknown"),
    artist: toTitleCase(t.artist?.name || "Unknown"),
    album: t.album?.title || "",
    artwork: t.album?.cover_big || t.album?.cover_medium || "/placeholder.svg",
    duration: t.duration || 0,
    preview: t.preview,
  };
}

interface RailProps {
  title: string;
  query: string;
  onPlay: (t: Track, q: Track[]) => void;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>
      <button className="text-xs font-semibold text-muted-foreground hover:text-foreground">See All</button>
    </div>
  );
}

/* Compact square tile — professional card with title/artist below. */
export function TrackTileRail({ title, query, onPlay }: RailProps) {
  const { data: raw } = useDeezerSearchTracks(query, 20);
  const tracks = useMemo(() => interleaveByArtist<Track>((raw || []).map(mapDeezer)), [raw]);
  const items = tracks.length > 0 ? tracks : Array.from({ length: 6 }).map((_, i) => ({
    id: `sk-${i}`, title: "", artist: "", album: "", artwork: "", duration: 0,
  } as Track));

  return (
    <section>
      <SectionHeader title={title} />
      <div className="-mx-5 px-5 flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {items.map((t, i) => {
          const sk = !t.title;
          return (
            <button
              key={`${t.id}-${i}`}
              disabled={sk}
              onClick={() => tracks[0] && onPlay(t, tracks)}
              className="w-[128px] flex-shrink-0 text-left group"
            >
              <div className="relative h-[128px] w-[128px] rounded-2xl overflow-hidden neon-card shadow-card">
                {!sk ? (
                  <>
                    <img src={t.artwork} alt={t.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  </>
                ) : (
                  <div className="h-full w-full animate-pulse bg-white/5" />
                )}
              </div>
              <p className="mt-2 truncate text-[13px] font-semibold text-foreground leading-tight">
                {sk ? "\u00A0" : t.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">
                {sk ? "\u00A0" : t.artist}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* Larger release cards with artist name badge. */
export function NewReleaseRail({ title, query, onPlay }: RailProps) {
  const { data: raw } = useDeezerSearchTracks(query, 14);
  const tracks = useMemo(() => interleaveByArtist<Track>((raw || []).map(mapDeezer)), [raw]);
  const items = tracks.length > 0 ? tracks : Array.from({ length: 5 }).map((_, i) => ({
    id: `sk-${i}`, title: "", artist: "", album: "", artwork: "", duration: 0,
  } as Track));

  return (
    <section>
      <SectionHeader title={title} />
      <div className="-mx-5 px-5 flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {items.map((t, i) => {
          const sk = !t.title;
          return (
            <button
              key={`${t.id}-${i}`}
              disabled={sk}
              onClick={() => tracks[0] && onPlay(t, tracks)}
              className="w-[148px] flex-shrink-0 text-left group"
            >
              <div className="relative h-[148px] w-[148px] rounded-2xl overflow-hidden neon-card shadow-elevated">
                {!sk ? (
                  <img src={t.artwork} alt={t.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy" />
                ) : (
                  <div className="h-full w-full animate-pulse bg-white/5" />
                )}
                {!sk && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                    <div className="absolute bottom-0 inset-x-0 p-3">
                      <p className="text-[11px] font-semibold text-white/80 truncate">{t.artist}</p>
                      <p className="text-[13px] font-bold text-white truncate leading-tight">{t.title}</p>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* Circular artist rail like reference. */
export function ArtistCircleRail({
  title, query, onNavigate,
}: { title: string; query: string; onNavigate: (name: string) => void }) {
  const { data: raw } = useDeezerSearchTracks(query, 24);
  const artists = useMemo(() => {
    if (!raw) return [];
    const seen = new Set<string>();
    return (raw as any[])
      .filter((t) => {
        const n = t.artist?.name;
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .slice(0, 12)
      .map((t) => ({
        name: toTitleCase(t.artist.name),
        picture: t.artist.picture_big || t.artist.picture_medium || t.album?.cover_big || "",
      }));
  }, [raw]);

  const items = artists.length > 0 ? artists : Array.from({ length: 6 }).map(() => ({ name: "", picture: "" }));

  return (
    <section>
      <SectionHeader title={title} />
      <div className="-mx-5 px-5 flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {items.map((a, i) => {
          const sk = !a.name;
          return (
            <button
              key={`${a.name}-${i}`}
              disabled={sk}
              onClick={() => onNavigate(a.name)}
              className="w-[80px] flex-shrink-0 text-center group"
            >
              <div className="relative h-[80px] w-[80px] rounded-full overflow-hidden ring-1 ring-primary/25 shadow-card mx-auto">
                {!sk ? (
                  <img src={a.picture} alt={a.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy" />
                ) : (
                  <div className="h-full w-full animate-pulse bg-white/5" />
                )}
              </div>
              <p className="mt-2 truncate text-[12px] font-semibold text-foreground">
                {sk ? "\u00A0" : a.name}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* Backwards-compat exports — legacy Home imports still resolve. */
export const HomeRowSection = TrackTileRail as unknown as (p: any) => React.ReactElement;
export const ArtistGridSection = ({
  title, query, onPlay,
}: { title: string; emoji?: string; query: string; onPlay: (t: Track, q: Track[]) => void }) => (
  <TrackTileRail title={title} query={query} onPlay={onPlay} />
);
