import { motion } from "framer-motion";
import { Mic, Play } from "lucide-react";

export interface Podcast {
  id: string | number;
  title: string;
  author: string;
  image: string;
  description?: string;
}

interface PodcastCardProps {
  podcast: Podcast;
  index?: number;
  size?: "sm" | "md" | "lg";
}

export function PodcastCard({ podcast, index = 0, size = "md" }: PodcastCardProps) {
  const sizeClasses = {
    sm: "w-28 min-w-[7rem]",
    md: "w-36 min-w-[9rem]",
    lg: "w-44 min-w-[11rem]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group cursor-pointer ${sizeClasses[size]}`}
    >
      <div className="relative mb-2 overflow-hidden rounded-xl">
        <div className="aspect-square">
          {podcast.image ? (
            <img
              src={podcast.image}
              alt={podcast.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
              <Mic className="h-10 w-10 text-primary" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100"
        >
          <Play className="h-4 w-4 fill-current" />
        </motion.button>
      </div>
      <h3 className="truncate text-sm font-semibold text-foreground">
        {podcast.title}
      </h3>
      <p className="truncate text-xs text-muted-foreground">{podcast.author}</p>
    </motion.div>
  );
}
