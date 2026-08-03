import { memo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { Track } from "@/data/mockData";
import { toTitleCase } from "@/utils/toTitleCase";
import type { SectionSlot } from "@/constants/sections";
import {
  getSectionContent,
  type OnboardingData,
  type ResolvedTrack,
} from "@/services/aiContentService";

function toTrack(t: ResolvedTrack): Track {
  return {
    id: t.id,
    title: toTitleCase(t.title),
    artist: toTitleCase(t.artist),
    album: t.album || "",
    artwork: t.coverBig || t.cover || "/placeholder.svg",
    duration: t.duration || 0,
    preview: t.previewUrl,
    streams: t.streams,
  };
}

interface HomeSectionProps {
  slot: SectionSlot;
  user: OnboardingData;
  onPlay: (track: Track, queue: Track[], sectionId?: string) => void;
  hideStreams?: boolean;
  excludeIds?: string[];
  onResolved?: (ids: string[]) => void;
}

/**
 * Lazy section: only fetches AI content once it scrolls into view.
 * Container, title, and skeleton are rendered immediately.
 */
function HomeSectionImpl({ slot, user, onPlay, hideStreams, excludeIds, onResolved }: HomeSectionProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement | null>(null);
  const [items, setItems] = useState<ResolvedTrack[] | null>(null);
  const [seen, setSeen] = useState(false);

  // IntersectionObserver: load when within 300px of viewport
  useEffect(() => {
    if (seen || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    getSectionContent(slot, user, excludeIds)
      .then((res) => {
        if (!alive) return;
        setItems(res);
        onResolved?.(res.map((r) => r.id));
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [seen, slot, user]);

  const tracks = (items || []).map(toTrack);
  const albumIdById = new Map<string, string>();
  (items || []).forEach((it) => { if (it.albumId) albumIdById.set(it.id, it.albumId); });
  const isAlbumSection = slot.contentType === "album";
  const trackProps = (t: Track) => (hideStreams ? { ...t, streams: 0 as any } : t);
  const isLoading = items === null;
  const isEmpty = items !== null && items.length === 0;
  const title = toTitleCase(slot.title);

  // A section that resolved to nothing is removed entirely — no empty rows,
  // no placeholder cards, no dangling headings.
  if (isEmpty) return <section ref={ref} data-section-id={slot.id} className="hidden" />;

  // Hero layout: full-width artist spotlight card
  if (slot.layout === "hero") {
    const first = tracks[0];
    return (
      <section ref={ref} data-section-id={slot.id} className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl md:text-2xl font-extrabold text-foreground">{title}</h2>
        </div>
        {isLoading ? (
          <div className="rounded-2xl bg-white/5 animate-pulse h-40" />
        ) : isEmpty ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
            No recommendations found yet.
          </div>
        ) : (
          <button
            onClick={() => onPlay(first, tracks, slot.id)}
            className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-primary/30 via-fuchsia-500/20 to-cyan-500/20 p-4 text-left"
          >
            <div className="flex items-center gap-4">
              <img src={first.artwork} alt={first.artist} className="h-24 w-24 rounded-full object-cover shadow-xl" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Spotlight</p>
                <p className="text-2xl font-extrabold text-foreground truncate">{first.artist}</p>
                <p className="text-xs text-muted-foreground truncate">Top track: {first.title}</p>
              </div>
            </div>
          </button>
        )}
      </section>
    );
  }

  // Card width: 150px mobile, 180px desktop (Spotify-style)
  const CARD_W = "w-[150px] md:w-[180px] flex-shrink-0";

  if (slot.layout === "grid") {
    return (
      <section ref={ref} data-section-id={slot.id} className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl md:text-2xl font-extrabold text-foreground">{title}</h2>
          <button className="text-xs font-semibold text-muted-foreground hover:text-foreground">Show all</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square rounded-md bg-white/5 animate-pulse" />
                <div className="h-3 mt-2 rounded bg-white/5 animate-pulse" />
                <div className="h-2 mt-1 w-2/3 rounded bg-white/5 animate-pulse" />
              </div>
            ))
          ) : isEmpty ? (
            <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
              No recommendations available for this section.
            </div>
          ) : tracks.slice(0, 12).map((t) => {
                const albumId = albumIdById.get(t.id);
                if (isAlbumSection && albumId) {
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/album/${albumId}`)}
                      className="group cursor-pointer text-left w-full"
                    >
                      <div className="relative aspect-square rounded-md overflow-hidden shadow-lg">
                        <img src={t.artwork} alt={t.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                      </div>
                    </button>
                  );
                }
                 return <Card key={t.id} track={trackProps(t)} onPlay={() => onPlay(t, tracks, slot.id)} />;
              })}
        </div>
      </section>
    );
  }

  if (slot.layout === "list") {
    return (
      <section ref={ref} data-section-id={slot.id} className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl md:text-2xl font-extrabold text-foreground">{title}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-white/5 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
                  <div className="h-2 w-1/3 mt-1.5 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
            ))
          ) : isEmpty ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
              No content found for this section.
            </div>
          ) : tracks.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPlay(t, tracks, slot.id)}
                  className="flex items-center gap-3 hover:bg-white/5 rounded-md p-1.5 text-left"
                >
                  <img src={t.artwork} alt="" loading="lazy" className="h-12 w-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                  </div>
                </button>
              ))}
        </div>
      </section>
    );
  }

  // Default: carousel
  return (
    <section ref={ref} data-section-id={slot.id} className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-extrabold text-foreground">{title}</h2>
        <button className="text-xs font-semibold text-muted-foreground hover:text-foreground">Show all</button>
      </div>
      <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={CARD_W}>
                <div className="aspect-square rounded-md bg-white/5 animate-pulse" />
                <div className="h-3 mt-2 rounded bg-white/5 animate-pulse" />
                <div className="h-2 mt-1 w-2/3 rounded bg-white/5 animate-pulse" />
              </div>
            ))
          ) : isEmpty ? (
            <div className={`${CARD_W} rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-center text-muted-foreground`}>
              No content found here yet.
            </div>
          ) : tracks.slice(0, 15).map((t) =>
              slot.contentType === "artist" ? (
                <button
                  key={t.id}
                  onClick={() => navigate(`/artist/${encodeURIComponent(t.artist)}`)}
                  className={`${CARD_W} text-center group`}
                >
                  <div className="aspect-square rounded-full overflow-hidden mx-auto shadow-lg">
                    <img src={t.artwork} alt={t.artist} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground truncate">{t.artist}</p>
                  <p className="text-xs text-muted-foreground">Artist</p>
                </button>
              ) : isAlbumSection && albumIdById.get(t.id) ? (
                <button
                  key={t.id}
                  onClick={() => navigate(`/album/${albumIdById.get(t.id)}`)}
                  className={`${CARD_W} text-left group`}
                >
                  <div className="aspect-square rounded-md overflow-hidden shadow-lg">
                    <img src={t.artwork} alt={t.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                </button>
              ) : (
                <div key={t.id} className={CARD_W}>
                   <Card track={trackProps(t)} onPlay={() => onPlay(t, tracks, slot.id)} />
                </div>
              ),
            )}
      </div>
    </section>
  );
}

/* ── Spotify-style track card ── */
function Card({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button onClick={onPlay} className="group cursor-pointer text-left w-full">
      <div className="relative aspect-square rounded-md overflow-hidden shadow-lg">
        <img
          src={track.artwork}
          alt={track.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        />
        <span className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-primary opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all flex items-center justify-center shadow-xl">
          <Play className="h-4 w-4 text-primary-foreground ml-0.5" fill="currentColor" />
        </span>
      </div>
      <div className="mt-2">
        <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
        {typeof track.streams === "number" && track.streams > 0 && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {track.streams.toLocaleString()} streams
          </p>
        )}
      </div>
    </button>
  );
}

export const HomeSection = memo(HomeSectionImpl, (a, b) => {
  return a.slot === b.slot && a.user === b.user && a.onPlay === b.onPlay;
});
HomeSection.displayName = "HomeSection";