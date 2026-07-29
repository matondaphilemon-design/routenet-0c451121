import { motion } from "framer-motion";
import { Flame, Coffee, Brain, Moon, Zap, Heart, Music2, Sparkles } from "lucide-react";

interface Mood {
  id: string;
  name: string;
  icon: React.ElementType;
  gradient: string;
  description: string;
}

const moods: Mood[] = [
  { id: "rage", name: "Rage", icon: Flame, gradient: "from-red-600 to-orange-500", description: "High energy trap" },
  { id: "chill", name: "Chill", icon: Coffee, gradient: "from-cyan-500 to-blue-500", description: "Laid back vibes" },
  { id: "focus", name: "Focus", icon: Brain, gradient: "from-purple-600 to-indigo-500", description: "Deep concentration" },
  { id: "sleep", name: "Sleep", icon: Moon, gradient: "from-indigo-600 to-purple-800", description: "Peaceful rest" },
  { id: "workout", name: "Workout", icon: Zap, gradient: "from-green-500 to-emerald-600", description: "Push harder" },
  { id: "romance", name: "Romance", icon: Heart, gradient: "from-pink-500 to-rose-600", description: "Love songs" },
  { id: "party", name: "Party", icon: Music2, gradient: "from-yellow-500 to-orange-500", description: "Dance floor hits" },
  { id: "discover", name: "Discover", icon: Sparkles, gradient: "from-primary to-emerald-400", description: "New sounds" },
];

interface MoodSelectorProps {
  selectedMood: string | null;
  onMoodSelect: (mood: string) => void;
}

export function MoodSelector({ selectedMood, onMoodSelect }: MoodSelectorProps) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-bold text-foreground">How are you feeling?</h2>
      <div className="grid grid-cols-4 gap-2">
        {moods.map((mood, index) => {
          const Icon = mood.icon;
          const isSelected = selectedMood === mood.id;
          return (
            <motion.button
              key={mood.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onMoodSelect(mood.id)}
              className={`relative flex flex-col items-center justify-center rounded-xl p-3 transition-all ${
                isSelected 
                  ? `bg-gradient-to-br ${mood.gradient} shadow-lg` 
                  : "bg-card hover:bg-accent"
              }`}
            >
              <Icon className={`h-5 w-5 ${isSelected ? "text-white" : "text-foreground"}`} />
              <span className={`mt-1 text-[10px] font-medium ${isSelected ? "text-white" : "text-muted-foreground"}`}>
                {mood.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export { moods };
