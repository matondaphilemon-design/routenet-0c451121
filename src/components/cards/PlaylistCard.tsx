import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Playlist } from "@/data/mockData";

interface PlaylistCardProps {
  playlist: Playlist;
  index?: number;
  size?: "sm" | "md" | "lg";
}

export function PlaylistCard({ playlist, index = 0, size = "md" }: PlaylistCardProps) {
  const navigate = useNavigate();

  const sizeClasses = {
    sm: "w-28",
    md: "w-36",
    lg: "w-44",
  };

  const imageSizes = {
    sm: "h-28",
    md: "h-36",
    lg: "h-44",
  };

  const handleClick = () => {
    navigate(`/playlist/${playlist.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className={`group cursor-pointer ${sizeClasses[size]}`}
    >
      <div className={`music-card relative ${imageSizes[size]} w-full overflow-hidden rounded-lg`}>
        <img
          src={playlist.artwork}
          alt={playlist.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary opacity-0 shadow-lg transition-all group-hover:opacity-100"
        >
          <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </motion.button>
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-semibold text-foreground">{playlist.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {playlist.trackCount} tracks
        </p>
      </div>
    </motion.div>
  );
}
