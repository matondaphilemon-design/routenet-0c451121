import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, Music2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AIPlaylistGeneratorProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
}

const promptSuggestions = [
  "Rage trap for a night drive",
  "Chill lo-fi for studying",
  "Workout bangers to push harder",
  "Late night R&B vibes",
  "Feel-good summer anthems",
  "Dark ambient for focus",
];

export function AIPlaylistGenerator({ onGenerate, isGenerating }: AIPlaylistGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    onGenerate(suggestion);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div
        onClick={() => !isExpanded && setIsExpanded(true)}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-emerald-900/30 to-background-card p-4 transition-all ${
          !isExpanded ? "cursor-pointer hover:from-primary/30" : ""
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">AI Playlist</h3>
            <p className="text-xs text-muted-foreground">Describe your vibe, get a playlist</p>
          </div>
          {isExpanded && (
            <button onClick={() => setIsExpanded(false)} className="p-1">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Rage trap for late night coding..."
                  className="flex-1 bg-background/50 border-white/10 text-sm"
                  disabled={isGenerating}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!prompt.trim() || isGenerating}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {promptSuggestions.map((suggestion, idx) => (
                  <motion.button
                    key={suggestion}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isGenerating}
                    className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-50"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isExpanded && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Music2 className="h-3 w-3" />
            <span>Tap to create a playlist with AI</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
