import { motion } from "framer-motion";

// Base shimmer class applied via CSS
const shimmerClass = "relative overflow-hidden bg-white/5 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent";

export function QuickAccessSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 overflow-hidden rounded-md bg-white/10"
    >
      <div className={`h-12 w-12 flex-shrink-0 ${shimmerClass}`} />
      <div className={`h-4 w-24 rounded ${shimmerClass}`} />
    </motion.div>
  );
}

export function MixCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="w-44 min-w-[11rem]"
    >
      <div className={`mb-3 aspect-square rounded-lg ${shimmerClass}`} />
      <div className={`mb-2 h-3 w-full rounded ${shimmerClass}`} />
      <div className={`h-3 w-3/4 rounded ${shimmerClass}`} />
    </motion.div>
  );
}

export function FeaturedEpisodeSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-4 rounded-lg p-1"
    >
      <div className={`h-32 w-32 flex-shrink-0 rounded-lg ${shimmerClass}`} />
      <div className="flex flex-1 flex-col justify-between py-1">
        <div>
          <div className={`mb-2 h-3 w-16 rounded ${shimmerClass}`} />
          <div className={`mb-2 h-5 w-full rounded ${shimmerClass}`} />
          <div className={`h-3 w-3/4 rounded ${shimmerClass}`} />
        </div>
        <div className="flex items-center justify-between">
          <div className={`h-8 w-8 rounded-full ${shimmerClass}`} />
          <div className={`h-10 w-10 rounded-full ${shimmerClass}`} />
        </div>
      </div>
    </motion.div>
  );
}

export function RecentItemSkeleton({ index = 0, isCircular = false }: { index?: number; isCircular?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="w-28 min-w-[7rem]"
    >
      <div className={`mb-2 aspect-square ${isCircular ? 'rounded-full' : 'rounded-lg'} ${shimmerClass}`} />
      <div className={`mb-1 h-3 w-full rounded ${shimmerClass}`} />
      <div className={`h-3 w-2/3 rounded ${shimmerClass}`} />
    </motion.div>
  );
}

export function LargeAlbumSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="w-40 min-w-[10rem]"
    >
      <div className={`mb-3 aspect-square rounded-lg shadow-lg ${shimmerClass}`} />
      <div className={`mb-1.5 h-4 w-full rounded ${shimmerClass}`} />
      <div className={`h-3 w-3/4 rounded ${shimmerClass}`} />
    </motion.div>
  );
}

export function WrappedSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-6"
    >
      <div className={`relative overflow-hidden rounded-2xl ${shimmerClass}`}>
        <div className="flex items-center gap-4 p-4">
          <div className={`h-20 w-20 flex-shrink-0 rounded-xl ${shimmerClass}`} />
          <div className="flex-1">
            <div className={`mb-2 h-3 w-24 rounded ${shimmerClass}`} />
            <div className={`mb-2 h-5 w-40 rounded ${shimmerClass}`} />
            <div className={`h-3 w-32 rounded ${shimmerClass}`} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Grid of quick access skeletons
export function QuickAccessGridSkeleton() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-6"
    >
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <QuickAccessSkeleton key={index} index={index} />
        ))}
      </div>
    </motion.section>
  );
}

// Horizontal scroll row of mix skeletons
export function MixRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: count }).map((_, index) => (
        <MixCardSkeleton key={index} index={index} />
      ))}
    </div>
  );
}

// Horizontal scroll row of recent item skeletons
export function RecentsRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: count }).map((_, index) => (
        <RecentItemSkeleton key={index} index={index} isCircular={index < 2} />
      ))}
    </div>
  );
}

// Horizontal scroll row of album skeletons
export function AlbumRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: count }).map((_, index) => (
        <LargeAlbumSkeleton key={index} index={index} />
      ))}
    </div>
  );
}
