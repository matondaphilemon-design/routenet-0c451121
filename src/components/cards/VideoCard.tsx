import { motion } from "framer-motion";
import { Play, Clock } from "lucide-react";
import { usePlayer, VideoContent } from "@/context/PlayerContext";
import { useNavigate } from "react-router-dom";

interface VideoCardProps {
  video: VideoContent;
}

export function VideoCard({ video }: VideoCardProps) {
  const { playVideo } = usePlayer();
  const navigate = useNavigate();

  const handlePlay = () => {
    playVideo(video);
    navigate("/video-player");
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePlay}
      className="group cursor-pointer"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <Play className="ml-1 h-7 w-7" fill="currentColor" />
          </motion.div>
        </div>
        {video.duration && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
            <Clock className="h-3 w-3" />
            {formatDuration(video.duration)}
          </div>
        )}
      </div>
      <div className="mt-2">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {video.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{video.artist}</p>
      </div>
    </motion.div>
  );
}
