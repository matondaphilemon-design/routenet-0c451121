import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, Pause, Play, SkipBack, SkipForward, Menu } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { usePlayer } from "@/context/PlayerContext";

const presetMinutes = [15, 30, 45, 60, 90, 120];

export default function SleepTimerPage() {
  const navigate = useNavigate();
  const { isPlaying, togglePlay, next, previous, currentTrack } = usePlayer();
  const [minutes, setMinutes] = useState(30);
  const [fadeOut, setFadeOut] = useState(true);
  const [isActive, setIsActive] = useState(false);

  const handleStart = () => {
    setIsActive(true);
    // In a real app, this would set a timeout
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 pt-14 pb-4"
      >
        <button onClick={() => navigate(-1)} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Sleep Timer</h1>
        <button className="rounded-full p-2 text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
      </motion.header>

      <div className="px-5">
        {/* Album art / visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto mt-4 w-48 h-48 relative"
        >
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            {currentTrack?.artwork ? (
              <img src={currentTrack.artwork} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-muted/30 flex items-center justify-center">
                <Zap className="h-12 w-12 text-primary/30" />
              </div>
            )}
          </div>
          {/* Lightning badge */}
          <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Zap className="h-4 w-4 text-primary" />
          </div>
        </motion.div>

        {/* Timer label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 text-center"
        >
          <h2 className="text-lg font-bold text-foreground">Sleep Timer</h2>
          <p className="text-4xl font-extrabold text-primary mt-2">{minutes} min</p>
        </motion.div>

        {/* Slider */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 px-2"
        >
          <Slider
            value={[minutes]}
            min={5}
            max={120}
            step={5}
            onValueChange={([v]) => setMinutes(v)}
            className="w-full"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>5 min</span>
            <span>120 min</span>
          </div>
        </motion.div>

        {/* Presets */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 grid grid-cols-3 gap-2"
        >
          {presetMinutes.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                minutes === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {m} min
            </button>
          ))}
        </motion.div>

        {/* Fade out toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 glass-card flex items-center justify-between p-4"
        >
          <span className="text-sm font-medium text-foreground">Fade out gradually</span>
          <Switch checked={fadeOut} onCheckedChange={setFadeOut} />
        </motion.div>

        {/* Start/Stop button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <button
            onClick={isActive ? () => setIsActive(false) : handleStart}
            className={`w-full rounded-full py-3.5 text-sm font-bold shadow-lg ${
              isActive
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
            style={{ boxShadow: isActive ? undefined : "0 0 25px hsl(170 100% 45% / 0.25)" }}
          >
            {isActive ? "Cancel Timer" : "Start Timer"}
          </button>
        </motion.div>

        {/* Playback Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-8 flex items-center justify-center gap-8"
        >
          <button onClick={previous} className="text-muted-foreground hover:text-foreground">
            <SkipBack className="h-7 w-7" fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {isPlaying ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6 ml-0.5" fill="currentColor" />}
          </button>
          <button onClick={next} className="text-muted-foreground hover:text-foreground">
            <SkipForward className="h-7 w-7" fill="currentColor" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
