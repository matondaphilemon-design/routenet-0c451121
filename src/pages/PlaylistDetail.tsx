import { motion } from "framer-motion";
import { ChevronLeft, Heart, Share2, Play, Shuffle, MoreHorizontal, Search, Download, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDuration, Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { transformTrack } from "@/services/deezer";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { TrackCard } from "@/components/cards/TrackCard";
import { downloadTrack } from "@/services/downloadService";
import { toast } from "sonner";

interface PlaylistData {
  id: number;
  title: string;
  description?: string;
  picture_big?: string;
  picture_medium?: string;
  nb_tracks?: number;
  creator?: { name?: string };
  user?: { name?: string };
}

/** YouTube playlists (ids prefixed with `yt-`) come from the homepage feed. */
async function fetchYouTubePlaylist(playlistId: string): Promise<{ playlist: PlaylistData | null; tracks: Track[] }> {
  try {
    const { data } = await supabase.functions.invoke("youtube", {
      body: { action: "getPlaylistItems", params: { playlistId, limit: 50 } },
    });
    const items: any[] = data?.data || [];
    const tracks: Track[] = items.map((v) => ({
      id: `yt-${v.videoId}`,
      title: v.title,
      artist: (v.channelTitle || "YouTube").replace(/\s*-\s*Topic$/i, ""),
      album: "",
      artwork: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      duration: 0,
      youtubeId: v.videoId,
    }));
    return {
      playlist: {
        id: 0,
        title: "YouTube Playlist",
        picture_big: tracks[0]?.artwork,
        nb_tracks: tracks.length,
        creator: { name: tracks[0]?.artist },
      } as PlaylistData,
      tracks,
    };
  } catch (e) {
    console.warn("[PlaylistDetail] youtube fetch failed", e);
    return { playlist: null, tracks: [] };
  }
}

async function fetchPlaylist(id: string): Promise<{ playlist: PlaylistData | null; tracks: Track[] }> {
  if (id.startsWith("yt-")) return fetchYouTubePlaylist(id.slice(3));
  try {
    const { data: pl } = await supabase.functions.invoke("deezer", {
      body: { action: "getPlaylist", params: { playlistId: id } },
    });
    const { data: tr } = await supabase.functions.invoke("deezer", {
      body: { action: "getPlaylistTracks", params: { playlistId: id, limit: 100 } },
    });
    const tracks = (tr?.data || []).map(transformTrack) as Track[];
    return { playlist: pl || null, tracks };
  } catch (e) {
    console.warn("[PlaylistDetail] fetch failed", e);
    return { playlist: null, tracks: [] };
  }
}


export default function PlaylistDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { playCollection } = usePlayer();
  const [isLiked, setIsLiked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "name" | "duration">("default");
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { status: "idle" | "pending" | "downloading" | "done" | "failed"; percent: number }>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Support both raw Deezer IDs and legacy "deezer-…" prefixes.
  const cleanId = id.replace(/^deezer-/, "");

  const { data, isLoading } = useQuery({
    queryKey: ["playlist", cleanId],
    queryFn: () => fetchPlaylist(cleanId),
    enabled: !!cleanId,
    staleTime: 5 * 60 * 1000,
  });

  const playlist = data?.playlist;
  const tracks = data?.tracks || [];

  const filteredTracks = tracks
    .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      if (sortBy === "duration") return a.duration - b.duration;
      return 0;
    });

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalDuration / 60);
  const cover = playlist?.picture_big || playlist?.picture_medium || tracks[0]?.artwork || "/placeholder.svg";
  const title = playlist?.title || "Playlist";
  const creator = playlist?.creator?.name || playlist?.user?.name || "Deezer";

  usePreloadYouTube(tracks, tracks.length > 0);

  const handlePlayAll = () => {
    if (filteredTracks.length > 0) playCollection(filteredTracks, 0);
  };

  const handleShuffle = () => {
    if (filteredTracks.length > 0) {
      playCollection([...filteredTracks].sort(() => Math.random() - 0.5), 0);
    }
  };

  const handleDownloadAll = useCallback(async () => {
    if (filteredTracks.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    toast.info(`Downloading ${filteredTracks.length} tracks...`);
    let downloaded = 0;
    for (const track of filteredTracks) {
      setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
      try {
        const ok = await downloadTrack(
          track,
          (p) => setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: p } })),
          { groupKey: `playlist-${cleanId}`, groupName: title, groupType: "playlist" }
        );
        setDownloadProgress(prev => ({ ...prev, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
        if (ok) downloaded++;
        await new Promise(r => setTimeout(r, 400));
      } catch {
        setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "failed", percent: 0 } }));
      }
    }
    setIsDownloadingAll(false);
    if (downloaded > 0) toast.success(`Downloaded ${downloaded} of ${filteredTracks.length}`);
    else toast.error("Download failed");
  }, [filteredTracks, isDownloadingAll, cleanId, title]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoading && tracks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">We couldn't load this playlist.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto bg-background">
      {/* Hero — artwork-derived gradient wash */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px]">
          <img src={cover} alt="" className="h-full w-full scale-125 object-cover opacity-40 blur-[90px] saturate-150" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/75 to-background" />
        </div>

        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center justify-between px-3 pt-4"
        >
          <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur">
            <ChevronLeft className="h-6 w-6 text-foreground" />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSearch((v) => !v)} aria-label="Search in playlist" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur">
              <Search className="h-5 w-5 text-foreground" />
            </button>
            <button aria-label="More options" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur">
              <MoreHorizontal className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 }}
          className="relative mx-auto mt-6 w-[64vw] max-w-[260px]"
        >
          <div className="aspect-square overflow-hidden rounded-2xl shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)]">
            <img src={cover} alt={title} className="h-full w-full object-cover" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="relative mt-7 px-5"
        >
          <h1 className="text-[27px] font-black leading-[1.1] tracking-tight text-foreground">{title}</h1>
          {playlist?.description && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{playlist.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary/20">
              <img src={cover} alt="" className="h-full w-full object-cover" />
            </div>
            <span className="text-[13px] font-bold text-foreground">{creator}</span>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-muted-foreground">
            {`${tracks.length} songs · ${totalMinutes} min`}
          </p>

          {/* Action bar */}
          <div className="mt-5 flex items-center gap-5">
            <button onClick={() => setIsLiked(!isLiked)} aria-label={isLiked ? "Unlike playlist" : "Like playlist"}>
              <Heart className={`h-6 w-6 ${isLiked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
            <button onClick={handleDownloadAll} disabled={isDownloadingAll} aria-label="Download all">
              {isDownloadingAll ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Download className="h-6 w-6 text-muted-foreground" />}
            </button>
            <button aria-label="Share playlist"><Share2 className="h-6 w-6 text-muted-foreground" /></button>
            <button onClick={handleShuffle} aria-label="Shuffle play"><Shuffle className="h-6 w-6 text-muted-foreground" /></button>
            <Button
              onClick={handlePlayAll}
              aria-label="Play playlist"
              className="ml-auto h-14 w-14 rounded-full bg-primary shadow-glow hover:bg-primary/90"
            >
              <Play className="ml-0.5 h-7 w-7 text-primary-foreground" fill="currentColor" />
            </Button>
          </div>
        </motion.div>
      </div>

      {showSearch && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex gap-2 px-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in playlist..."
            className="min-w-0 flex-1 rounded-full border border-border/30 bg-muted/30 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            autoFocus
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-full border border-border/30 bg-muted/30 px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="default">Default</option>
            <option value="name">Name</option>
            <option value="duration">Duration</option>
          </select>
        </motion.div>
      )}


      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-5 px-4 pb-24">
        <div className="space-y-1">
          {filteredTracks.map((track, index) => {
            const dl = downloadProgress[track.id];
            const status = (dl?.status as any) || "idle";
            const startOne = () => {
              if (dl?.status === "downloading" || dl?.status === "done") return;
              setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
              downloadTrack(
                track,
                (p) => setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: p } })),
                { groupKey: `playlist-${cleanId}`, groupName: title, groupType: "playlist" }
              ).then(ok => {
                setDownloadProgress(prev => ({ ...prev, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
                if (ok) toast.success(`Downloaded ${track.title}`);
                else toast.error(`Couldn't download ${track.title}`);
              });
            };
            return (
              <TrackCard key={track.id} track={track} index={index} showIndex
                contextTracks={filteredTracks}
                download={{ status, percent: dl?.percent || 0, onClick: startOne }} />
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
