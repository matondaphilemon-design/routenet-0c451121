import { motion, AnimatePresence } from "framer-motion";
import { Radio as RadioIcon, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type VideoContent } from "@/context/PlayerContext";
import { toast } from "sonner";

function readTastePrompt(): string {
  try {
    const raw = localStorage.getItem("onboarding");
    if (!raw) return "chill";
    const o = JSON.parse(raw);
    const genres = (o.genres || []).map((g: any) => (g?.name || g)).slice(0, 2).join(" ");
    const artists = (o.artists || []).map((a: any) => (a?.name || a)).slice(0, 2).join(" ");
    return `${genres} ${artists}`.trim() || "chill";
  } catch { return "chill"; }
}

/**
 * Radio page — one-tap into a curated YouTube long mix.
 * Uses the existing `youtube` edge function (Piped/Invidious backed) to
 * search "<taste> long mix 1 hour" and plays the first result via the
 * player's video mode.
 */
export default function Radio() {
  const navigate = useNavigate();
  const { playVideo } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tuneIn = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const taste = readTastePrompt();
      const query = `${taste} long mix 1 hour`;
      const { data, error } = await supabase.functions.invoke("youtube", {
        body: { action: "search", params: { query, maxResults: 15 } },
      });
      if (error) throw error;
      const items: any[] = data?.items || data?.results || data?.videos || (Array.isArray(data) ? data : []);
      // Prefer results with a long duration (>= 25 min) when present.
      const preferred = items.find((v) => (v.duration || 0) >= 25 * 60) || items[0];
      if (!preferred?.id) throw new Error("no mixes found");
      const video: VideoContent = {
        id: `yt-mix-${preferred.id}`,
        title: preferred.title || "Radio Mix",
        artist: preferred.channelTitle || "YouTube",
        youtubeId: preferred.id,
        thumbnail: preferred.thumbnail || "",
        duration: preferred.duration || 0,
      };
      playVideo(video);
      toast.success("Now playing radio");
    } catch (e: any) {
      console.warn("[Radio] tune-in failed", e);
      setError("Couldn't tune in. Try again.");
    } finally {
      setLoading(false);
    }
  }, [loading, playVideo]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden" style={{ background: "var(--gradient-bg, hsl(265 40% 6%))" }}>
      <header className="flex items-center justify-between px-4 pt-10 pb-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 text-foreground/85 hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-foreground/70">Radio</p>
        <div className="w-9" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="h-24 w-24 rounded-3xl overflow-hidden shadow-2xl mb-8">
          <img src="/logo.png" alt="Routenet" className="h-full w-full object-cover" />
        </motion.div>

        <h1 className="text-3xl font-bold text-foreground mb-2">Routenet Radio</h1>
        <p className="text-sm text-muted-foreground mb-12 max-w-xs">
          One tap and we'll spin up an hour-long mix tuned to your taste.
        </p>

        <motion.button whileTap={{ scale: 0.94 }} onClick={tuneIn} disabled={loading}
          aria-label="Tune in"
          className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-glow disabled:opacity-70">
          {loading ? (
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          ) : (
            <RadioIcon className="h-14 w-14 text-white" />
          )}
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.05, 0.55] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
        </motion.button>

        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-6 text-sm text-destructive">{error}</motion.p>
          )}
        </AnimatePresence>

        <p className="mt-10 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {loading ? "Finding your mix" : "Tap to tune in"}
        </p>
      </div>
    </div>
  );
}
