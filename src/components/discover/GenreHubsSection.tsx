import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface GenreHub {
  id: string;
  name: string;
  gradient: string;
  emoji: string;
}

const genreHubs: GenreHub[] = [
  { id: "hiphop", name: "Hip-Hop", gradient: "from-orange-600 to-amber-500", emoji: "" },
  { id: "trap", name: "Trap", gradient: "from-red-600 to-rose-500", emoji: "" },
  { id: "rnb", name: "R&B", gradient: "from-purple-600 to-pink-500", emoji: "" },
  { id: "electronic", name: "Electronic", gradient: "from-cyan-500 to-blue-600", emoji: "" },
  { id: "pop", name: "Pop", gradient: "from-pink-500 to-rose-400", emoji: "" },
  { id: "rock", name: "Rock", gradient: "from-slate-600 to-zinc-700", emoji: "" },
  { id: "jazz", name: "Jazz", gradient: "from-amber-600 to-yellow-500", emoji: "" },
  { id: "classical", name: "Classical", gradient: "from-indigo-600 to-violet-500", emoji: "" },
  { id: "afrobeats", name: "Afrobeats", gradient: "from-green-600 to-emerald-500", emoji: "" },
  { id: "latin", name: "Latin", gradient: "from-red-500 to-orange-500", emoji: "" },
];

export function GenreHubsSection() {
  const navigate = useNavigate();

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Browse by Genre</h2>
        <button 
          onClick={() => navigate('/browse')}
          className="text-xs text-primary"
        >
          See all
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {genreHubs.slice(0, 6).map((genre, index) => (
          <motion.button
            key={genre.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${genre.gradient} p-3 text-left transition-transform hover:scale-[1.02]`}
          >
            <span className="absolute right-1 top-1 text-2xl opacity-30">{genre.emoji}</span>
            <span className="relative text-sm font-bold text-white">{genre.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
