import { motion } from "framer-motion";
import { Shuffle, TrendingUp, Calendar, RotateCcw, Sparkles } from "lucide-react";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import album5 from "@/assets/album-5.jpg";
import album6 from "@/assets/album-6.jpg";

interface PersonalizedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  icon: React.ElementType;
  gradient: string;
}

const personalizedPlaylists: PersonalizedPlaylist[] = [
  { 
    id: "discover-weekly", 
    title: "Discover Weekly", 
    subtitle: "New music, just for you. Updates Monday.",
    image: album1, 
    icon: Sparkles,
    gradient: "from-purple-600 to-pink-500"
  },
  { 
    id: "release-radar", 
    title: "Release Radar", 
    subtitle: "Fresh releases from artists you follow.",
    image: album2, 
    icon: TrendingUp,
    gradient: "from-green-500 to-emerald-600"
  },
  { 
    id: "on-repeat", 
    title: "On Repeat", 
    subtitle: "Songs you've been playing on repeat.",
    image: album3, 
    icon: RotateCcw,
    gradient: "from-blue-500 to-cyan-500"
  },
  { 
    id: "repeat-rewind", 
    title: "Repeat Rewind", 
    subtitle: "Past favorites you used to love.",
    image: album4, 
    icon: Calendar,
    gradient: "from-orange-500 to-amber-500"
  },
];

const dailyMixes = [
  { id: "mix-1", title: "Daily Mix 1", genres: "Trap, Hip-Hop, Rage", image: album1 },
  { id: "mix-2", title: "Daily Mix 2", genres: "R&B, Soul, Chill", image: album4 },
  { id: "mix-3", title: "Daily Mix 3", genres: "Electronic, House", image: album3 },
  { id: "mix-4", title: "Daily Mix 4", genres: "Pop, Indie", image: album2 },
  { id: "mix-5", title: "Daily Mix 5", genres: "Rock, Alternative", image: album5 },
  { id: "mix-6", title: "Daily Mix 6", genres: "Lo-fi, Ambient", image: album6 },
];

export function MadeForYouSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Made For You</h2>
        <span className="text-xs text-primary">See all</span>
      </div>

      {/* Personalized Playlists */}
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
        {personalizedPlaylists.map((playlist, index) => {
          const Icon = playlist.icon;
          return (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex-shrink-0 w-36 overflow-hidden rounded-xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${playlist.gradient} opacity-90`} />
              <img
                src={playlist.image}
                alt={playlist.title}
                className="h-36 w-full object-cover mix-blend-overlay"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{playlist.title}</h3>
                  <p className="text-[9px] text-white/70 line-clamp-2">{playlist.subtitle}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Daily Mixes */}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-primary" />
          Your Daily Mixes
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {dailyMixes.map((mix, index) => (
            <motion.div
              key={mix.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="flex-shrink-0"
            >
              <div className="relative h-28 w-28 overflow-hidden rounded-lg">
                <img
                  src={mix.image}
                  alt={mix.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs font-bold text-white">{mix.title}</p>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground w-28 truncate">{mix.genres}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
