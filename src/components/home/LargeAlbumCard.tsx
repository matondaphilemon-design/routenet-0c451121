import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface LargeAlbum {
  id: string;
  title: string;
  artist: string;
  image: string;
  type?: "album" | "single";
}

interface LargeAlbumCardProps {
  album: LargeAlbum;
  index?: number;
}

export function LargeAlbumCard({ album, index = 0 }: LargeAlbumCardProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    const albumId = album.id.startsWith('deezer-') 
      ? album.id.replace('deezer-', '') 
      : album.id;
    navigate(`/album/${albumId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className="group w-40 min-w-[10rem] cursor-pointer"
    >
      <div className="relative mb-3 overflow-hidden rounded-lg shadow-lg">
        <div className="aspect-square">
          <img
            src={album.image}
            alt={album.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100"
        >
          <Play className="h-5 w-5 fill-current ml-0.5" />
        </motion.button>
      </div>
      <h3 className="truncate text-sm font-bold text-foreground">
        {album.title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
        {album.type ? `${album.type.charAt(0).toUpperCase() + album.type.slice(1)} • ` : ""}{album.artist}
      </p>
    </motion.div>
  );
}
