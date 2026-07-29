import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, Video, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/context/PlayerContext";
import { useNavigate } from "react-router-dom";
import { getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";

export function MiniPlayer() {
  const {
    currentTrack, currentVideo, isPlaying, togglePlay,
    next, previous, progress, isVideoMode,
    shuffle, toggleShuffle, repeat, toggleRepeat,
  } = usePlayer();
  const navigate = useNavigate();

  const displayItem = isVideoMode ? currentVideo : currentTrack;
  if (!displayItem) return null;

  const artwork = isVideoMode ? (currentVideo?.thumbnail || "") : (currentTrack?.artwork || "");
  const title = isVideoMode ? (currentVideo?.title || "") : (currentTrack?.title || "");
  const subtitle = isVideoMode ? (currentVideo?.artist || "") : (currentTrack?.artist || "");
  const isResolving = !isVideoMode && currentTrack && !currentTrack.youtubeId && !getCachedYouTubeId(currentTrack.title, currentTrack.artist);

  const handleClick = () => navigate(isVideoMode ? "/video-player" : "/now-playing");
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="fixed bottom-14 left-0 right-0 z-40 px-2"
      >
        <div onClick={handleClick} className="glass-elevated mx-auto flex max-w-md cursor-pointer items-center gap-2.5 px-2.5 py-2">
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-border/60">
            <img src={artwork} alt={title} className={`h-full w-full object-cover ${isPlaying && !isVideoMode ? "animate-vinyl" : "animate-vinyl paused"}`} loading="eager" />
            {isResolving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              </div>
            )}
            {isVideoMode && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Video className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-foreground leading-tight">{title}</p>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">
              {isResolving ? "Loading" : subtitle}
            </p>
          </div>

          <div className="flex items-center gap-0.5" onClick={stop}>
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleShuffle}
                aria-label="Shuffle"
                className={`rounded-full p-1 ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Shuffle className="h-3.5 w-3.5" />
              </motion.button>
            )}
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={previous}
                aria-label="Previous"
                className="rounded-full p-1 text-muted-foreground hover:text-foreground">
                <SkipBack className="h-3.5 w-3.5" fill="currentColor" />
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.9 }} onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="rounded-full bg-primary p-1.5 text-primary-foreground">
              {isResolving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-3.5 w-3.5" fill="currentColor" />
              ) : (
                <Play className="h-3.5 w-3.5" fill="currentColor" />
              )}
            </motion.button>
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={next}
                aria-label="Next"
                className="rounded-full p-1 text-muted-foreground hover:text-foreground">
                <SkipForward className="h-3.5 w-3.5" fill="currentColor" />
              </motion.button>
            )}
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleRepeat}
                aria-label="Repeat"
                className={`rounded-full p-1 ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {repeat === "one" ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
              </motion.button>
            )}
          </div>
        </div>

        <div className="mx-auto mt-0.5 max-w-md px-3">
          <div className="progress-track h-[2px]">
            <motion.div className="progress-fill h-full" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
