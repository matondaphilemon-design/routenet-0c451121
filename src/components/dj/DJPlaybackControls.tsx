import { motion } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, RotateCw, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { useState } from "react";

interface Props {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
  onSkip10: (dir: number) => void;
  onLike: () => void;
  onDislike: () => void;
  onMoreLikeThis: () => void;
}

export default function DJPlaybackControls({
  isPlaying, onPlayPause, onSkipForward, onSkipBack, onSkip10,
  onLike, onDislike, onMoreLikeThis,
}: Props) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const handleLike = () => {
    setLiked(true);
    setDisliked(false);
    onLike();
    setTimeout(() => setLiked(false), 2000);
  };

  const handleDislike = () => {
    setDisliked(true);
    setLiked(false);
    onDislike();
    setTimeout(() => setDisliked(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-col items-center gap-3">
      {/* Main transport */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={onSkipBack} className="text-white/50 hover:text-white"><SkipBack className="h-5 w-5" /></button>
        <button onClick={() => onSkip10(-1)} className="text-white/40 hover:text-white"><RotateCcw className="h-4 w-4" /></button>
        <button
          onClick={onPlayPause}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          style={{ boxShadow: "0 0 25px hsl(170 100% 45% / 0.3)" }}
        >
          {isPlaying ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6 ml-0.5" fill="currentColor" />}
        </button>
        <button onClick={() => onSkip10(1)} className="text-white/40 hover:text-white"><RotateCw className="h-4 w-4" /></button>
        <button onClick={onSkipForward} className="text-white/50 hover:text-white"><SkipForward className="h-5 w-5" /></button>
      </div>

      {/* Feedback row */}
      <div className="flex items-center gap-5">
        <button
          onClick={handleDislike}
          className={`flex items-center gap-1 text-xs transition-all ${disliked ? "text-red-400 scale-110" : "text-white/40 hover:text-white/70"}`}
        >
          <ThumbsDown className="h-4 w-4" />
          {disliked && <span>Skip these</span>}
        </button>

        <button
          onClick={onMoreLikeThis}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" /> More like this
        </button>

        <button
          onClick={handleLike}
          className={`flex items-center gap-1 text-xs transition-all ${liked ? "text-green-400 scale-110" : "text-white/40 hover:text-white/70"}`}
        >
          <ThumbsUp className="h-4 w-4" />
          {liked && <span>Saved!</span>}
        </button>
      </div>
    </motion.div>
  );
}
