import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, Play, Trash2, Music2 } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";
import { formatDuration, Track } from "@/data/mockData";
import { getListeningHistory } from "@/hooks/useListeningHistory";

// Build recently-played list from the user's real listening history.
const generateRecentHistory = (): (Track & { playedAt: Date })[] => {
  try {
    const history = getListeningHistory();
    return history.map((track, i) => ({
      ...track,
      id: `recent-${track.id}-${i}`,
      playedAt: new Date(Date.now() - i * 3600000),
    }));
  } catch { return []; }
};

const groupByDate = (items: (Track & { playedAt: Date })[]) => {
  const groups: { [key: string]: (Track & { playedAt: Date })[] } = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  items.forEach((item) => {
    const itemDate = new Date(
      item.playedAt.getFullYear(),
      item.playedAt.getMonth(),
      item.playedAt.getDate()
    );

    let key: string;
    if (itemDate.getTime() === today.getTime()) {
      key = "Today";
    } else if (itemDate.getTime() === yesterday.getTime()) {
      key = "Yesterday";
    } else {
      key = itemDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  return groups;
};

export default function RecentlyPlayed() {
  const navigate = useNavigate();
  const { play } = usePlayer();
  const [history, setHistory] = useState(generateRecentHistory());

  const groupedHistory = groupByDate(history);

  const clearHistory = () => {
    setHistory([]);
  };

  const removeItem = (id: string) => {
    setHistory(history.filter((item) => item.id !== id));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 flex items-center justify-between bg-background/80 px-4 pb-4 pt-12 backdrop-blur-xl"
      >
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 text-foreground hover:bg-white/10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Recently Played</h1>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="rounded-full p-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </motion.header>

      <div className="px-4">
        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/20">
              <Music2 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">No listening history</h2>
            <p className="mt-2 max-w-xs text-muted-foreground">
              Start playing music and it will appear here
            </p>
          </motion.div>
        ) : (
          Object.entries(groupedHistory).map(([date, items], groupIndex) => (
            <motion.section
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.1 }}
              className="mb-6"
            >
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {date}
                </h2>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIndex * 0.1 + index * 0.03 }}
                    className="glass-card group flex items-center gap-3 p-3"
                  >
                    <button
                      onClick={() => play(item)}
                      className="relative h-12 w-12 overflow-hidden rounded-md"
                    >
                      <img
                        src={item.artwork}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="h-5 w-5 text-white" fill="currentColor" />
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.artist}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(item.playedAt)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))
        )}
      </div>
    </div>
  );
}
