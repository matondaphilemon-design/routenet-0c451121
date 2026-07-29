import { motion } from "framer-motion";
import {
  ChevronLeft,
  Heart,
  Share2,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  PictureInPicture2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { YouTubePlayer, YouTubePlayerRef } from "@/components/player/YouTubePlayer";
import { useRef, useState, useCallback } from "react";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const {
    currentVideo,
    isPlaying,
    togglePlay,
    progress,
    duration,
    setProgress,
    seek,
    stopVideo,
  } = usePlayer();

  const playerRef = useRef<YouTubePlayerRef>(null);
  const [liked, setLiked] = useState(false);

  const handleProgress = useCallback(
    (currentTime: number, videoDuration: number) => {
      setProgress(currentTime, videoDuration);
    },
    [setProgress]
  );

  const handleSeek = useCallback(
    (newProgress: number) => {
      seek(newProgress);
      if (playerRef.current && duration > 0) {
        playerRef.current.seekTo(newProgress * duration);
      }
    },
    [seek, duration]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleBack = () => {
    stopVideo();
    navigate(-1);
  };

  if (!currentVideo) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No video playing</p>
      </div>
    );
  }

  const currentTime = progress * duration;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-screen flex-col bg-black"
    >
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 pt-12"
      >
        <button
          onClick={handleBack}
          className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70">
          <MoreHorizontal className="h-6 w-6" />
        </button>
      </motion.header>

      {/* Video Player */}
      <div className="flex flex-1 items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-2xl"
        >
          <YouTubePlayer
            ref={playerRef}
            videoId={currentVideo.youtubeId}
            isPlaying={isPlaying}
            onProgress={handleProgress}
            onEnded={() => stopVideo()}
            autoplay
            className="shadow-2xl"
          />
        </motion.div>
      </div>

      {/* Video Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 flex items-start justify-between px-6"
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-white">
            {currentVideo.title}
          </h1>
          <p className="text-base text-white/70">{currentVideo.artist}</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setLiked(!liked)}
            className="rounded-full p-2"
          >
            <Heart
              className={`h-6 w-6 ${liked ? "fill-primary text-primary" : "text-white/70"}`}
            />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="rounded-full p-2 text-white/70"
          >
            <Share2 className="h-6 w-6" />
          </motion.button>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 px-6"
      >
        <div
          className="h-1.5 cursor-pointer rounded-full bg-white/20"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const newProgress = (e.clientX - rect.left) / rect.width;
            handleSeek(newProgress);
          }}
        >
          <motion.div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/70">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 flex items-center justify-center gap-8 px-6 pb-24"
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSeek(Math.max(0, progress - 10 / duration))}
          className="rounded-full p-2 text-white"
        >
          <SkipBack className="h-8 w-8" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={togglePlay}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          {isPlaying ? (
            <Pause className="h-8 w-8" fill="currentColor" />
          ) : (
            <Play className="ml-1 h-8 w-8" fill="currentColor" />
          )}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSeek(Math.min(1, progress + 10 / duration))}
          className="rounded-full p-2 text-white"
        >
          <SkipForward className="h-8 w-8" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
