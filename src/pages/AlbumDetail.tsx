import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Shuffle, Heart, Plus, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useState, useEffect, useCallback } from "react";
import { useDeezerAlbum } from "@/hooks/useMusicSearch";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { TrackCard } from "@/components/cards/TrackCard";
import { toggleLikedAlbum, getLikedAlbums } from "@/pages/Library";
import { downloadTrack } from "@/services/downloadService";
import { toTitleCase } from "@/utils/toTitleCase";
import { toast } from "sonner";

const AlbumDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, setQueue } = usePlayer();
  const [isSaved, setIsSaved] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { status: "pending" | "downloading" | "done" | "failed"; percent: number }>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const { data: albumData, isLoading } = useDeezerAlbum(id || '');

  useEffect(() => {
    if (albumData) {
      const saved = getLikedAlbums().some(a => a.id === id);
      setIsSaved(saved);
    }
  }, [albumData, id]);

  const tracks: Track[] = (albumData?.tracks?.data || []).map((t: any) => ({
    id: `deezer-album-${albumData?.id}-${t.id}`,
    title: toTitleCase(t.title),
    artist: toTitleCase(t.artist?.name || albumData?.artist?.name || 'Unknown Artist'),
    album: albumData?.title || 'Unknown Album',
    artwork: albumData?.cover_medium || albumData?.cover || '',
    duration: t.duration || 180,
  }));

  usePreloadYouTube(tracks, tracks.length > 0);

  const handlePlayAll = () => {
    if (tracks.length > 0) { setQueue(tracks); play(tracks[0]); }
  };

  const handleShuffle = () => {
    if (tracks.length > 0) { const s = [...tracks].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }
  };

  const handleSave = () => {
    if (!albumData) return;
    const result = toggleLikedAlbum({
      id: id || '',
      title: albumData.title,
      artist: albumData.artist?.name || 'Unknown',
      artwork: albumData.cover_medium || albumData.cover || '',
    });
    setIsSaved(result);
    toast.success(result ? "Album saved to library" : "Album removed from library");
  };

  const handleDownloadAlbum = useCallback(async () => {
    if (tracks.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    
    const initial: Record<string, { status: "pending" | "downloading" | "done" | "failed"; percent: number }> = {};
    tracks.forEach(t => { initial[t.id] = { status: "pending", percent: 0 }; });
    setDownloadProgress(initial);
    
    toast.info(`Downloading ${tracks.length} tracks...`);
    
    const groupInfo = {
      groupKey: `album-${id}`,
      groupName: albumData?.title || "Unknown Album",
      groupType: "album" as const,
    };
    
    let downloaded = 0;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
      
      try {
        const ok = await downloadTrack(
          track,
          (percent) => setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent } })),
          groupInfo
        );
        setDownloadProgress(prev => ({ ...prev, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
        if (ok) downloaded++;
        await new Promise(r => setTimeout(r, 800));
      } catch {
        setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "failed", percent: 0 } }));
      }
    }
    
    setIsDownloadingAll(false);
    if (downloaded > 0) {
      toast.success(`Downloaded ${downloaded} of ${tracks.length} tracks`);
    } else {
      toast.error("Download failed");
    }
  }, [tracks, isDownloadingAll, id, albumData]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full gap-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-muted-foreground">Loading album...</p></div>;
  }

  if (!albumData) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Album not found</p></div>;
  }

  const coverUrl = albumData.cover_xl || albumData.cover_big || albumData.cover_medium || albumData.cover;
  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);
  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="fixed inset-0 -z-10">
        <img src={coverUrl} alt="" className="h-full w-full object-cover blur-[80px] scale-110 opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/90 to-background" />
      </div>

      <div className="relative px-4 pt-4 pb-6">
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => navigate(-1)}
          className="mb-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center">
          <img src={coverUrl} alt={albumData.title} className="w-56 h-56 rounded-lg shadow-2xl object-cover mb-6" />
          <h1 className="text-2xl font-bold mb-2">{toTitleCase(albumData.title)}</h1>
          <button onClick={() => navigate(`/artist/${encodeURIComponent(albumData.artist?.name || '')}`)} className="text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
            {toTitleCase(albumData.artist?.name || "")}
          </button>
          <p className="text-xs text-muted-foreground">
            {albumData.release_date?.split('-')[0]} • {tracks.length} songs • {formatTotalDuration(totalDuration)}
          </p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center justify-center gap-4 px-4 py-4">
        <Button onClick={handleSave} variant="ghost" size="icon" className={isSaved ? "text-primary" : "text-muted-foreground"}>
          <Plus className={`w-6 h-6 ${isSaved ? "rotate-45" : ""} transition-transform`} />
        </Button>
        <Button onClick={handleDownloadAlbum} variant="ghost" size="icon" disabled={isDownloadingAll || tracks.length === 0}
          className="text-muted-foreground hover:text-foreground">
          {isDownloadingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        </Button>
        <Button onClick={handlePlayAll} size="lg" disabled={tracks.length === 0}
          className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-14 w-14">
          <Play className="w-6 h-6 fill-current ml-1" />
        </Button>
        <Button onClick={handleShuffle} variant="ghost" size="icon" disabled={tracks.length === 0} className="text-muted-foreground hover:text-foreground">
          <Shuffle className="w-6 h-6" />
        </Button>
        <Button onClick={handleSave} variant="ghost" size="icon" className={isSaved ? "text-primary" : "text-muted-foreground"}>
          <Heart className={`w-6 h-6 ${isSaved ? "fill-current" : ""}`} />
        </Button>
      </motion.div>

      {/* Track list — scrollable, but no empty space beyond last track */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="px-4">
        {tracks.length > 0 ? (
          <div className="space-y-1">
            {tracks.map((track, index) => {
              const dl = downloadProgress[track.id];
              const status = (dl?.status as any) || "idle";
              const startOne = () => {
                if (dl?.status === "downloading" || dl?.status === "done") return;
                setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
                downloadTrack(
                  track,
                  (p) => setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: p } })),
                  { groupKey: `album-${id}`, groupName: albumData?.title || "", groupType: "album" }
                ).then(ok => {
                  setDownloadProgress(prev => ({ ...prev, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
                  if (ok) toast.success(`Downloaded ${track.title}`);
                  else toast.error(`Couldn't download ${track.title}`);
                });
              };
              return (
                <TrackCard
                  key={track.id}
                  track={track}
                  index={index}
                  showIndex
                  contextTracks={tracks}
                  download={{ status, percent: dl?.percent || 0, onClick: startOne }}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-4 text-center">No tracks available</p>
        )}

        {albumData.label && (
          <p className="text-xs text-muted-foreground mt-6">{albumData.release_date} • {albumData.label}</p>
        )}
      </motion.section>
    </div>
  );
};

export default AlbumDetail;
