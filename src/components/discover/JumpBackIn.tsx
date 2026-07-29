import { motion } from "framer-motion";
import { Play } from "lucide-react";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import album5 from "@/assets/album-5.jpg";
import album6 from "@/assets/album-6.jpg";

interface RecentItem {
  id: string;
  title: string;
  type: "playlist" | "album" | "podcast";
  image: string;
  progress?: number;
}

// Mock data - would come from user's listening history
const recentItems: RecentItem[] = [
  { id: "1", title: "Daily Mix 1", type: "playlist", image: album1, progress: 65 },
  { id: "2", title: "Chill Vibes", type: "playlist", image: album4, progress: 30 },
  { id: "3", title: "Neon Horizons", type: "album", image: album2 },
  { id: "4", title: "Workout Energy", type: "playlist", image: album5, progress: 80 },
  { id: "5", title: "Night Drive", type: "playlist", image: album3 },
  { id: "6", title: "Focus Flow", type: "album", image: album6, progress: 45 },
];

export function JumpBackIn() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <h2 className="mb-3 text-lg font-bold text-foreground">Jump Back In</h2>
      <div className="grid grid-cols-2 gap-2">
        {recentItems.slice(0, 6).map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="group relative flex items-center gap-3 overflow-hidden rounded-md bg-card/80 pr-2 transition-colors hover:bg-card"
          >
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden">
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover"
              />
              {item.progress && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${item.progress}%` }} 
                  />
                </div>
              )}
            </div>
            <span className="flex-1 truncate text-xs font-medium text-foreground">
              {item.title}
            </span>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary opacity-0 shadow-lg transition-all group-hover:opacity-100">
              <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
