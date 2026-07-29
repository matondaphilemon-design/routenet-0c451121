import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Artist } from "@/data/mockData";
import { formatExactNumber } from "@/utils/formatExactNumber";

interface ArtistCardProps {
  artist: Artist;
  index?: number;
}

export function ArtistCard({ artist, index = 0 }: ArtistCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
      className="group flex cursor-pointer flex-col items-center"
    >
      <div className="music-card relative h-24 w-24 overflow-hidden rounded-full">
        <img
          src={artist.avatar}
          alt={artist.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            // Fallback to placeholder on error
            (e.target as HTMLImageElement).style.backgroundColor = 'hsl(var(--muted))';
          }}
        />
        <div className="absolute inset-0 rounded-full ring-2 ring-white/0 transition-all group-hover:ring-primary/50" />
      </div>
      <div className="mt-2 text-center">
        <p className="text-sm font-semibold text-foreground">{artist.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatExactNumber(artist.monthlyListeners)} listeners
        </p>
      </div>
    </motion.div>
  );
}
