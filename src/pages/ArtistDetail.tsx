import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Shuffle, Heart, MoreHorizontal, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Track, Artist } from "@/data/mockData";
const PLACEHOLDER_ART = "/placeholder.svg";
import { usePlayer } from "@/context/PlayerContext";
import { TrackCard } from "@/components/cards/TrackCard";
import { useState, useEffect } from "react";
import { useDeezerArtist, useArtistDetails } from "@/hooks/useMusicSearch";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { toggleLikedArtist, getLikedArtists } from "@/pages/Library";
import { toast } from "sonner";
import { formatExactNumber } from "@/utils/formatExactNumber";
import { toTitleCase } from "@/utils/toTitleCase";


const ArtistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, setQueue } = usePlayer();
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);

  const artistName = decodeURIComponent(id || '');
  const { data: deezerData, isLoading: loadingDeezer } = useDeezerArtist(artistName);
  const { data: apiData, isLoading: loadingApi } = useArtistDetails(artistName);
  const isLoading = loadingDeezer || loadingApi;

  const artist = deezerData?.artist ? {
    id: deezerData.artist.id.toString(), name: deezerData.artist.name,
    avatar: deezerData.artist.picture, monthlyListeners: deezerData.artist.nb_fan || 0,
    bio: apiData?.artist?.bio, genre: apiData?.artist?.genre, country: apiData?.artist?.country,
    banner: apiData?.artist?.banner || deezerData.artist.picture,
  } : apiData?.artist ? {
    id: apiData.artist.id, name: apiData.artist.name, avatar: apiData.artist.avatar,
    monthlyListeners: apiData.artist.monthlyListeners || 0, bio: apiData.artist.bio,
    genre: apiData.artist.genre, country: apiData.artist.country, banner: apiData.artist.banner,
  } : null;

  useEffect(() => {
    if (artist) {
      const liked = getLikedArtists().some(a => a.name === artist.name);
      setIsFollowing(liked);
    }
  }, [artist]);

  // tracks with real deezer streaming numbers (rank field)
  const deezerTracks: (Track & { rank?: number })[] = (deezerData?.tracks || []).map((t: any) => ({
    id: `deezer-${t.id}`, title: t.title, artist: t.artist?.name || artistName,
    album: t.album?.title || 'unknown album', artwork: t.album?.cover_medium || t.album?.cover || artist?.avatar || '',
    duration: t.duration || 180, rank: t.rank || 0,
  }));

  const apiTracks: Track[] = apiData?.topTracks?.map((t) => ({
    id: t.id, title: t.title, artist: t.artist, album: t.album || 'unknown album',
    artwork: t.artwork || artist?.avatar || '', duration: t.duration || 180,
  })) || [];

  const allTracks = deezerTracks.length > 0 ? deezerTracks : apiTracks;
  const displayedTracks = showAllTracks ? allTracks : allTracks.slice(0, 5);

  usePreloadYouTube(displayedTracks, displayedTracks.length > 0);

  const deezerAlbums = (deezerData?.albums || []).slice(0, 6).map((a: any, i: number) => ({
    id: a.id.toString(), name: a.title,
    artwork: a.cover_medium || a.cover || PLACEHOLDER_ART,
    year: a.release_date?.split('-')[0] || (2024 - i).toString(),
    type: a.record_type === 'album' ? 'album' : a.record_type === 'single' ? 'single' : 'ep',
  }));

  const apiAlbums = apiData?.albums?.slice(0, 4).map((a, i) => ({
    id: a.id, name: a.name, artwork: a.artwork || PLACEHOLDER_ART,
    year: a.year || (2024 - i).toString(), type: i === 0 ? "album" : i === 1 ? "single" : "ep",
  })) || [];

  const albums = deezerAlbums.length > 0 ? deezerAlbums : apiAlbums;
  const fullAlbums = albums.filter((album) => album.type === "album");
  const singlesAndEps = albums.filter((album) => album.type !== "album");

  const similarArtists: Artist[] = apiData?.similar?.map((s) => ({
    id: s.id, name: s.name, avatar: s.avatar || PLACEHOLDER_ART, monthlyListeners: s.monthlyListeners || 0,
  })) || [];

  if (!artist && !isLoading) return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">artist not found</p></div>;
  if (isLoading && !artist) return <div className="flex items-center justify-center h-full gap-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-muted-foreground">loading artist...</p></div>;

  const handlePlayAll = () => { if (allTracks.length > 0) { setQueue(allTracks); play(allTracks[0]); } };
  const handleShuffle = () => { if (allTracks.length > 0) { const s = [...allTracks].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); } };

  const handleLike = () => {
    if (!artist) return;
    const result = toggleLikedArtist({ name: artist.name, avatar: artist.avatar });
    setIsFollowing(result);
    toast.success(result ? `${artist.name} added to library` : `${artist.name} removed from library`);
  };

  const bannerImage = (artist as any)?.banner || artist?.avatar;

  return (
    <div className="min-h-full pb-32">
      <div className="relative h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bannerImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-background" />
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        {isLoading && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 rounded-full px-3 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-xs">updating...</span>
          </div>
        )}
        <div className="absolute bottom-6 left-4 right-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-black" /></div>
              <span className="text-xs text-muted-foreground">Verified Artist</span>
              {(artist as any)?.genre && <span className="text-xs text-primary bg-primary/20 px-2 py-0.5 rounded-full">{toTitleCase((artist as any).genre)}</span>}
            </div>
            <h1 className="text-4xl font-bold mb-2">{toTitleCase(artist?.name || "")}</h1>
            {((artist as any)?.country) && (
              <p className="text-muted-foreground text-sm">{(artist as any).country}</p>
            )}
          </motion.div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-4 px-4 py-4">
        <Button onClick={handlePlayAll} size="lg" disabled={allTracks.length === 0} className="rounded-full bg-primary hover:bg-primary/90 text-black font-semibold h-14 w-14">
          <Play className="w-6 h-6 fill-current ml-1" />
        </Button>
        <Button onClick={handleShuffle} variant="ghost" size="icon" disabled={allTracks.length === 0} className="text-primary hover:text-primary/80">
          <Shuffle className="w-6 h-6" />
        </Button>
        <Button onClick={handleLike} variant={isFollowing ? "secondary" : "outline"} className="rounded-full px-6 border-muted-foreground/50 gap-2">
          <Heart className={`w-4 h-4 ${isFollowing ? "fill-primary text-primary" : ""}`} />
          {isFollowing ? "liked" : "like"}
        </Button>
        <Button variant="ghost" size="icon"><MoreHorizontal className="w-6 h-6" /></Button>
      </motion.div>

      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="px-4 mb-8">
        <h2 className="text-xl font-bold mb-4">Popular</h2>
        {allTracks.length > 0 ? (
          <div className="space-y-1">
            {displayedTracks.map((track, index) => (
              <div key={track.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <TrackCard track={track} index={index} showIndex contextTracks={allTracks} hideStreams />
                </div>
              </div>
            ))}
          </div>
        ) : !isLoading ? <p className="text-muted-foreground text-sm py-4">No tracks available</p> : null}
        {allTracks.length > 5 && (
          <button onClick={() => setShowAllTracks(!showAllTracks)} className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors font-semibold">
            {showAllTracks ? "Show less" : "See more"}
          </button>
        )}
      </motion.section>

      {allTracks.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-8 px-4">
          <h2 className="mb-4 text-xl font-bold">Featured Songs</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {allTracks.slice(0, 6).map((track) => (
              <button key={`featured-${track.id}`} onClick={() => { setQueue(allTracks); play(track); }} className="min-w-0 text-left">
                <img src={track.artwork} alt={track.title} className="aspect-square w-full rounded-md object-cover" />
                <p className="mt-2 truncate text-sm font-semibold text-foreground">{toTitleCase(track.title)}</p>
                <p className="truncate text-xs text-muted-foreground">{toTitleCase(track.artist)}</p>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {fullAlbums.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="px-4 mb-8">
          <h2 className="text-xl font-bold mb-4">Albums</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            {fullAlbums.map((album) => (
              <motion.div key={album.id} whileTap={{ scale: 0.98 }} onClick={() => navigate(`/album/${album.id}`)} className="flex-shrink-0 w-40 cursor-pointer">
                <img src={album.artwork} alt={album.name} className="w-40 h-40 rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
                <h3 className="font-semibold mt-2 truncate">{toTitleCase(album.name)}</h3>
                <p className="text-sm text-muted-foreground">{album.year} · {toTitleCase(album.type)}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {singlesAndEps.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mb-8 px-4">
          <h2 className="mb-4 text-xl font-bold">Singles &amp; EPs</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            {singlesAndEps.map((album) => (
              <button key={album.id} onClick={() => navigate(`/album/${album.id}`)} className="w-40 shrink-0 text-left">
                <img src={album.artwork} alt={album.name} className="h-40 w-40 rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
                <h3 className="mt-2 truncate font-semibold">{toTitleCase(album.name)}</h3>
                <p className="text-sm text-muted-foreground">{album.year} · {toTitleCase(album.type)}</p>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="px-4 mb-8">
        <h2 className="text-xl font-bold mb-4">About</h2>
        <div className="relative rounded-lg overflow-hidden">
          <img src={artist?.avatar} alt={artist?.name} className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-sm leading-relaxed text-foreground/90">{(artist as any)?.bio || `${artist?.name} is a popular artist with a dedicated fanbase.`}</p>
            <p className="text-xs text-muted-foreground mt-3">{formatExactNumber(artist?.monthlyListeners || 0)} fans on Deezer</p>
          </div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="px-4 mb-8">
        <h2 className="text-xl font-bold mb-4">Fans Also Like</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          {similarArtists.map((ra) => (
            <motion.div key={ra.id} whileTap={{ scale: 0.98 }} onClick={() => navigate(`/artist/${encodeURIComponent(ra.name)}`)} className="flex-shrink-0 w-32 cursor-pointer">
              <img src={ra.avatar} alt={ra.name} className="w-32 h-32 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
              <h3 className="font-semibold mt-2 text-center text-sm truncate">{toTitleCase(ra.name)}</h3>
              <p className="text-xs text-muted-foreground text-center">Artist</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="px-4 pb-8 text-center text-[10px] text-muted-foreground">
        Data provided by Deezer, Last.fm & TheAudioDB
      </motion.p>
    </div>
  );
};

export default ArtistDetail;