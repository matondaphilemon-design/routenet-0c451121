import { useState } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Play,
  Pause,
  GripVertical,
  X,
  Music2,
  Clock,
  Shuffle,
} from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";
import { formatDuration, Track } from "@/data/mockData";

export default function Queue() {
  const navigate = useNavigate();
  const {
    currentTrack,
    queue,
    setQueue,
    isPlaying,
    play,
    toggleShuffle,
    shuffle,
  } = usePlayer();

  const [items, setItems] = useState<Track[]>(queue);

  const handleReorder = (newOrder: Track[]) => {
    setItems(newOrder);
    setQueue(newOrder);
  };

  const removeFromQueue = (trackId: string) => {
    const newQueue = items.filter((t) => t.id !== trackId);
    setItems(newQueue);
    setQueue(newQueue);
  };

  const playTrack = (track: Track) => {
    play(track);
  };

  const currentIndex = items.findIndex((t) => t.id === currentTrack?.id);
  const upNext = items.slice(currentIndex + 1);
  const played = currentIndex > 0 ? items.slice(0, currentIndex) : [];

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 flex items-center justify-between bg-background/80 px-4 pb-4 pt-12 backdrop-blur-xl"
      >
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 text-foreground hover:bg-white/10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Queue</h1>
        <button
          onClick={toggleShuffle}
          className={`rounded-full p-2 ${
            shuffle ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Shuffle className="h-5 w-5" />
        </button>
      </motion.header>

      <div className="px-4">
        {/* Now Playing */}
        {currentTrack && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Now Playing
            </h2>
            <div className="glass-elevated flex items-center gap-3 p-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-lg">
                <img
                  src={currentTrack.artwork}
                  alt={currentTrack.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  {isPlaying ? (
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="h-4 w-1 rounded-full bg-primary"
                          animate={{ scaleY: [0.4, 1, 0.4] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Play className="h-5 w-5 text-white" fill="currentColor" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {currentTrack.title}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {currentTrack.artist}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDuration(currentTrack.duration)}
              </span>
            </div>
          </motion.section>
        )}

        {/* Up Next */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Up Next
            </h2>
            <span className="text-xs text-muted-foreground">
              {upNext.length} tracks
            </span>
          </div>

          {upNext.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Music2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Your queue is empty</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Add songs to play next
              </p>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={upNext}
              onReorder={(newOrder) => {
                const newQueue = [...played, currentTrack!, ...newOrder];
                handleReorder(newQueue);
              }}
              className="space-y-2"
            >
              <AnimatePresence>
                {upNext.map((track, index) => (
                  <Reorder.Item
                    key={track.id}
                    value={track}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="glass-card group flex cursor-grab items-center gap-3 p-3 active:cursor-grabbing"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground/50" />
                    <button
                      onClick={() => playTrack(track)}
                      className="relative h-12 w-12 overflow-hidden rounded-md"
                    >
                      <img
                        src={track.artwork}
                        alt={track.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play
                          className="h-5 w-5 text-white"
                          fill="currentColor"
                        />
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {track.artist}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(track.duration)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(track.id);
                        }}
                        className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </motion.section>

        {/* Previously Played */}
        {played.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Previously Played
              </h2>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 opacity-60">
              {played.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.03 }}
                  onClick={() => playTrack(track)}
                  className="glass-card group flex cursor-pointer items-center gap-3 p-3"
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded-md">
                    <img
                      src={track.artwork}
                      alt={track.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {track.artist}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(track.duration)}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
