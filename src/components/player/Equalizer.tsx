import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RotateCcw, Sliders } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface EqualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

const presets = [
  { id: "flat", name: "Flat", values: [0, 0, 0, 0, 0, 0] },
  { id: "bass", name: "Bass Boost", values: [6, 4, 1, 0, 0, 0] },
  { id: "treble", name: "Treble Boost", values: [0, 0, 0, 2, 4, 6] },
  { id: "vocal", name: "Vocal", values: [-2, 0, 2, 3, 2, 0] },
  { id: "rock", name: "Rock", values: [4, 2, -1, 0, 2, 4] },
  { id: "electronic", name: "Electronic", values: [4, 3, 0, -1, 2, 5] },
  { id: "jazz", name: "Jazz", values: [2, 0, 1, 2, 0, 2] },
  { id: "classical", name: "Classical", values: [3, 2, 0, 0, 2, 3] },
  { id: "hiphop", name: "Hip-Hop", values: [5, 4, 1, 0, 1, 2] },
];

const bands = [
  { freq: "60Hz", label: "Sub" },
  { freq: "230Hz", label: "Bass" },
  { freq: "910Hz", label: "Low-Mid" },
  { freq: "3.6kHz", label: "Mid" },
  { freq: "14kHz", label: "High-Mid" },
  { freq: "16kHz", label: "Treble" },
];

export function Equalizer({ isOpen, onClose }: EqualizerProps) {
  const [selectedPreset, setSelectedPreset] = useState("flat");
  const [bandValues, setBandValues] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [isEnabled, setIsEnabled] = useState(true);

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.id);
    setBandValues([...preset.values]);
  };

  const handleBandChange = (index: number, value: number[]) => {
    const newValues = [...bandValues];
    newValues[index] = value[0];
    setBandValues(newValues);
    setSelectedPreset("custom");
  };

  const resetEqualizer = () => {
    setSelectedPreset("flat");
    setBandValues([0, 0, 0, 0, 0, 0]);
  };

  return (
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
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-6"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/20 p-3">
                  <Sliders className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Equalizer</h2>
                  <p className="text-sm text-muted-foreground">
                    Customize your sound
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetEqualizer}
                  className="rounded-full p-2 text-muted-foreground hover:bg-white/10"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-muted-foreground hover:bg-white/10"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="mb-6 flex items-center justify-between rounded-xl bg-white/5 p-4">
              <span className="font-medium text-foreground">Equalizer</span>
              <button
                onClick={() => setIsEnabled(!isEnabled)}
                className={`relative h-7 w-14 rounded-full transition-colors ${
                  isEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <motion.div
                  animate={{ x: isEnabled ? 28 : 4 }}
                  className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg"
                />
              </button>
            </div>

            {/* EQ Bands */}
            <div className={`mb-6 ${!isEnabled ? "pointer-events-none opacity-40" : ""}`}>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">+12dB</span>
                <span className="text-xs font-medium text-muted-foreground">0dB</span>
                <span className="text-xs font-medium text-muted-foreground">-12dB</span>
              </div>
              
              <div className="flex justify-between gap-3">
                {bands.map((band, index) => (
                  <div key={band.freq} className="flex flex-col items-center gap-2">
                    <div className="h-40 w-full">
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
                    <span className="text-[10px] font-medium text-foreground">
                      {band.freq}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {band.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div className={!isEnabled ? "pointer-events-none opacity-40" : ""}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Presets
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`rounded-xl p-3 text-sm font-medium transition-colors ${
                      selectedPreset === preset.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 text-foreground hover:bg-white/10"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom indicator */}
            {selectedPreset === "custom" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-center text-sm text-muted-foreground"
              >
                Using custom settings
              </motion.p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
