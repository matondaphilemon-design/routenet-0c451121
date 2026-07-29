import { motion } from "framer-motion";
import { Play, Clock } from "lucide-react";
import { formatDuration } from "@/data/mockData";

export interface Episode {
  id: string | number;
  title: string;
  podcastName: string;
  image: string;
  duration: number;
  publishedAt?: string;
  description?: string;
}

interface EpisodeCardProps {
  episode: Episode;
  index?: number;
}

export function EpisodeCard({ episode, index = 0 }: EpisodeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group flex cursor-pointer gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
    >
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
        <img
          src={episode.image}
          alt={episode.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-6 w-6 fill-white text-white" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h4 className="truncate text-sm font-medium text-foreground">
          {episode.title}
        </h4>
        <p className="truncate text-xs text-muted-foreground">
          {episode.podcastName}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDuration(episode.duration)}</span>
        </div>
      </div>
    </motion.div>
  );
}
