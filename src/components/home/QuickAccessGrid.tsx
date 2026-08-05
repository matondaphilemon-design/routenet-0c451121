import { Play } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";
import { useListeningHistory } from "@/hooks/useListeningHistory";

/**
 * Home quick access — the songs, albums and playlists the listener actually
 * came back for, instead of a grid of static feature shortcuts.
 */
export function QuickAccessGrid() {
  const { playTrack } = usePlayer();
  const { history } = useListeningHistory();
  const recentSongs = history.slice(0, 4);

  const hasAnything = recentSongs.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="mb-6 space-y-6">
      {recentSongs.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="px-1 text-[15px] font-extrabold tracking-tight text-foreground">Recently Listened</h2>
          <div className="grid grid-cols-2 gap-2">
            {recentSongs.map((t) => (
              <button
                key={t.id}
                onClick={() => playTrack(t, recentSongs)}
                className="group flex h-14 items-center gap-2.5 overflow-hidden rounded-md bg-secondary/60 pr-2 text-left transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                <img src={t.artwork || "/placeholder.svg"} alt="" className="h-full w-14 shrink-0 object-cover" />
                <span className="line-clamp-2 min-w-0 flex-1 text-[12.5px] font-semibold leading-tight text-foreground">{t.title}</span>
                <Play className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" fill="currentColor" />
              </button>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
