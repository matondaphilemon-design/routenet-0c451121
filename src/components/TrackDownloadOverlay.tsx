import { useDownloadMode } from "@/context/DownloadModeContext";
import { Track } from "@/data/mockData";
import { Download, Check, Loader2 } from "lucide-react";

/**
 * Small absolute-positioned download circle that appears on the LEFT
 * of any track artwork while download mode is active.
 * - idle: download icon → tap to start
 * - downloading: spinner with percent
 * - done: green checkmark
 */
export function TrackDownloadOverlay({ track, size = 22 }: { track: Track; size?: number }) {
  const { enabled, statusOf, startDownload } = useDownloadMode();
  if (!enabled) return null;

  const { status, percent } = statusOf(track.id);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (status === "idle" || status === "failed") startDownload(track);
  };

  return (
    <button
      onClick={handleClick}
      className="absolute top-1 left-1 z-20 flex items-center justify-center rounded-full bg-black/75 backdrop-blur-sm shadow-lg border border-white/10"
      style={{ width: size, height: size }}
      aria-label={status === "done" ? "Downloaded" : "Download"}
    >
      {status === "done" && <Check className="text-emerald-400" style={{ width: size * 0.6, height: size * 0.6 }} />}
      {status === "downloading" && (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <Loader2 className="absolute animate-spin text-primary" style={{ width: size * 0.7, height: size * 0.7 }} />
          <span className="absolute text-[7px] font-bold text-white">{percent}</span>
        </div>
      )}
      {(status === "idle" || status === "failed") && (
        <Download
          className={status === "failed" ? "text-red-400" : "text-white"}
          style={{ width: size * 0.55, height: size * 0.55 }}
        />
      )}
    </button>
  );
}