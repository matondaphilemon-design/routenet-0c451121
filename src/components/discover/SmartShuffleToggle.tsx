import { useState } from "react";
import { motion } from "framer-motion";
import { Shuffle, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function SmartShuffleToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className={`rounded-xl p-4 transition-all ${enabled ? 'bg-primary/10 border border-primary/30' : 'bg-card'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
              {enabled ? (
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Shuffle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Smart Shuffle</h3>
              <p className="text-xs text-muted-foreground">
                {enabled 
                  ? "AI will add fresh recommendations to your playlists" 
                  : "Enable to discover new tracks in your playlists"}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 flex items-center gap-2 text-xs text-primary"
          >
            <Sparkles className="h-3 w-3" />
            <span>Smart Shuffle is active • New tracks will blend into your playlists</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
