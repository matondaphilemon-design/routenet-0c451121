import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Music, User, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const GENRE_OPTIONS = [
  "Pop", "Hip Hop", "R&B", "Rock", "Indie", "Electronic", "Dance",
  "Jazz", "Soul", "Funk", "Country", "Latin", "Reggaeton", "Afrobeats",
  "K-Pop", "Lo-Fi", "Classical", "Metal", "Punk", "Gospel", "Amapiano",
  "Drill", "Trap", "House", "Techno", "Reggae", "Blues",
];

export interface DJPrefs {
  genres: string[];
  artists: string[];
  setupComplete: boolean;
}

const STORAGE_KEY = "tunestream_dj_preferences";

export function loadDJPreferences(): DJPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { genres: [], artists: [], setupComplete: false };
}

export function saveDJPreferences(prefs: DJPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

interface Props {
  onComplete: (prefs: DJPrefs) => void;
  editMode?: boolean;
  onClose?: () => void;
}

export default function DJPreferences({ onComplete, editMode, onClose }: Props) {
  const [step, setStep] = useState<"genres" | "artists">("genres");
  const [genres, setGenres] = useState<string[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");

  useEffect(() => {
    const prefs = loadDJPreferences();
    if (prefs.setupComplete) {
      setGenres(prefs.genres);
      setArtists(prefs.artists);
    }
  }, []);

  const toggleGenre = (g: string) => {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 5 ? [...prev, g] : prev);
  };

  const addArtist = () => {
    const name = artistInput.trim();
    if (name && !artists.includes(name) && artists.length < 5) {
      setArtists(prev => [...prev, name]);
      setArtistInput("");
    }
  };

  const removeArtist = (a: string) => setArtists(prev => prev.filter(x => x !== a));

  const handleFinish = () => {
    const prefs: DJPrefs = { genres, artists, setupComplete: true };
    saveDJPreferences(prefs);
    onComplete(prefs);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="w-full max-w-sm mx-auto"
    >
      {editMode && onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white z-10">
          <X className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence mode="wait">
        {step === "genres" ? (
          <motion.div key="genres" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="flex items-center gap-2 mb-1">
              <Music className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Pick Your Genres</h2>
            </div>
            <p className="text-xs text-white/50 mb-4">Select up to 5 genres you love</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {GENRE_OPTIONS.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    genres.includes(g)
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/30 text-white/60 hover:bg-muted/50"
                  }`}
                >
                  {genres.includes(g) && <Check className="inline h-3 w-3 mr-1" />}
                  {g}
                </button>
              ))}
            </div>

            <Button
              onClick={() => setStep("artists")}
              disabled={genres.length === 0}
              className="w-full rounded-full"
            >
              Next — Add Artists ({genres.length}/5)
            </Button>
          </motion.div>
        ) : (
          <motion.div key="artists" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="flex items-center gap-2 mb-1">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Favorite Artists</h2>
            </div>
            <p className="text-xs text-white/50 mb-4">Add up to 5 artists you can't stop listening to</p>

            <form onSubmit={(e) => { e.preventDefault(); addArtist(); }} className="flex gap-2 mb-4">
              <Input
                value={artistInput}
                onChange={e => setArtistInput(e.target.value)}
                placeholder="e.g. Kendrick Lamar"
                className="flex-1 rounded-full bg-muted/30 border-border/20 text-sm"
              />
              <Button type="submit" size="sm" className="rounded-full" disabled={!artistInput.trim() || artists.length >= 5}>
                Add
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 mb-6 min-h-[40px]">
              {artists.map(a => (
                <Badge key={a} variant="secondary" className="gap-1 pr-1">
                  {a}
                  <button onClick={() => removeArtist(a)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {artists.length === 0 && <p className="text-xs text-white/30">No artists added yet</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("genres")} className="flex-1 rounded-full">
                Back
              </Button>
              <Button onClick={handleFinish} className="flex-1 rounded-full" disabled={artists.length === 0}>
                {editMode ? "Save" : "Start DJ"} 
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function EditPreferencesButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
      <Pencil className="h-3 w-3" /> Edit Preferences
    </button>
  );
}
