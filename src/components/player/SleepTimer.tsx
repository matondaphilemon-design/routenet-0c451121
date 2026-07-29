import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, X, Clock, Check } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";

interface SleepTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

const timerOptions = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "End of track", value: -1 },
];

export function SleepTimer({ isOpen, onClose }: SleepTimerProps) {
  const { pause, currentTrack, duration, progress } = usePlayer();
  const [selectedTimer, setSelectedTimer] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    if (selectedTimer === null || selectedTimer === 0) return;

    let interval: ReturnType<typeof setInterval>;

    if (selectedTimer === -1) {
      // End of track mode
      const checkTrackEnd = () => {
        if (progress >= 0.99) {
          pause();
          setSelectedTimer(null);
          setRemainingTime(0);
        }
      };
      interval = setInterval(checkTrackEnd, 1000);
    } else {
      // Countdown mode
      setRemainingTime(selectedTimer * 60);
      interval = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            pause();
            setSelectedTimer(null);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [selectedTimer, pause, progress]);

  const formatRemainingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectTimer = (value: number) => {
    setSelectedTimer(value);
    onClose();
  };

  const cancelTimer = () => {
    setSelectedTimer(null);
    setRemainingTime(0);
  };

  return (
    <>
      {/* Timer indicator when active */}
      <AnimatePresence>
        {selectedTimer !== null && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={cancelTimer}
            className="flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1.5 text-sm text-primary"
          >
            <Moon className="h-4 w-4" />
            {selectedTimer === -1 ? (
              <span>End of track</span>
            ) : (
              <span>{formatRemainingTime(remainingTime)}</span>
            )}
            <X className="h-3 w-3" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Timer selection modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-background p-6"
            >
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
              
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/20 p-3">
                    <Moon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Sleep Timer</h2>
                    <p className="text-sm text-muted-foreground">
                      Stop playback after
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-muted-foreground hover:bg-white/10"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-2">
                {timerOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectTimer(option.value)}
                    className={`flex w-full items-center justify-between rounded-xl p-4 transition-colors ${
                      selectedTimer === option.value
                        ? "bg-primary/20 text-primary"
                        : "bg-white/5 text-foreground hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    {selectedTimer === option.value && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              {selectedTimer !== null && (
                <button
                  onClick={cancelTimer}
                  className="mt-4 w-full rounded-xl bg-destructive/10 p-4 font-medium text-destructive"
                >
                  Cancel Timer
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
