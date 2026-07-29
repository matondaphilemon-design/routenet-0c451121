import { motion } from "framer-motion";

export interface RecentItemData {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  type: "artist" | "playlist" | "album" | "podcast";
  progress?: number; // 0-100 for podcasts/episodes
}

interface RecentItemProps {
  item: RecentItemData;
  index?: number;
  onClick?: () => void;
}

export function RecentItem({ item, index = 0, onClick }: RecentItemProps) {
  const isCircular = item.type === "artist";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group w-28 min-w-[7rem] cursor-pointer"
    >
      <div className={`relative mb-2 overflow-hidden ${isCircular ? 'rounded-full' : 'rounded-lg'}`}>
        <div className="aspect-square">
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        {isCircular && (
          <div className="absolute inset-0 rounded-full ring-2 ring-white/0 transition-all group-hover:ring-primary/50" />
        )}
      </div>
      
      {/* Title */}
      <h4 className="truncate text-sm font-medium text-foreground">
        {item.title}
      </h4>
      
      {/* Subtitle or type */}
      <p className="truncate text-xs text-muted-foreground">
        {item.subtitle || (item.type === "artist" ? "Artist" : item.type === "playlist" ? "Playlist" : "Album")}
      </p>
      
      {/* Progress bar for podcasts */}
      {item.progress !== undefined && item.progress > 0 && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-white/20">
          <div 
            className="h-full rounded-full bg-primary"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
