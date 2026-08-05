import { useMemo } from "react";
import { motion } from "framer-motion";
import { X, VolumeX } from "lucide-react";

/**
 * Muted music-video companion. Starts the video at the exact second the song
 * has reached so the visuals stay in sync while the audio player keeps playing.
 */
export function SyncedVideoPanel({
  videoId,
  title,
  startSeconds,
  onClose,
}: {
  videoId: string;
  title: string;
  startSeconds: number;
  onClose: () => void;
}) {
  const src = useMemo(() => {
    const start = Math.max(0, Math.floor(startSeconds));
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&start=${start}&rel=0&playsinline=1&modestbranding=1`;
  }, [videoId, startSeconds]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t border-border/60 bg-background/95 p-3 pb-5 backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center gap-2">
        <VolumeX className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-foreground">Video synced · muted · {title}</p>
        <button onClick={onClose} aria-label="Close video" className="rounded-full p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mx-auto aspect-video w-full max-w-lg overflow-hidden rounded-xl bg-black">
        <iframe
          src={src}
          title={title}
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </motion.div>
  );
}
