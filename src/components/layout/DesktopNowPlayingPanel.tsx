import { ListMusic, Maximize2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/context/PlayerContext";

export function DesktopNowPlayingPanel() {
  const navigate = useNavigate();
  const { currentTrack, queue, removeFromQueue } = usePlayer();

  const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
  const upNext = currentIndex >= 0 ? queue.slice(currentIndex + 1, currentIndex + 11) : queue.slice(0, 10);

  return (
    <aside className="hidden h-full min-h-0 w-[300px] shrink-0 overflow-y-auto bg-background-elevated p-4 xl:block">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Now playing</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/now-playing")} aria-label="Open player">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {currentTrack ? (
        <>
          <div className="flex items-center gap-3">
            <img
              src={currentTrack.artwork || "/placeholder.svg"}
              alt={`${currentTrack.title} cover`}
              className="h-16 w-16 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{currentTrack.title}</p>
              <p className="truncate text-xs text-muted-foreground">{currentTrack.artist}</p>
            </div>
          </div>

          <div className="mt-5 pt-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><ListMusic className="h-4 w-4" /> Up next</span>
              <button onClick={() => navigate("/queue")} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Queue</button>
            </div>

            {upNext.length ? (
              <ul className="space-y-0.5">
                {upNext.map((track) => (
                  <li key={track.id} className="group flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-secondary">
                    <img src={track.artwork || "/placeholder.svg"} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{track.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{track.artist}</span>
                    </span>
                    <button
                      onClick={() => removeFromQueue(track.id)}
                      aria-label={`Remove ${track.title} from queue`}
                      className="shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">The queue is empty.</p>
            )}
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
