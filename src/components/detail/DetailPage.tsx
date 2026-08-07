/**
 * DetailPage — the single shared layout for every collection in the app
 * (albums, editorial playlists, user playlists, Liked Songs, Recently Played).
 *
 * Mobile keeps the centred-artwork Spotify layout; from `lg:` up it becomes a
 * gradient hero with a table tracklist.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Check, CheckCircle2, Download, Loader2, MoreHorizontal, Play, Plus, Shuffle,
} from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { downloadTrack, lastDownloadError } from "@/services/downloadService";
import { getDownloadedIds, DOWNLOADS_CHANGED } from "@/services/indexedDBService";
import { formatStreams } from "@/utils/formatStreams";
import { cn } from "@/lib/utils";

export type DlState = Record<string, { status: "pending" | "downloading" | "done" | "failed"; percent: number }>;

export function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function totalLength(tracks: Track[]) {
  const secs = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  if (!secs) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

export interface DetailPageProps {
  cover: string;
  title: string;
  /** "Album", "Playlist", "Public Playlist"… shown first in the meta line. */
  typeLabel: string;
  /** Additional meta segments — year, song count, length, label. */
  meta?: (string | undefined | false)[];
  owner?: { name: string; image?: string; onClick?: () => void };
  tracks: Track[];
  isSaved?: boolean;
  onToggleSave?: () => void;
  /** Group key for the offline library; download-all is hidden without it. */
  group?: { groupKey: string; groupName: string; groupType: "album" | "playlist" };
  /** Extra controls appended to the action row. */
  actions?: ReactNode;
  /** Rendered under the tracklist (e.g. an empty state). */
  children?: ReactNode;
}

