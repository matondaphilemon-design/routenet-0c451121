import { motion } from "framer-motion";
import { ChevronLeft, Play } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDeezerChartTracks, useDeezerChartAlbums, useDeezerChartArtists } from "@/hooks/useMusicSearch";
import { Track, formatDuration } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";

export default function Browse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") || "top50";
  const { play, setQueue } = usePlayer();

  const { data: chartTracks } = useDeezerChartTracks(50);
  const { data: chartAlbums } = useDeezerChartAlbums(50);
  const { data: chartArtists } = useDeezerChartArtists(50);

  const tracks: Track[] = chartTracks?.map((t: any) => ({
    id: `deezer-${t.id}`, title: t.title, artist: t.artist?.name || "Unknown", album: t.album?.title || "",
    artwork: t.album?.cover_medium || t.album?.cover || "", duration: t.duration, preview: t.preview,
  })) || [];

  usePreloadYouTube(tracks.slice(0, 10), tracks.length > 0);

  const handlePlayTrack = (track: Track) => { setQueue(tracks); play(track); };

  const title = section === "top50" ? "Top 50 Songs" : section === "albums" ? "All Albums" : section === "artists" ? "All Artists" : "Browse";

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto px-4 pb-24 pt-4">
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2"><ChevronLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </motion.header>

      {section === "top50" && (
        <div className="space-y-0.5">
          {tracks.map((track, i) => (
            <motion.div key={track.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => handlePlayTrack(track)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-muted/20">
              <span className="w-6 text-center text-xs font-bold text-primary/60">{i + 1}</span>
              <img src={track.artwork} alt="" className="h-10 w-10 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{track.title}</p>
                <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDuration(track.duration)}</span>
            </motion.div>
          ))}
        </div>
      )}

      {section === "albums" && chartAlbums && (
        <div className="grid grid-cols-3 gap-2">
          {(chartAlbums as any[]).map((a: any, i: number) => (
            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/album/${a.id}`)} className="cursor-pointer">
              <div className="aspect-square rounded-lg overflow-hidden"><img src={a.cover_medium || a.cover} alt={a.title} className="h-full w-full object-cover" loading="lazy" /></div>
              <p className="mt-1 truncate text-xs font-semibold text-foreground">{a.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{a.artist?.name}</p>
            </motion.div>
          ))}
        </div>
      )}

      {section === "artists" && chartArtists && (
        <div className="grid grid-cols-3 gap-3">
          {(chartArtists as any[]).map((a: any, i: number) => (
            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)} className="cursor-pointer text-center">
              <div className="mx-auto h-20 w-20 rounded-full overflow-hidden ring-1 ring-white/10">
                <img src={a.picture_medium || a.picture} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-foreground">{a.name}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
