import { motion } from "framer-motion";
import { X } from "lucide-react";

interface VideoIframeOverlayProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

export function VideoIframeOverlay({ videoId, title, onClose }: VideoIframeOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-black"
    >
      <div className="flex items-center justify-between px-4 pt-10 pb-2">
        <p className="text-sm font-semibold text-white truncate flex-1 mr-4">{title}</p>
        <button onClick={onClose} className="rounded-full p-2 text-white/60 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-2">
        <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </motion.div>
  );
}
