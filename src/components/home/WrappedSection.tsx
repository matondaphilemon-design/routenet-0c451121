import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, 
  Clock, 
  Music2, 
  Mic2, 
  TrendingUp,
  Sparkles,
  ChevronRight,
  X
} from "lucide-react";
import { Artist } from "@/data/mockData";

interface WrappedSectionProps {
  topArtists: Artist[];
  isLoading?: boolean;
}

interface WrappedStats {
  minutesListened: number;
  songsPlayed: number;
  topGenre: string;
  topArtistMinutes: number;
  uniqueArtists: number;
  topMonth: string;
}

// Mock stats for demo
const mockStats: WrappedStats = {
  minutesListened: 48523,
  songsPlayed: 2847,
  topGenre: "Hip-Hop",
  topArtistMinutes: 3240,
  topMonth: "November",
  uniqueArtists: 342,
};

export function WrappedSection({ topArtists, isLoading }: WrappedSectionProps) {
  const [showFullWrapped, setShowFullWrapped] = useState(false);
  const currentYear = new Date().getFullYear();

  if (isLoading || topArtists.length === 0) {
    return null;
  }

  const topArtist = topArtists[0];
  const top5Artists = topArtists.slice(0, 5);

  return (
    <>
      {/* Wrapped Preview Card */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <motion.div
          onClick={() => setShowFullWrapped(true)}
          className="relative cursor-pointer overflow-hidden rounded-2xl"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700" />
          
          {/* Animated pattern overlay */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-primary/40 blur-3xl" />
          </div>

          <div className="relative flex items-center gap-4 p-4">
            {/* Artist collage */}
            <div className="relative h-20 w-20 flex-shrink-0">
              <div className="absolute inset-0 overflow-hidden rounded-xl shadow-xl">
                <img 
                  src={topArtist?.avatar} 
                  alt={topArtist?.name}
                  className="h-full w-full object-cover"
                />
              </div>
              {top5Artists[1] && (
                <div className="absolute -bottom-2 -right-2 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/20 shadow-lg">
                  <img 
                    src={top5Artists[1].avatar} 
                    alt={top5Artists[1].name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Your {currentYear} Wrapped
                </span>
              </div>
              <h3 className="mt-1 text-lg font-bold text-white">
                See your year in music
              </h3>
              <p className="mt-0.5 text-sm text-white/70">
                {mockStats.minutesListened.toLocaleString()} minutes listened
              </p>
            </div>

            {/* Arrow */}
            <ChevronRight className="h-6 w-6 text-white/60" />
          </div>
        </motion.div>
      </motion.section>

      {/* Full Wrapped Modal */}
      <AnimatePresence>
        {showFullWrapped && (
          <WrappedModal 
            stats={mockStats}
            topArtists={top5Artists}
            year={currentYear}
            onClose={() => setShowFullWrapped(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface WrappedModalProps {
  stats: WrappedStats;
  topArtists: Artist[];
  year: number;
  onClose: () => void;
}

function WrappedModal({ stats, topArtists, year, onClose }: WrappedModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 4;

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const slides = [
    // Slide 1: Minutes listened
    <motion.div
      key="minutes"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex h-full flex-col items-center justify-center px-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/10"
      >
        <Clock className="h-12 w-12 text-white" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg text-white/70"
      >
        This year, you listened to
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-2 text-6xl font-black text-white"
      >
        {stats.minutesListened.toLocaleString()}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-1 text-2xl font-bold text-white/80"
      >
        minutes of music
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 text-sm text-white/50"
      >
        That's {Math.round(stats.minutesListened / 60)} hours of pure vibes
      </motion.p>
    </motion.div>,

    // Slide 2: Top Artist
    <motion.div
      key="top-artist"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex h-full flex-col items-center justify-center px-8 text-center"
    >
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-lg text-white/70"
      >
        Your #1 artist was
      </motion.p>
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, type: "spring" }}
        className="my-6 h-40 w-40 overflow-hidden rounded-full shadow-2xl ring-4 ring-white/20"
      >
        <img 
          src={topArtists[0]?.avatar} 
          alt={topArtists[0]?.name}
          className="h-full w-full object-cover"
        />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-4xl font-black text-white"
      >
        {topArtists[0]?.name}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-3 text-sm text-white/50"
      >
        You spent {stats.topArtistMinutes.toLocaleString()} minutes with them
      </motion.p>
    </motion.div>,

    // Slide 3: Top 5 Artists
    <motion.div
      key="top-5"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex h-full flex-col items-center justify-center px-6"
    >
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 text-lg text-white/70"
      >
        Your top artists of {year}
      </motion.p>
      <div className="w-full max-w-xs space-y-3">
        {topArtists.map((artist, index) => (
          <motion.div
            key={artist.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="flex items-center gap-4 rounded-xl bg-white/10 p-3"
          >
            <span className="w-6 text-center text-lg font-bold text-primary">
              {index + 1}
            </span>
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img 
                src={artist.avatar} 
                alt={artist.name}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="flex-1 truncate font-semibold text-white">
              {artist.name}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>,

    // Slide 4: Stats Summary
    <motion.div
      key="summary"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex h-full flex-col items-center justify-center px-6"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8 text-2xl font-bold text-white"
      >
        Your {year} in numbers
      </motion.h2>
      <div className="grid w-full max-w-xs grid-cols-2 gap-4">
        {[
          { icon: Music2, label: "Songs played", value: stats.songsPlayed.toLocaleString() },
          { icon: Mic2, label: "Top genre", value: stats.topGenre },
          { icon: TrendingUp, label: "Top month", value: stats.topMonth },
          { icon: Play, label: "Artists discovered", value: stats.uniqueArtists.toString() },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="flex flex-col items-center rounded-xl bg-white/10 p-4 text-center"
          >
            <stat.icon className="mb-2 h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-white">{stat.value}</span>
            <span className="text-xs text-white/50">{stat.label}</span>
          </motion.div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 text-sm text-white/50"
      >
        Thanks for listening! 
      </motion.p>
    </motion.div>,
  ];

  // Gradient backgrounds for each slide
  const gradients = [
    "from-violet-600 via-purple-600 to-indigo-700",
    "from-rose-500 via-pink-600 to-fuchsia-700",
    "from-emerald-500 via-teal-600 to-cyan-700",
    "from-amber-500 via-orange-600 to-red-600",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={nextSlide}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`relative h-[85vh] w-[90vw] max-w-md overflow-hidden rounded-3xl bg-gradient-to-br ${gradients[currentSlide]}`}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Slide content */}
        <AnimatePresence mode="wait">
          {slides[currentSlide]}
        </AnimatePresence>

        {/* Progress dots */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide(index);
              }}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide 
                  ? "w-6 bg-white" 
                  : "w-2 bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Tap hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-16 left-0 right-0 text-center text-xs text-white/40"
        >
          Tap to continue
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
