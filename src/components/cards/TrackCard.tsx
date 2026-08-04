import { motion, AnimatePresence } from "framer-motion";
import { Play, MoreVertical, Loader2, Youtube, Zap, Database, Heart, Plus, Disc, User as UserIcon, ThumbsDown } from "lucide-react";
import { Track, formatDuration } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useState } from "react";
import { getPreloadedYouTubeId } from "@/hooks/usePreloadYouTube";
import { isTrackCached } from "@/hooks/useCachedTracks";
import { useNavigate } from "react-router-dom";
import { AddToPlaylistDialog } from "@/components/AddToPlaylistDialog";
import { DownloadProgressCircle } from "@/components/DownloadProgressCircle";
import { formatStreams } from "@/utils/formatStreams";
import { useDownloadMode } from "@/context/DownloadModeContext";
import { buildRadioQueue } from "@/services/radioEngine";

interface TrackCardProps {
  track: Track;
  index?: number;
  showIndex?: boolean;
  contextTracks?: Track[];
  hideStreams?: boolean;
  radioFromSearch?: boolean;
  download?: {
    status: "idle" | "pending" | "downloading" | "done" | "failed";
    percent: number;
    onClick: () => void;
  };
}

export function TrackCard({ track, index, showIndex, contextTracks, download, hideStreams, radioFromSearch }: TrackCardProps) {
  const { play, setQueue, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const { enabled: downloadModeOn, statusOf, startDownload } = useDownloadMode();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

  const preloadedId = getPreloadedYouTubeId(track);
  const hasYouTubeId = track.youtubeId || preloadedId;
  const isCachedInDb = isTrackCached(track.title, track.artist);

  const handlePlay = async () => {
    if (preloadedId && !track.youtubeId) track.youtubeId = preloadedId;
    setIsLoading(true);
    try {
      if (contextTracks && contextTracks.length > 0) {
        if (radioFromSearch) {
          setQueue([track], { mode: "radio" });
          buildRadioQueue(track)
            .then((radioQueue) => {
              if (radioQueue.length > 1) setQueue(radioQueue, { mode: "radio" });
            })
            .catch(() => {});
        } else {
          setQueue(contextTracks);
        }
      }
      play(track);
    } finally {
      setTimeout(() => setIsLoading(false), (hasYouTubeId || isCachedInDb) ? 200 : 500);
    }
  };

  const getBadge = () => {
    if (isCachedInDb) return <div className="absolute bottom-0 right-0 rounded-tl bg-emerald-500 p-0.5"><Database className="h-2.5 w-2.5 text-white" /></div>;
    if (preloadedId) return <div className="absolute bottom-0 right-0 rounded-tl bg-primary p-0.5"><Zap className="h-2.5 w-2.5 text-primary-foreground" /></div>;
    if (hasYouTubeId) return <div className="absolute bottom-0 right-0 rounded-tl bg-red-600 p-0.5"><Youtube className="h-2.5 w-2.5 text-white" /></div>;
    return null;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (index || 0) * 0.05 }}
        className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5 cursor-pointer"
        onClick={handlePlay}
      >
        {showIndex && (
          <span className="w-6 text-center text-sm text-muted-foreground">
            {isCurrentTrack && isPlaying ? (
              <div className="flex justify-center gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-3 w-0.5 rounded-full bg-primary" animate={{ scaleY: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            ) : (index! + 1)}
          </span>
        )}

        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
          <img src={track.artwork} alt={track.album} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {isLoading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Play className="h-5 w-5 text-white" fill="white" />}
          </div>
          {getBadge()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {(downloadModeOn || download) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (download) { download.onClick(); return; }
                  const s = statusOf(track.id);
                  if (s.status === "done") return;
                  startDownload(track);
                }}
                className="flex-shrink-0 mt-0.5"
                aria-label="Download"
              >
                <DownloadProgressCircle
                  status={download?.status || statusOf(track.id).status}
                  percent={download?.percent ?? statusOf(track.id).percent}
                  size={20}
                  onClick={() => {}}
                />
              </button>
            )}
            <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`truncate text-sm font-medium ${isCurrentTrack ? "text-primary" : "text-foreground"}`}>{track.title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {!hideStreams && formatStreams(track.streams)
              ? <><span>{formatStreams(track.streams)}</span><span className="mx-1">·</span><span>{track.artist}</span></>
              : track.artist}
          </p>
            </div>
          </div>
        </div>

        <span className="text-xs text-muted-foreground">{formatDuration(track.duration)}</span>

        <div className="relative">
          <button
            className="rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute right-0 top-8 z-50 min-w-44 rounded-xl bg-card border border-border/30 shadow-xl overflow-hidden"
                >
                  <button onClick={(e) => {
                    e.stopPropagation();
                    import("@/pages/Library").then(({ toggleLikedSong }) => setLiked(toggleLikedSong(track)));
                    setDisliked(false);
                    setShowMenu(false);
                  }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                    <Heart className={`h-3.5 w-3.5 ${liked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    {liked ? "remove from liked" : "like this song"}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDisliked(!disliked); setLiked(false); setShowMenu(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                    <ThumbsDown className={`h-3.5 w-3.5 ${disliked ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                    {disliked ? "undo dislike" : "not this song"}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowPlaylistDialog(true); }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />Add to Playlist
                  </button>
                  <button onClick={async (e) => {
                    e.stopPropagation(); setShowMenu(false);
                    addToQueue(track);
                    const { toast } = await import("sonner");
                    toast.success("Added to queue");
                  }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                    <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />Add to Queue
                  </button>

                  {track.album && (
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); navigate(`/album/${track.album}`); }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                      <Disc className="h-3.5 w-3.5 text-muted-foreground" />Go to Album
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); navigate(`/artist/${encodeURIComponent(track.artist)}`); }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />Go to Artist
                  </button>
                  <button onClick={async (e) => {
                    e.stopPropagation(); setShowMenu(false);
                    const { toast: sonnerToast } = await import("sonner");
                    const id = sonnerToast.loading(`Downloading "${track.title}"…`);
                    const { saveTrackToDevice } = await import("@/services/downloadService");
                    const ok = await saveTrackToDevice(track, (p) => {
                      sonnerToast.loading(`Downloading "${track.title}" — ${p}%`, { id });
                    });
                    if (ok) sonnerToast.success("Saved to your device", { id });
                    else sonnerToast.error("Download failed", { id });
                  }} className="flex w-full items-center gap-3 px-3 py-2 text-xs text-foreground hover:bg-muted/20">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />Download
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AddToPlaylistDialog
        isOpen={showPlaylistDialog}
        onClose={() => setShowPlaylistDialog(false)}
        track={{ title: track.title, artist: track.artist, album: track.album, artwork: track.artwork, duration: track.duration, preview: track.preview }}
      />
    </>
  );
}
