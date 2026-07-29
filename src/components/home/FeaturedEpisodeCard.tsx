import { motion } from "framer-motion";
import { Play, Plus, MoreVertical } from "lucide-react";

export interface FeaturedEpisode {
  id: string;
  title: string;
  showName: string;
  image: string;
  description?: string;
}

interface FeaturedEpisodeCardProps {
  episode: FeaturedEpisode;
  onClick?: () => void;
}

export function FeaturedEpisodeCard({ episode, onClick }: FeaturedEpisodeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group flex cursor-pointer gap-4 rounded-lg p-1"
    >
      {/* Large square image */}
      <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg">
        <img
          src={episode.image}
          alt={episode.showName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      
      {/* Content */}
      <div className="flex flex-1 flex-col justify-between py-1">
        <div>
          <span className="text-xs text-muted-foreground">Episode</span>
          <h3 className="mt-1 text-base font-bold text-foreground line-clamp-2">
            {episode.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            {episode.description || episode.showName}
          </p>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-6 w-6" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </button>
        </div>
      </div>
      
      {/* More options */}
      <button className="self-start p-1 text-muted-foreground hover:text-foreground">
        <MoreVertical className="h-5 w-5" />
      </button>
    </motion.div>
  );
}
