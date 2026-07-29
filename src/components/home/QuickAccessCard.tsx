import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export interface QuickAccessItem {
  id: string;
  title: string;
  image: string;
  type?: "playlist" | "album" | "liked";
}

interface QuickAccessCardProps {
  item: QuickAccessItem;
  index?: number;
  onClick?: () => void;
}

export function QuickAccessCard({ item, index = 0, onClick }: QuickAccessCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-3 overflow-hidden rounded-md bg-white/10 transition-colors hover:bg-white/20"
    >
      <div className="h-12 w-12 flex-shrink-0 overflow-hidden">
        {item.type === "liked" ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700">
            <Heart className="h-5 w-5 fill-white text-white" />
          </div>
        ) : (
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      <span className="truncate pr-3 text-sm font-semibold text-foreground">
        {item.title}
      </span>
    </motion.div>
  );
}
