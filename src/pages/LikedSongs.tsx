import { useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Play, Shuffle, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useLikedSongs, likedSongToTrack } from "@/hooks/useLikedSongs";
import { usePlayer } from "@/context/PlayerContext";
import { Track } from "@/data/mockData";
import { useMemo, useState } from "react";
import { toTitleCase } from "@/utils/toTitleCase";

export default function LikedSongs() {
  const navigate = useNavigate();
  const { songs, loading } = useLikedSongs();
  const { play, setQueue, toggleShuffle, shuffle } = usePlayer();
  const [q, setQ] = useState("");

  const tracks: Track[] = useMemo(() => songs.map(likedSongToTrack), [songs]);
  const filtered = useMemo(() => {
    if (!q.trim()) return tracks;
    const needle = q.toLowerCase();
    return tracks.filter(t =>
      t.title.toLowerCase().includes(needle) || t.artist.toLowerCase().includes(needle)
    );
  }, [tracks, q]);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    play(tracks[0]);
    navigate("/now-playing");
  };

  const handlePlayTrack = (track: Track) => {
    setQueue(filtered);
    play(track);
    navigate("/now-playing");
  };

  return (
    <div className="min-h-screen pb-32 bg-gradient-to-b from-purple-900/40 via-background to-background">
      {/* header */}
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full flex items-center justify-center bg-background/60 hover:bg-background"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">Liked Songs</h1>
        </div>
      </div>

      {/* hero */}
      <div className="px-4 pt-4 flex items-center gap-4">
        <div className="h-32 w-32 rounded-lg bg-gradient-to-br from-indigo-400 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl">
          <Heart className="h-16 w-16 fill-white text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold">Playlist</p>
          <h2 className="text-2xl font-extrabold text-foreground mb-1">Liked Songs</h2>
          <p className="text-xs text-muted-foreground">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
      </div>

      {/* controls */}
      <div className="px-4 mt-5 flex items-center gap-3">
        <button
          onClick={handlePlayAll}
          disabled={tracks.length === 0}
          className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg disabled:opacity-40"
          aria-label="Play all"
        >
          <Play className="h-5 w-5 text-primary-foreground ml-0.5" fill="currentColor" />
        </button>
        <button
          onClick={toggleShuffle}
          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
            shuffle ? "text-primary bg-primary/10" : "text-foreground/70 hover:bg-white/10"
          }`}
          aria-label="Shuffle"
        >
          <Shuffle className="h-4 w-4" />
        </button>
      </div>

      {/* search */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 h-10">
          <Search className="h-4 w-4 text-foreground/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find in liked songs"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 outline-none"
          />
        </div>
      </div>

      {/* list */}
      <div className="px-2 mt-3">
        {loading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">
              {tracks.length === 0 ? "No liked songs yet" : "No matches"}
            </p>
            <p className="text-xs text-muted-foreground">
              {tracks.length === 0 ? "Tap the heart on any song to save it here" : "Try a different search"}
            </p>
          </div>
        )}
        {!loading && filtered.map((track, i) => (
          <motion.button
            key={track.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.3) }}
            onClick={() => handlePlayTrack(track)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 active:bg-white/10 text-left"
          >
            <img
              src={track.artwork || "/placeholder.svg"}
              alt=""
              className="h-12 w-12 rounded object-cover flex-shrink-0 bg-white/5"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {toTitleCase(track.title)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {toTitleCase(track.artist)}
              </p>
            </div>
            <Heart className="h-4 w-4 fill-primary text-primary flex-shrink-0" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
