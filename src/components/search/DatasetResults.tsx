import { useEffect, useState } from "react";
import { Loader2, ListMusic, Music } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";
import {
  searchDatasetTracks, searchDatasetPlaylists,
  type DatasetTrack, type DatasetPlaylist,
} from "@/services/playlistData";
import { resolveDatasetTracks, resolveDatasetPlaylist } from "@/services/datasetRecommendations";

interface Props {
  query: string;
}

/**
 * Search results served from the bundled curated playlist dataset.
 * Works offline and complements the live API results.
 */
export function DatasetResults({ query }: Props) {
  const { play, setQueue } = usePlayer();
  const [tracks, setTracks] = useState<DatasetTrack[]>([]);
  const [playlists, setPlaylists] = useState<DatasetPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (query.trim().length < 2) {
      setTracks([]);
      setPlaylists([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([searchDatasetTracks(query, 8), searchDatasetPlaylists(query, 5)])
        .then(([t, p]) => {
          if (!active) return;
          setTracks(t);
          setPlaylists(p);
        })
        .catch(() => {
          if (active) { setTracks([]); setPlaylists([]); }
        })
        .finally(() => active && setLoading(false));
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const playTrack = async (entry: DatasetTrack) => {
    setBusyId(entry.id);
    try {
      const resolved = await resolveDatasetTracks([entry], 1);
      if (resolved[0]) {
        setQueue(resolved, { mode: "radio" });
        play(resolved[0]);
      }
    } finally {
      setBusyId(null);
    }
  };

  const playPlaylist = async (pl: DatasetPlaylist) => {
    setBusyId(pl.id);
    try {
      const resolved = await resolveDatasetPlaylist(pl, 15);
      if (resolved.length) {
        setQueue(resolved, { mode: "fixed" });
        play(resolved[0]);
      }
    } finally {
      setBusyId(null);
    }
  };

  if (query.trim().length < 2) return null;
  if (!loading && tracks.length === 0 && playlists.length === 0) return null;

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching the curated library
        </div>
      )}

      {playlists.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">Curated Playlists</h2>
          <div className="space-y-1">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => playPlaylist(pl)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/10 active:bg-white/15"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  {busyId === pl.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListMusic className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{pl.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pl.tracks.length} tracks · {pl.category}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {tracks.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">From the Playlist Library</h2>
          <div className="space-y-1">
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => playTrack(t)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/10 active:bg-white/15"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{t.track}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
