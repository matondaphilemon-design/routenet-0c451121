import { motion } from "framer-motion";
import { Play, Headphones, Radio, Mic2 } from "lucide-react";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";

interface QuickPick {
  id: string;
  title: string;
  type: "playlist" | "podcast" | "radio" | "mix";
  image: string;
  duration?: string;
}

const quickPicks: QuickPick[] = [
  { id: "1", title: "Today's Top Hits", type: "playlist", image: album1 },
  { id: "2", title: "New Episode", type: "podcast", image: album2, duration: "45 min" },
  { id: "3", title: "Hip-Hop Radio", type: "radio", image: album3 },
  { id: "4", title: "Your Mix", type: "mix", image: album4 },
];

const typeIcons = {
  playlist: Headphones,
  podcast: Mic2,
  radio: Radio,
  mix: Play,
};

export function QuickPicksSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <h2 className="mb-3 text-lg font-bold text-foreground">Quick Picks</h2>
      <div className="grid grid-cols-2 gap-3">
        {quickPicks.map((pick, index) => {
          const Icon = typeIcons[pick.type];
          return (
            <motion.div
              key={pick.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group relative overflow-hidden rounded-xl"
            >
              <img
                src={pick.image}
                alt={pick.title}
                className="h-24 w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/70 mb-1">
                  <Icon className="h-3 w-3" />
                  <span className="capitalize">{pick.type}</span>
                  {pick.duration && <span>• {pick.duration}</span>}
                </div>
                <h3 className="text-sm font-semibold text-white">{pick.title}</h3>
              </div>
              <button className="absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary opacity-0 shadow-lg transition-all group-hover:opacity-100">
                <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
