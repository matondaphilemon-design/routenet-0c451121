import { useCallback, useEffect, useState } from "react";
import { ArrowDownCircle, Heart, ListMusic, Loader2, Mic2, Pause, Play, Plus, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddToPlaylistDialog } from "@/components/AddToPlaylistDialog";
import { seekGlobalAudio } from "@/components/player/GlobalAudioPlayer";
import { usePlayer } from "@/context/PlayerContext";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function DesktopPlayerBar() {
  const navigate = useNavigate();
  const {
    currentTrack, isPlaying, togglePlay, next, previous, progress, duration,
    seek, shuffle, toggleShuffle, repeat, toggleRepeat,
  } = usePlayer();

  const [liked, setLiked] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "done" | "failed">("idle");

  useEffect(() => {
    const compute = () => {
      if (!currentTrack) return setLiked(false);
      try {
        const songs = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
        setLiked(songs.some((s: any) => s.title === currentTrack.title && s.artist === currentTrack.artist));
      } catch { setLiked(false); }
    };
    compute();
    window.addEventListener("liked-updated", compute);
    return () => window.removeEventListener("liked-updated", compute);
  }, [currentTrack?.title, currentTrack?.artist]);

  useEffect(() => setDownloadStatus("idle"), [currentTrack?.id]);

  const actualDuration = duration || currentTrack?.duration || 0;

  const handleSeek = useCallback((value: number) => {
    const ratio = value / 1000;
    seek(ratio);
    if (actualDuration > 0) seekGlobalAudio(ratio * actualDuration);
  }, [seek, actualDuration]);

  const toggleLike = useCallback(() => {
    if (!currentTrack) return;
    import("@/pages/Library").then(({ toggleLikedSong }) => setLiked(toggleLikedSong(currentTrack)));
  }, [currentTrack]);

  const handleDownload = useCallback(async () => {
    if (!currentTrack || downloadStatus === "downloading") return;
    setDownloadStatus("downloading");
    const mod = await import("@/services/downloadService");
    const ok = await mod.downloadTrack(currentTrack);
    setDownloadStatus(ok ? "done" : "failed");
    if (ok) toast.success("Downloaded to offline library");
    else toast.error(mod.lastDownloadError || "Download failed");
  }, [currentTrack, downloadStatus]);

  if (!currentTrack) return null;

  return (
    <>
      <footer className="hidden h-[88px] shrink-0 grid-cols-[minmax(220px,1fr)_minmax(360px,1.5fr)_minmax(200px,1fr)] items-center border-t border-border bg-background-elevated px-4 lg:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate("/now-playing")} className="flex min-w-0 items-center gap-3 text-left">
            <img src={currentTrack.artwork || "/placeholder.svg"} alt="" className="h-14 w-14 rounded-md object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{currentTrack.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{currentTrack.artist}</span>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 shrink-0", liked ? "text-primary" : "text-muted-foreground")}
            onClick={toggleLike}
            aria-label={liked ? "Remove from liked songs" : "Like song"}
            aria-pressed={liked}
          >
            <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
          </Button>
        </div>

        <div className="px-6">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className={cn("h-8 w-8", shuffle && "text-primary")} onClick={toggleShuffle} aria-label="Shuffle"><Shuffle className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previous} aria-label="Previous"><SkipBack className="h-4 w-4" fill="currentColor" /></Button>
            <Button size="icon" className="h-9 w-9 rounded-full" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next} aria-label="Next"><SkipForward className="h-4 w-4" fill="currentColor" /></Button>
            <Button variant="ghost" size="icon" className={cn("h-8 w-8", repeat !== "off" && "text-primary")} onClick={toggleRepeat} aria-label="Repeat">{repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</Button>
          </div>
          <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
            <span className="w-9 text-right">{formatTime(progress * actualDuration)}</span>
            <input
              aria-label="Playback position"
              type="range"
              min="0"
              max="1000"
              value={Math.round(progress * 1000)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="h-1 w-full accent-primary"
            />
            <span className="w-9">{formatTime(actualDuration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/lyrics")} aria-label="Lyrics"><Mic2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPlaylistDialog(true)} aria-label="Add to playlist"><Plus className="h-4 w-4" /></Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", downloadStatus === "done" && "text-primary")}
            onClick={handleDownload}
            aria-label="Download"
          >
            {downloadStatus === "downloading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/queue")} aria-label="Open queue"><ListMusic className="h-4 w-4" /></Button>
        </div>
      </footer>

      <AddToPlaylistDialog isOpen={showPlaylistDialog} onClose={() => setShowPlaylistDialog(false)} track={currentTrack} />
    </>
  );
}
