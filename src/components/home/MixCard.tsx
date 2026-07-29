import { motion } from "framer-motion";
import { Play } from "lucide-react";

export interface Mix {
  id: string;
  title: string;
  image: string;
  artists: string;
  color?: string;
}

interface MixCardProps {
  mix: Mix;
  index?: number;
  onClick?: () => void;
}

export function MixCard({ mix, index = 0, onClick }: MixCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group w-44 min-w-[11rem] cursor-pointer"
    >
      <div className="relative mb-3 overflow-hidden rounded-lg">
        <div className="aspect-square">
          <img
            src={mix.image}
            alt={mix.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        {/* Title overlay bar at bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
          style={{ 
            backgroundColor: mix.color || 'rgba(168, 128, 255, 0.9)'
          }}
        >
          <span className="text-sm font-bold text-black truncate block">
            {mix.title}
          </span>
        </div>
        {/* Play button on hover */}
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-14 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xl transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2"
        >
          <Play className="h-6 w-6 fill-current ml-0.5" />
        </motion.button>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {mix.artists}
      </p>
    </motion.div>
  );
}
