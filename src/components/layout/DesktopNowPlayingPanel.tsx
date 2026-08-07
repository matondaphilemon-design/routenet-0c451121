import { Heart, ListMusic, Maximize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/context/PlayerContext";

export function DesktopNowPlayingPanel() {
  const navigate = useNavigate();
  const { currentTrack, nextTrack } = usePlayer();

  return (
    <aside className="hidden h-full min-h-0 w-[300px] shrink-0 overflow-y-auto border-l border-border bg-background-elevated p-4 xl:block">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Now playing</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/now-playing")} aria-label="Open player">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {currentTrack ? (
        <>
          <img src={currentTrack.artwork || "/placeholder.svg"} alt={`${currentTrack.title} cover`} className="aspect-square w-full rounded-md object-cover shadow-elevated" />
          <div className="mt-4 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">{currentTrack.title}</p>
              <p className="truncate text-sm text-muted-foreground">{currentTrack.artist}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Like song"><Heart className="h-4 w-4" /></Button>
          </div>

          <div className="mt-7 border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-muted-foreground"><ListMusic className="h-4 w-4" /> Up next</div>
            {nextTrack ? (
              <button onClick={() => navigate("/queue")} className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-secondary">
                <img src={nextTrack.artwork || "/placeholder.svg"} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{nextTrack.title}</span><span className="block truncate text-xs text-muted-foreground">{nextTrack.artist}</span></span>
              </button>
            ) : <p className="text-xs text-muted-foreground">The queue is empty.</p>}
          </div>
        </>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center text-center">
          <ListMusic className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">Nothing playing</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose a song to start listening.</p>
        </div>
      )}
    </aside>
  );
}