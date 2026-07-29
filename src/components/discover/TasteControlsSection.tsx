import { useState } from "react";
import { motion } from "framer-motion";
import { Sliders, ThumbsUp, ThumbsDown, Ban, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface TastePreference {
  id: string;
  name: string;
  enabled: boolean;
}

const defaultPreferences: TastePreference[] = [
  { id: "explicit", name: "Allow explicit content", enabled: true },
  { id: "new-releases", name: "Prioritize new releases", enabled: true },
  { id: "deep-cuts", name: "Include deep cuts & B-sides", enabled: false },
  { id: "live-versions", name: "Include live versions", enabled: false },
  { id: "remixes", name: "Include remixes", enabled: true },
  { id: "podcasts", name: "Mix in podcasts", enabled: false },
];

export function TasteControlsSection() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [likedCount] = useState(247);
  const [blockedCount] = useState(12);
  const [snoozedCount] = useState(3);

  const togglePreference = (id: string) => {
    setPreferences(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-xl bg-card p-4 transition-colors hover:bg-accent">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <Sliders className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">Taste Controls</h3>
                <p className="text-xs text-muted-foreground">Fine-tune your recommendations</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-primary" /> {likedCount}
              </span>
              <span className="flex items-center gap-1">
                <Ban className="h-3 w-3 text-destructive" /> {blockedCount}
              </span>
            </div>
          </button>
        </SheetTrigger>

        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl bg-background">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-foreground">Taste Controls</SheetTitle>
          </SheetHeader>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-card p-3 text-center">
              <ThumbsUp className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-lg font-bold text-foreground">{likedCount}</p>
              <p className="text-[10px] text-muted-foreground">Liked</p>
            </div>
            <div className="rounded-xl bg-card p-3 text-center">
              <Ban className="mx-auto mb-1 h-5 w-5 text-destructive" />
              <p className="text-lg font-bold text-foreground">{blockedCount}</p>
              <p className="text-[10px] text-muted-foreground">Blocked</p>
            </div>
            <div className="rounded-xl bg-card p-3 text-center">
              <Clock className="mx-auto mb-1 h-5 w-5 text-primary/70" />
              <p className="text-lg font-bold text-foreground">{snoozedCount}</p>
              <p className="text-[10px] text-muted-foreground">Snoozed</p>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-1">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Preferences</h4>
            {preferences.map((pref) => (
              <div
                key={pref.id}
                className="flex items-center justify-between rounded-lg p-3 hover:bg-card"
              >
                <span className="text-sm text-foreground">{pref.name}</span>
                <Switch
                  checked={pref.enabled}
                  onCheckedChange={() => togglePreference(pref.id)}
                />
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 space-y-2">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Quick Actions</h4>
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-card">
              <ThumbsDown className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">View blocked artists</p>
                <p className="text-xs text-muted-foreground">Manage artists you've hidden</p>
              </div>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-card">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">View snoozed artists</p>
                <p className="text-xs text-muted-foreground">Artists hidden for 30 days</p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.section>
  );
}
