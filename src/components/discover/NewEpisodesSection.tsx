import { motion } from "framer-motion";
import { Play, Clock } from "lucide-react";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";

interface Episode {
  id: string;
  title: string;
  show: string;
  image: string;
  duration: string;
  isNew: boolean;
}

const episodes: Episode[] = [
  { id: "1", title: "The Future of Music AI", show: "Tech Talk Daily", image: album1, duration: "45 min", isNew: true },
  { id: "2", title: "Behind the Hits", show: "Producer Stories", image: album2, duration: "32 min", isNew: true },
  { id: "3", title: "Genre Evolution", show: "Sound History", image: album3, duration: "28 min", isNew: false },
];

export function NewEpisodesSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">New Episodes</h2>
        <span className="text-xs text-primary">See all</span>
      </div>

      <div className="space-y-2">
        {episodes.map((episode, index) => (
          <motion.div
            key={episode.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group flex items-center gap-3 rounded-lg bg-card p-2 transition-colors hover:bg-accent"
          >
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
              <img
                src={episode.image}
                alt={episode.title}
                className="h-full w-full object-cover"
              />
              {episode.isNew && (
                <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="truncate text-sm font-medium text-foreground">{episode.title}</h3>
              <p className="text-xs text-muted-foreground">{episode.show}</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{episode.duration}</span>
              </div>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 opacity-0 transition-all group-hover:opacity-100">
              <Play className="h-5 w-5 text-primary" />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
