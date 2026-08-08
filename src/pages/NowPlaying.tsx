import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownCircle, ChevronDown, FileText, Heart, Loader2, ListMusic, MonitorPlay, MoreHorizontal, Pause, Play, Plus, Repeat, Repeat1, Share2, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AddToPlaylistDialog } from "@/components/AddToPlaylistDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { getCachedYouTubeId, seekGlobalAudio } from "@/components/player/GlobalAudioPlayer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";
import { cn } from "@/lib/utils";
import { SyncedVideoPanel } from "@/components/nowplaying/SyncedVideoPanel";
import { lookupMeta, peekMeta, type DeezerMeta } from "@/services/metadataEnrichment";

import { toTitleCase } from "@/utils/toTitleCase";

/** Progress ring geometry (viewBox is 100x100). */
const RING_R = 47;
const RING_C = 2 * Math.PI * RING_R;

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}


export default function NowPlaying() {
  const navigate = useNavigate();
  const { currentTrack, duration, isPlaying, next, nextTrack, previous, progress, queue, repeat, seek, shuffle, togglePlay, toggleRepeat, toggleShuffle } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const [showMore, setShowMore] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "done" | "failed">("idle");
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  /** Deezer metadata for the current song (title / artist / album / hi-res art). */
  const [meta, setMeta] = useState<DeezerMeta | null>(null);

  useEffect(() => setLocalProgress(progress), [progress]);

  // Now Playing shows Deezer metadata when it resolves; YouTube data is the fallback.
  useEffect(() => {
    if (!currentTrack) { setMeta(null); return; }
    let alive = true;
    setMeta(peekMeta(currentTrack.title, currentTrack.artist) ?? null);
    lookupMeta(currentTrack.title, currentTrack.artist)
      .then((m) => { if (alive) setMeta(m); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [currentTrack?.title, currentTrack?.artist]);

  const display = useMemo(() => ({
    title: meta?.title || currentTrack?.title || "",
    artist: meta?.artist || currentTrack?.artist || "",
    album: meta?.album || currentTrack?.album || "",
    artwork: meta?.artwork || currentTrack?.artwork || "",
  }), [meta, currentTrack]);


  useEffect(() => {
    const compute = () => {
      if (!currentTrack) {
        setLiked(false);
        return;
      }
      try {
        const likedSongs = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
        setLiked(likedSongs.some((song: any) => song.title === currentTrack.title && song.artist === currentTrack.artist));
      } catch {
        setLiked(false);
      }
    };
    compute();
    window.addEventListener("liked-updated", compute);
    return () => window.removeEventListener("liked-updated", compute);
  }, [currentTrack?.artist, currentTrack?.title]);

  const isResolving = useMemo(() => !!currentTrack && !currentTrack.youtubeId && !getCachedYouTubeId(currentTrack.title, currentTrack.artist), [currentTrack]);
  const videoId = useMemo(
    () => currentTrack?.youtubeId || getCachedYouTubeId(currentTrack?.title || "", currentTrack?.artist || "") || "",
    [currentTrack],
  );
  const actualDuration = duration || currentTrack?.duration || 0;
  const currentTime = Math.floor(localProgress * actualDuration);

  const handleSeek = useCallback((newProgress: number) => {
    seek(newProgress);
    setLocalProgress(newProgress);
    if (actualDuration > 0) seekGlobalAudio(newProgress * actualDuration);
  }, [actualDuration, seek]);

  const handleToggleLike = useCallback(() => {
    if (!currentTrack) return;
    import("@/pages/Library").then(({ toggleLikedSong }) => setLiked(toggleLikedSong(currentTrack)));
  }, [currentTrack]);

  const handleDownload = useCallback(async () => {
    if (!currentTrack || downloadStatus === "downloading") return;
    setDownloadStatus("downloading");
    setDownloadPercent(0);
    const mod = await import("@/services/downloadService");
    const ok = await mod.downloadTrack(currentTrack, (p) => setDownloadPercent(p));
    setDownloadStatus(ok ? "done" : "failed");
    if (ok) toast.success("Downloaded to offline library");
    else toast.error(mod.lastDownloadError || "Download failed");
  }, [currentTrack, downloadStatus]);

  if (!currentTrack) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="text-lg font-extrabold text-foreground">No track playing</p>
          <Button onClick={() => navigate("/")} className="mt-4 rounded-full">Go Home</Button>
        </div>
      </main>
    );
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-20 flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-background text-foreground">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTrack.artwork}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1.15 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${currentTrack.artwork})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) saturate(160%) brightness(0.55)",
          }}
        />
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,hsl(var(--primary)/0.28),transparent_45%),linear-gradient(180deg,hsl(0_0%_0%/0.35)_0%,hsl(0_0%_0%/0.75)_60%,hsl(var(--background))_100%)]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 pt-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back" className="rounded-full text-foreground hover:bg-secondary">
          <ChevronDown className="h-6 w-6" />
        </Button>
        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Now Playing</p>
          <p className="truncate text-xs font-semibold text-foreground">
            {nextTrack
              ? `Next: ${toTitleCase(nextTrack.title)} — ${toTitleCase(nextTrack.artist)}`
              : "Finding more music…"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowMore(true)} aria-label="More" className="rounded-full text-foreground hover:bg-secondary">
          <MoreHorizontal className="h-6 w-6" />
        </Button>
      </header>

      {/* Circular artwork wrapped in a live progress ring */}
      <section className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-7 py-4">
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="relative aspect-square w-[min(72vw,50dvh,320px)]"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={RING_R} fill="none" stroke="hsl(var(--foreground) / 0.14)" strokeWidth="2.5" />
            <circle
              cx="50"
              cy="50"
              r={RING_R}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - Math.min(Math.max(localProgress, 0), 1))}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>

          <div className="absolute inset-[7%] overflow-hidden rounded-full bg-card album-shadow ring-1 ring-border/60">
            {isResolving ? (
              <div className="flex h-full w-full items-center justify-center bg-secondary">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : (
              <img
                src={display.artwork}
                alt={display.title}
                className={`h-full w-full object-cover ${isPlaying ? "animate-vinyl" : "animate-vinyl paused"}`}
              />
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-background/80 ring-2 ring-border/60" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Song info directly beneath the artwork */}
      <section className="relative z-10 shrink-0 px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-1 text-[22px] font-black leading-tight tracking-tight text-foreground">{toTitleCase(display.title)}</h1>
            <button onClick={() => navigate(`/artist/${encodeURIComponent(display.artist)}`)} className="mt-1 line-clamp-1 text-left text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
              {toTitleCase(display.artist)}
              {display.album ? <span className="text-muted-foreground/60"> · {toTitleCase(display.album)}</span> : null}
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={handleToggleLike} aria-label="Like" className={cn("mt-1 shrink-0 rounded-full bg-secondary/70 text-muted-foreground hover:bg-muted", liked && "text-primary")}>
            <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
          </Button>
        </div>
      </section>

      {/* Fixed control deck — always visible, never scrolls */}
      <section className="relative z-10 shrink-0 space-y-4 px-7 pb-6 pt-4">
        <div>
          <Slider
            value={[localProgress * 100]}
            max={100}
            step={0.05}
            aria-label="Seek"
            onValueChange={([value]) => handleSeek(value / 100)}
            className="py-2 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] font-bold tabular-nums text-muted-foreground">
            <span aria-label="Elapsed time">{formatTime(currentTime)}</span>
            <span aria-label="Total time">{formatTime(actualDuration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle} className={cn("h-11 w-11 rounded-full text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-secondary hover:text-foreground", shuffle && "text-primary")}>
            <Shuffle className="h-[19px] w-[19px]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={previous} aria-label="Previous track" className="h-12 w-12 rounded-full text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-secondary">
            <SkipBack className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button
            onClick={togglePlay}
            disabled={isResolving}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-foreground p-0 text-background shadow-[0_10px_30px_-10px_hsl(var(--foreground)/0.6)] transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background hover:scale-[1.03] active:scale-95"
          >
            {isResolving ? <Loader2 className="h-7 w-7 animate-spin" /> : isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={next} aria-label="Next track" className="h-12 w-12 rounded-full text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-secondary">
            <SkipForward className="h-6 w-6" fill="currentColor" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleRepeat} aria-label={`Repeat: ${repeat}`} className={cn("h-11 w-11 rounded-full text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-secondary hover:text-foreground", repeat !== "off" && "text-primary")}>
            {repeat === "one" ? <Repeat1 className="h-[19px] w-[19px]" /> : <Repeat className="h-[19px] w-[19px]" />}
          </Button>
        </div>

        {/* Secondary actions — compact translucent pill bar */}
        <nav aria-label="Track actions" className="mx-auto flex w-full max-w-sm items-center justify-around rounded-full border border-border/40 bg-foreground/[0.06] px-1.5 py-1 backdrop-blur-xl">
          {[
            { icon: Mic2, label: "Lyrics", action: () => navigate("/lyrics"), active: false },
            { icon: Plus, label: "Save to playlist", action: () => setShowPlaylistDialog(true), active: false },
            {
              icon: downloadStatus === "downloading" ? Loader2 : ArrowDownCircle,
              label: downloadStatus === "done" ? "Downloaded" : downloadStatus === "downloading" ? `Downloading ${downloadPercent}%` : "Download",
              action: handleDownload,
              active: downloadStatus === "done",
              spin: downloadStatus === "downloading",
            },

            { icon: ListMusic, label: "Open queue", action: () => navigate("/queue"), active: false },
            { icon: Share2, label: "Share", action: () => setShowShareSheet(true), active: false },
          ].map(({ icon: Icon, label, action, active, spin }: any) => (
            <button
              key={label}
              type="button"
              onClick={action}
              aria-label={label}
              title={label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-all hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90",
                active && "bg-primary/15 text-primary",
              )}
            >
              <Icon className={cn("h-[17px] w-[17px]", spin && "animate-spin")} aria-hidden="true" />
            </button>
          ))}
        </nav>
      </section>



      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setShowMore(false)} />
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-card p-4 shadow-elevated">
              <div className="mb-4 flex items-center gap-3">
                <img src={currentTrack.artwork} alt={currentTrack.title} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{toTitleCase(currentTrack.title)}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{toTitleCase(currentTrack.artist)}</p>
                </div>
              </div>
              <div className="grid gap-2">
                {[
                  { icon: Plus, label: "Add to Playlist", action: () => setShowPlaylistDialog(true) },
                  { icon: ListMusic, label: "Open Queue", action: () => navigate("/queue") },
                  { icon: ArrowDownCircle, label: downloadStatus === "done" ? "Downloaded" : "Download", action: handleDownload },
                  { icon: Share2, label: "Share", action: () => setShowShareSheet(true) },
                ].map(({ icon: Icon, label, action }) => (
                  <Button key={label} variant="ghost" onClick={() => { action(); setShowMore(false); }} className="justify-start rounded-xl px-3 text-sm font-bold">
                    <Icon className="h-4 w-4 text-primary" />{label}
                  </Button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideo && videoId && (
          <SyncedVideoPanel
            videoId={videoId}
            title={display.title}
            startSeconds={currentTime}
            onClose={() => setShowVideo(false)}
          />
        )}
      </AnimatePresence>

      <ShareSheet isOpen={showShareSheet} onClose={() => setShowShareSheet(false)} item={{ type: "track", title: currentTrack.title, subtitle: currentTrack.artist, image: currentTrack.artwork, id: currentTrack.id }} />
      <AddToPlaylistDialog isOpen={showPlaylistDialog} onClose={() => setShowPlaylistDialog(false)} track={{ title: currentTrack.title, artist: currentTrack.artist, album: currentTrack.album, artwork: currentTrack.artwork, duration: currentTrack.duration }} />
    </motion.main>
  );
}
