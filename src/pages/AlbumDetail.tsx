/**
 * Album detail — Spotify-style layout: large centred artwork, title block,
 * action row (save / download / more) with a primary play button, then a
 * numbered tracklist.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Download, Loader2, MoreHorizontal, Play, Plus, Shuffle,
} from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useDeezerAlbum } from "@/hooks/useMusicSearch";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { getLikedAlbums, toggleLikedAlbum } from "@/pages/Library";
import { downloadTrack, lastDownloadError } from "@/services/downloadService";
import { toTitleCase } from "@/utils/toTitleCase";
import { formatStreams } from "@/utils/formatStreams";
import { cn } from "@/lib/utils";

type DlState = Record<string, { status: "pending" | "downloading" | "done" | "failed"; percent: number }>;

function fmt(seconds?: number) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function totalLength(tracks: Track[]) {
  const secs = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  if (!secs) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

export default function AlbumDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { playCollection, currentTrack, isPlaying } = usePlayer();
  const [isSaved, setIsSaved] = useState(false);
  const [progressMap, setProgressMap] = useState<DlState>({});
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: album, isLoading } = useDeezerAlbum(id);

  useEffect(() => {
    if (album) setIsSaved(getLikedAlbums().some((a) => a.id === id));
  }, [album, id]);

  const tracks: Track[] = useMemo(
    () =>
      ((album?.tracks?.data || []) as any[]).map((t) => ({
        id: `deezer-album-${album?.id}-${t.id}`,
        title: toTitleCase(t.title),
        artist: toTitleCase(t.artist?.name || album?.artist?.name || "Unknown Artist"),
        album: album?.title || "",
        artwork: album?.cover_xl || album?.cover_big || album?.cover_medium || "",
        duration: t.duration || 0,
        explicit: Boolean(t.explicit_lyrics),
        streams: typeof t.rank === "number" ? t.rank * 1000 : undefined,
        trackNumber: t.track_position ?? undefined,
        diskNumber: t.disk_number ?? undefined,
      })) as Track[],
    [album],
  );

  usePreloadYouTube(tracks, tracks.length > 0);

  const handleSave = () => {
    if (!album) return;
    const result = toggleLikedAlbum({
      id,
      title: album.title,
      artist: album.artist?.name || "Unknown",
      artwork: album.cover_medium || album.cover || "",
    });
    setIsSaved(result);
    toast.success(result ? "Saved to your library" : "Removed from your library");
  };

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
        { groupKey: `album-${id}`, groupName: album?.title || "Album", groupType: "album" },
      );
      setProgressMap((p) => ({ ...p, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
      if (ok) done++;
      await new Promise((r) => setTimeout(r, 600));
    }
    setDownloadingAll(false);
    if (done) toast.success(`Downloaded ${done} of ${tracks.length} tracks`);
    else toast.error(lastDownloadError || "Download failed");
  }, [tracks, downloadingAll, id, album?.title]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <p className="text-sm text-muted-foreground">This album couldn't be loaded.</p>
        <button onClick={() => navigate(-1)} className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">Go back</button>
      </div>
    );
  }

  const cover = album.cover_xl || album.cover_big || album.cover_medium || "";
  const year = (album.release_date || "").slice(0, 4);

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto bg-background pb-32">
      {/* Header wash from the artwork */}
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[62vh]"
          style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) saturate(150%) brightness(0.5)" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[62vh] bg-gradient-to-b from-background/20 via-background/60 to-background" />

        <div className="relative px-5 pt-8">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-foreground outline-none backdrop-blur transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <motion.img
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            src={cover}
            alt={`${album.title} album cover`}
            className="mx-auto mt-6 aspect-square w-[62vw] max-w-[280px] rounded-md object-cover shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)]"
          />

          <div className="mt-6">
            <h1 className="text-[26px] font-black leading-tight tracking-tight text-foreground">{toTitleCase(album.title)}</h1>
            <button
              onClick={() => navigate(`/artist/${encodeURIComponent(album.artist?.name || "")}`)}
              className="mt-2 flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {album.artist?.picture_small && (
                <img src={album.artist.picture_small} alt="" className="h-6 w-6 rounded-full object-cover" />
              )}
              <span className="text-sm font-bold text-foreground">{toTitleCase(album.artist?.name || "")}</span>
            </button>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {[
                "Album",
                year,
                `${tracks.length} songs`,
                totalLength(tracks),
                album.label ? String(album.label) : "",
              ].filter(Boolean).join(" · ")}
            </p>
          </div>

          {/* Action row */}
          <div className="mt-5 flex items-center gap-5">
            <button onClick={handleSave} aria-label={isSaved ? "Remove from library" : "Save to library"} className={cn("outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary", isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              {isSaved ? <CheckCircle2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </button>
            <button onClick={handleDownloadAll} aria-label="Download album" disabled={downloadingAll} className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
              {downloadingAll ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />}
            </button>
            <button onClick={() => playCollection([...tracks].sort(() => Math.random() - 0.5), 0)} aria-label="Shuffle play" className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
              <Shuffle className="h-6 w-6" />
            </button>
            <button aria-label="More options" className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
              <MoreHorizontal className="h-6 w-6" />
            </button>
            <button
              onClick={() => tracks.length && playCollection(tracks, 0)}
              aria-label="Play album"
              className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
            >
              <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <ol className="mt-6 px-5">
        {tracks.map((track, i) => {
          const active = currentTrack?.id === track.id;
          const dl = progressMap[track.id];
          return (
            <li key={track.id}>
              <button
                onClick={() => playCollection(tracks, i)}
                className="flex w-full items-center gap-3 rounded-md py-2.5 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className={cn("w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums", active ? "text-primary" : "text-muted-foreground")}>
                  {active && isPlaying ? "▶" : i + 1}
                </span>
                <img
                  src={track.artwork || album.cover_medium || ""}
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
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {dl?.status === "downloading" ? `${dl.percent}%` : dl?.status === "done" ? "✓" : fmt(track.duration)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
