import { Play, Heart, MoreHorizontal, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/utils/toTitleCase";
import type { Track } from "@/data/mockData";

/**
 * Responsive card width — roughly 2 cards on phones, 3 on tablets and
 * 4 on desktop, with a small peek so the row reads as scrollable.
 */
const CARD_W = "w-[40vw] sm:w-[27vw] md:w-[21vw] lg:w-[17vw] max-w-[210px]";
const ART = "overflow-hidden rounded-2xl bg-card ring-1 ring-border/40 shadow-sm transition-all duration-300 group-hover:shadow-elevated group-hover:ring-primary/30";
const IMG = "h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]";

function fmtDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtViews(views?: number) {
  if (!views) return "";
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${Math.round(views / 1_000)}K views`;
  return `${views} views`;
}

/**
 * Compact list-style song row — artwork, title, artist, album, duration,
 * like button and an overflow menu.
 */
export function SongListRow({
  track, onPlay, onLike, onMore, liked,
}: {
  track: Track;
  onPlay: () => void;
  onLike?: () => void;
  onMore?: () => void;
  liked?: boolean;
}) {
  const album = (track as any).album as string | undefined;
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-secondary/60">
      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {track.artwork ? (
            <img src={track.artwork} alt={track.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-4 w-4 text-white" fill="currentColor" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-foreground">{toTitleCase(track.title)}</p>
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {[toTitleCase(track.artist), album || ""].filter(Boolean).join(" • ")}
          </p>
        </div>
      </button>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtDuration(track.duration)}</span>
      <button
        onClick={onLike}
        aria-label="Like"
        className={cn("shrink-0 rounded-full p-1.5 transition-colors", liked ? "text-primary" : "text-muted-foreground hover:text-foreground")}
      >
        <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
      </button>
      <button onClick={onMore} aria-label="More options" className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

/** A vertical stack of song rows; several stacks scroll horizontally. */
export function SongListColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[86vw] shrink-0 snap-start space-y-1 sm:w-[62vw] md:w-[46vw] lg:w-[34vw] max-w-[420px]">
      {children}
    </div>
  );
}

export interface FeedVideo {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: number;
  views?: number;
  publishedAt?: string;
}

export function MusicVideoCard({ video, onClick }: { video: FeedVideo; onClick: () => void }) {
  const meta = [fmtViews(video.views), video.publishedAt ? new Date(video.publishedAt).getFullYear() : ""]
    .filter(Boolean)
    .join(" • ");
  return (
    <button onClick={onClick} className="group w-[70vw] shrink-0 snap-start text-left transition-transform active:scale-[0.97] sm:w-[46vw] md:w-[32vw] lg:w-[25vw] max-w-[320px]">
      <div className={cn("relative aspect-video", ART)}>
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} loading="lazy" decoding="async" className={IMG} />
        ) : <div className="h-full w-full bg-secondary" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {fmtDuration(video.duration) || <Eye className="h-3 w-3" />}
        </span>
        <span className="absolute bottom-2 right-2 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-[13px] font-bold text-foreground">{toTitleCase(video.title)}</p>
      <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">
        {[toTitleCase(video.artist), meta].filter(Boolean).join(" • ")}
      </p>
    </button>
  );
}

/**
 * Compact music-video row used on the homepage: two videos stacked per
 * column, columns scroll horizontally so ~two columns are visible at a time.
 */
export function MusicVideoListItem({ video, onClick }: { video: FeedVideo; onClick: () => void }) {
  const meta = [fmtViews(video.views), fmtDuration(video.duration)].filter(Boolean).join(" • ");
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
    >
      <div className={cn("relative h-[52px] w-[92px] shrink-0", ART)}>
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} loading="lazy" decoding="async" className={IMG} />
        ) : <div className="h-full w-full bg-secondary" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-4 w-4 text-white" fill="currentColor" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] font-bold leading-tight text-foreground">{toTitleCase(video.title)}</p>
        <p className="line-clamp-1 text-[10.5px] font-medium text-muted-foreground">
          {[toTitleCase(video.artist), meta].filter(Boolean).join(" • ")}
        </p>
      </div>
    </button>
  );
}

/** A column holding two stacked video rows. */
export function VideoListColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[78vw] shrink-0 snap-start space-y-1.5 sm:w-[46vw] md:w-[32vw] lg:w-[26vw] max-w-[340px]">
      {children}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="w-[86vw] shrink-0 space-y-2 sm:w-[62vw] md:w-[46vw] lg:w-[34vw] max-w-[420px]">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-lg bg-secondary/60" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-secondary/60" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-secondary/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VideoSkeleton() {
  return (
    <div className="w-[70vw] shrink-0 sm:w-[46vw] md:w-[32vw] lg:w-[25vw] max-w-[320px]">
      <div className="aspect-video animate-pulse rounded-2xl bg-secondary/60" />
      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-secondary/60" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
    </div>
  );
}

export function SongCard({ track, onClick }: { track: Track; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("group shrink-0 snap-start text-left active:scale-[0.97] transition-transform", CARD_W)}>
      <div className={cn("relative aspect-square", ART)}>
        <img src={track.artwork} alt={track.title} loading="lazy" decoding="async" className={IMG} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
        </div>
      </div>
      <p className="mt-2.5 line-clamp-1 text-[13px] font-bold text-foreground">{toTitleCase(track.title)}</p>
      <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">{toTitleCase(track.artist)}</p>
    </button>
  );
}

export function AlbumCard({ album, onClick }: {
  album: { id: string | number; title: string; cover: string; artist: string };
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn("group shrink-0 snap-start text-left active:scale-[0.97] transition-transform", CARD_W)}>
      <div className={cn("aspect-square", ART)}>
        {album.cover
          ? <img src={album.cover} alt={album.title} loading="lazy" decoding="async" className={IMG} />
          : <div className="h-full w-full bg-secondary" />}
      </div>
      <p className="mt-2.5 line-clamp-1 text-[13px] font-bold text-foreground">{toTitleCase(album.title)}</p>
      <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">{toTitleCase(album.artist)}</p>
    </button>
  );
}

export function PlaylistCard({ playlist, onClick }: {
  playlist: { id: string | number; title: string; cover: string; creator?: string };
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn("group shrink-0 snap-start text-left active:scale-[0.97] transition-transform", CARD_W)}>
      <div className={cn("aspect-square", ART)}>
        {playlist.cover
          ? <img src={playlist.cover} alt={playlist.title} loading="lazy" decoding="async" className={IMG} />
          : <div className="h-full w-full bg-secondary" />}
      </div>
      <p className="mt-2.5 line-clamp-2 text-[13px] font-bold leading-tight text-foreground">{playlist.title}</p>
      <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">{playlist.creator || "Playlist"}</p>
    </button>
  );
}

export function ArtistCard({ artist, onClick }: {
  artist: { id: string | number; name: string; picture: string; fans?: number };
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn("group shrink-0 snap-start text-center active:scale-[0.97] transition-transform", CARD_W)}>
      <div className="mx-auto aspect-square w-full overflow-hidden rounded-full bg-card ring-1 ring-border/40 transition-all duration-300 group-hover:ring-primary/40">
        {artist.picture
          ? <img src={artist.picture} alt={artist.name} loading="lazy" decoding="async" className={IMG} />
          : <div className="h-full w-full bg-secondary" />}
      </div>
      <p className="mt-2.5 line-clamp-1 text-[13px] font-bold text-foreground">{toTitleCase(artist.name)}</p>
      <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">Artist</p>
    </button>
  );
}

export function CardSkeleton({ round = false }: { round?: boolean }) {
  return (
    <div className={cn("shrink-0", CARD_W)}>
      <div className={cn("aspect-square animate-pulse bg-secondary/60", round ? "rounded-full" : "rounded-2xl")} />
      <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded bg-secondary/60" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
    </div>
  );
}