export function DetailPage({
  cover, title, typeLabel, meta = [], owner, tracks,
  isSaved, onToggleSave, group, actions, children,
}: DetailPageProps) {
  const navigate = useNavigate();
  const { playCollection, currentTrack, isPlaying } = usePlayer();
  const [progressMap, setProgressMap] = useState<DlState>({});
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<string[]>(() => getDownloadedIds());

  useEffect(() => {
    const refresh = () => setDownloadedIds(getDownloadedIds());
    window.addEventListener(DOWNLOADS_CHANGED, refresh);
    return () => window.removeEventListener(DOWNLOADS_CHANGED, refresh);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!tracks.length || downloadingAll) return;
    setDownloadingAll(true);
    const init: DlState = {};
    tracks.forEach((t) => { init[t.id] = { status: "pending", percent: 0 }; });
    setProgressMap(init);
    toast.info(`Downloading ${tracks.length} tracks…`);

    let done = 0;
    for (const track of tracks) {
      setProgressMap((p) => ({ ...p, [track.id]: { status: "downloading", percent: 0 } }));
      const ok = await downloadTrack(
        track,
        (percent) => setProgressMap((p) => ({ ...p, [track.id]: { status: "downloading", percent } })),
        group,
      );
      setProgressMap((p) => ({ ...p, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
      if (ok) done++;
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
    if (done) toast.success(`Downloaded ${done} of ${tracks.length} tracks`);
    else toast.error(lastDownloadError || "Download failed");
  }, [tracks, downloadingAll, group]);

  const metaLine = [typeLabel, ...meta].filter(Boolean).join(" · ");

  return (
    <div className="bg-background pb-4 lg:min-h-full lg:pb-0">
      {/* Header wash from the artwork */}
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[62vh] lg:h-[42vh]"
          style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) saturate(150%) brightness(0.5)" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[62vh] bg-gradient-to-b from-background/20 via-background/60 to-background lg:h-[42vh]" />

        <div className="relative px-5 pt-8 lg:px-8 lg:pt-6">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-foreground outline-none backdrop-blur transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-primary lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="lg:flex lg:items-end lg:gap-6">
            <motion.img
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              src={cover || "/placeholder.svg"}
              alt={`${title} cover`}
              className="mx-auto mt-6 aspect-square w-[62vw] max-w-[280px] rounded-md object-cover shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] lg:mx-0 lg:mt-0 lg:h-56 lg:w-56 lg:max-w-none"
            />

            <div className="mt-6 lg:mt-0 lg:pb-2">
              <p className="hidden text-xs font-bold uppercase tracking-wide text-foreground lg:block">{typeLabel}</p>
              <h1 className="text-[26px] font-black leading-tight tracking-tight text-foreground lg:text-[56px] lg:leading-[1.05]">{title}</h1>
              {owner && (
                <button
                  onClick={owner.onClick}
                  className="mt-2 flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {owner.image && <img src={owner.image} alt="" className="h-6 w-6 rounded-full object-cover" />}
                  <span className="text-sm font-bold text-foreground">{owner.name}</span>
                </button>
              )}
              <p className="mt-2 text-xs font-semibold text-muted-foreground">{metaLine}</p>
            </div>
          </div>

          {/* Action row */}
          <div className="mt-5 flex items-center gap-5 lg:mt-6">
            <button
              onClick={() => tracks.length && playCollection(tracks, 0)}
              aria-label={`Play ${title}`}
              className="order-last flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary active:scale-95 lg:order-first"
            >
              <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
            </button>
            <button onClick={() => playCollection([...tracks].sort(() => Math.random() - 0.5), 0)} aria-label="Shuffle play" className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
              <Shuffle className="h-6 w-6" />
            </button>
            {onToggleSave && (
              <button onClick={onToggleSave} aria-label={isSaved ? "Remove from library" : "Save to library"} className={cn("outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary", isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                {isSaved ? <CheckCircle2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </button>
            )}
            {group && (
              <button onClick={handleDownloadAll} aria-label={`Download ${typeLabel.toLowerCase()}`} disabled={downloadingAll} className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
                {downloadingAll ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />}
              </button>
            )}
            {actions}
            <button aria-label="More options" className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary lg:ml-0">
              <MoreHorizontal className="h-6 w-6" />
            </button>
            <span className="ml-auto lg:hidden" />
          </div>
        </div>
      </div>

      {/* Desktop table header */}
      <div className="mt-8 hidden border-b border-border/60 px-8 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[32px_minmax(0,3fr)_minmax(0,2fr)_80px] lg:gap-4">
        <span className="text-center">#</span>
        <span>Title</span>
        <span>Album</span>
        <span className="text-right">Time</span>
      </div>

      {/* Tracklist */}
      <ol className="mt-4 px-5 pb-2 lg:mt-2 lg:px-8 lg:pb-0">
        {tracks.map((track, i) => {
          const active = currentTrack?.id === track.id;
          const dl = progressMap[track.id];
          const saved = downloadedIds.includes(track.id);
          return (
            <li key={`${track.id}-${i}`}>
              <button
                onClick={() => playCollection(tracks, i)}
                className="flex w-full items-center gap-3 rounded-md py-2.5 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary lg:grid lg:grid-cols-[32px_minmax(0,3fr)_minmax(0,2fr)_80px] lg:items-center lg:gap-4 lg:px-2"
              >
                <span className={cn("w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums lg:w-auto", active ? "text-primary" : "text-muted-foreground")}>
                  {active && isPlaying ? "▶" : i + 1}
                </span>

                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <img
                    src={track.artwork || cover || "/placeholder.svg"}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-md object-cover ring-1 ring-border/40"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[15px] font-semibold", active ? "text-primary" : "text-foreground")}>{track.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {(track as any).explicit && (
                        <span className="rounded-[3px] bg-muted px-1 text-[9px] font-bold uppercase text-muted-foreground">E</span>
                      )}
                      <span className="truncate text-[12px] text-muted-foreground">
                        {[track.artist, (track as any).streams ? `${formatStreams((track as any).streams)} plays` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </span>
                </span>

                <span className="hidden truncate text-[13px] text-muted-foreground lg:block">{track.album || ""}</span>

                <span className="flex shrink-0 items-center justify-end gap-2 text-[12px] tabular-nums text-muted-foreground">
                  {saved && <Check className="h-4 w-4 text-primary" aria-label="Downloaded" />}
                  {dl?.status === "downloading" ? `${dl.percent}%` : formatDuration(track.duration)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {children}
    </div>
  );
}

export default DetailPage;
