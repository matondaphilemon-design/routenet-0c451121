import { Heart, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/context/PlayerContext";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function DesktopPlayerBar() {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, togglePlay, next, previous, progress, duration, seek, shuffle, toggleShuffle, repeat, toggleRepeat } = usePlayer();
  if (!currentTrack) return null;

  return (
    <footer className="hidden h-[88px] shrink-0 grid-cols-[minmax(220px,1fr)_minmax(360px,1.5fr)_minmax(180px,1fr)] items-center border-t border-border bg-background-elevated px-4 lg:grid">
      <button onClick={() => navigate("/now-playing")} className="flex min-w-0 items-center gap-3 text-left">
        <img src={currentTrack.artwork || "/placeholder.svg"} alt="" className="h-14 w-14 rounded-md object-cover" />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{currentTrack.title}</span><span className="block truncate text-xs text-muted-foreground">{currentTrack.artist}</span></span>
        <Heart className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="px-6">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", shuffle && "text-primary")} onClick={toggleShuffle} aria-label="Shuffle"><Shuffle className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previous} aria-label="Previous"><SkipBack className="h-4 w-4" fill="currentColor" /></Button>
          <Button size="icon" className="h-9 w-9 rounded-full" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next} aria-label="Next"><SkipForward className="h-4 w-4" fill="currentColor" /></Button>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", repeat !== "off" && "text-primary")} onClick={toggleRepeat} aria-label="Repeat">{repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</Button>
        </div>
        <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
          <span className="w-9 text-right">{formatTime(progress * duration)}</span>
          <input aria-label="Playback position" type="range" min="0" max="1000" value={Math.round(progress * 1000)} onChange={(e) => seek(Number(e.target.value) / 1000)} className="h-1 w-full accent-primary" />
          <span className="w-9">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-muted-foreground"><Volume2 className="h-4 w-4" /><div className="h-1 w-24 rounded-full bg-secondary"><div className="h-full w-3/4 rounded-full bg-foreground" /></div></div>
    </footer>
  );
}