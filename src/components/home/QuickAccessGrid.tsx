import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Music2, Play } from "lucide-react";
import type { Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { getUserPlaylists, type PlaylistRow } from "@/services/playlistService";
import { useLikedSongs } from "@/hooks/useLikedSongs";

/**
 * Home quick access — the songs, albums and playlists the listener actually
 * came back for, instead of a grid of static feature shortcuts.
 */
export function QuickAccessGrid() {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { history } = useListeningHistory();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);

  useEffect(() => {
    getUserPlaylists().then((p) => setPlaylists(p || [])).catch(() => setPlaylists([]));
  }, []);

  const { songs: likedSongs } = useLikedSongs();

  const recentSongs = history.slice(0, 6);

  /** Albums pulled out of what was recently listened to. */
  const recentAlbums = useMemo(() => {
    const seen = new Map<string, Track>();
    for (const t of history) {
      const key = (t.album || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, t);
      if (seen.size >= 6) break;
    }
    return [...seen.values()];
  }, [history]);

  const hasAnything = recentSongs.length > 0 || recentAlbums.length > 0 || playlists.length > 0;
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

      {recentAlbums.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="px-1 text-[15px] font-extrabold tracking-tight text-foreground">Albums You Played</h2>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-hide">
            <div className="flex gap-3">
              {recentAlbums.map((t) => (
                <button
                  key={`al-${t.album}`}
                  onClick={() => navigate(`/album/${encodeURIComponent(t.album || "")}`)}
                  className="w-[34vw] max-w-[150px] shrink-0 text-left active:scale-[0.97] transition-transform"
                >
                  <img src={t.artwork || "/placeholder.svg"} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  <p className="mt-1.5 line-clamp-1 text-[12.5px] font-bold text-foreground">{t.album}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.artist}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2.5">
        <h2 className="px-1 text-[15px] font-extrabold tracking-tight text-foreground">Your Playlists</h2>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-hide">
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/liked")}
              className="w-[34vw] max-w-[150px] shrink-0 text-left active:scale-[0.97] transition-transform"
            >
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary/30">
                <Heart className="h-8 w-8 text-primary-foreground" fill="currentColor" />
              </div>
              <p className="mt-1.5 line-clamp-1 text-[12.5px] font-bold text-foreground">Liked Songs</p>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{(likedSongs || []).length} songs</p>
            </button>
            {playlists.slice(0, 8).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/user-playlist/${p.id}`)}
                className="w-[34vw] max-w-[150px] shrink-0 text-left active:scale-[0.97] transition-transform"
              >
                {p.cover_image ? (
                  <img src={p.cover_image} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-secondary">
                    <Music2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <p className="mt-1.5 line-clamp-1 text-[12.5px] font-bold text-foreground">{p.name}</p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">Playlist</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
