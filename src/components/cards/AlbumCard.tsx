import { motion } from "framer-motion";
import { Play, Disc } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatStreams } from "@/utils/formatStreams";

export interface Album {
  id: string | number;
  title: string;
  artist: string;
  artwork: string;
  trackCount?: number;
  year?: string;
  streams?: number;
}

interface AlbumCardProps {
  album: Album;
  index?: number;
  size?: "sm" | "md" | "lg";
}

export function AlbumCard({ album, index = 0, size = "md" }: AlbumCardProps) {
  const navigate = useNavigate();
  
  const sizeClasses = {
    sm: "w-28 min-w-[7rem]",
    md: "w-36 min-w-[9rem]",
    lg: "w-44 min-w-[11rem]",
  };

  // Extract numeric ID from "deezer-123" format
  const albumId = typeof album.id === 'string' && album.id.startsWith('deezer-') 
    ? album.id.replace('deezer-', '') 
    : album.id;

  const handleClick = () => {
    navigate(`/album/${albumId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className={`group cursor-pointer ${sizeClasses[size]}`}
    >
      <div className="relative mb-2 overflow-hidden rounded-xl shadow-lg">
        <div className="aspect-square">
          {album.artwork ? (
            <img
              src={album.artwork}
              alt={album.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
              <Disc className="h-10 w-10 text-primary" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100"
        >
          <Play className="h-5 w-5 fill-current" />
        </motion.button>
      </div>
      <h3 className="truncate text-sm font-semibold text-foreground">
        {album.title}
      </h3>
      <p className="truncate text-xs text-muted-foreground">{album.artist}</p>
      {formatStreams(album.streams) && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
          {formatStreams(album.streams)} streams
        </p>
      )}
    </motion.div>
  );
}
