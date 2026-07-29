import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, SkipBack, SkipForward, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";

const presets = [
  { id: "flat", name: "Flat", values: [0, 0, 0, 0, 0] },
  { id: "bass", name: "Bass Boost", values: [6, 4, 0, 0, 0] },
  { id: "rock", name: "Rock", values: [4, 2, -1, 2, 4] },
  { id: "pop", name: "Pop", values: [1, 3, 4, 2, 0] },
  { id: "jazz", name: "Jazz", values: [2, 0, 1, 2, 3] },
  { id: "hiphop", name: "Hip-Hop", values: [5, 4, 1, 1, 2] },
];

const bands = ["Bass", "Midsy", "Young", "Tents", "Treble"];

export default function EqualizerPage() {
  const navigate = useNavigate();
  const { isPlaying, togglePlay, next, previous } = usePlayer();
  const [bandValues, setBandValues] = useState<number[]>([0, 0, 0, 0, 0]);
  const [selectedPreset, setSelectedPreset] = useState("flat");

  const handleBandChange = (index: number, value: number[]) => {
    const newValues = [...bandValues];
    newValues[index] = value[0];
    setBandValues(newValues);
    setSelectedPreset("custom");
  };

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.id);
    setBandValues([...preset.values]);
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
        <h1 className="text-2xl font-bold text-foreground">Equalizer</h1>
        <button onClick={() => { setSelectedPreset("flat"); setBandValues([0, 0, 0, 0, 0]); }} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-5 w-5" />
        </button>
      </motion.header>

      <div className="px-5">
        {/* Vertical EQ Sliders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 flex justify-between gap-4 px-4"
        >
          {bands.map((band, index) => (
            <div key={band} className="flex flex-col items-center gap-3">
              {/* dB value */}
              <span className="text-xs font-medium text-primary">
                {bandValues[index] > 0 ? "+" : ""}{bandValues[index]}
              </span>
              {/* Vertical slider */}
              <div className="h-44 w-full flex justify-center">
                <Slider
                  orientation="vertical"
                  value={[bandValues[index]]}
                  min={-12}
                  max={12}
                  step={1}
                  onValueChange={(value) => handleBandChange(index, value)}
                  className="h-full"
                />
              </div>
              {/* Label */}
              <span className="text-[11px] font-medium text-muted-foreground">{band}</span>
            </div>
          ))}
        </motion.div>

        {/* Presets */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Presets</h3>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  selectedPreset === preset.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-foreground hover:bg-muted/50"
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Playback Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-8"
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

        {/* + button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-4 flex justify-center"
        >
          <button className="rounded-full bg-muted/30 p-2 text-muted-foreground hover:text-foreground">
            <Plus className="h-5 w-5" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
