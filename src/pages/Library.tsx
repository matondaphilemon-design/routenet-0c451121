import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Music2, Loader2, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserPlaylists } from "@/services/playlistService";
import { usePlayer } from "@/context/PlayerContext";
import { Track } from "@/data/mockData";
import { useLocalMusic } from "@/hooks/useLocalMusic";
import { useOfflineDetection } from "@/hooks/useOfflineDetection";
import { getAllSongs, getDownloadedGroups, type OfflineSong } from "@/services/indexedDBService";
import { toTitleCase } from "@/utils/toTitleCase";
import { likeSong, unlikeSong } from "@/hooks/useLikedSongs";


const LIKED_SONGS_KEY = "tunestream_liked_songs";
const LIKED_ARTISTS_KEY = "tunestream_liked_artists";
const LIKED_ALBUMS_KEY = "tunestream_liked_albums";

export function getLikedSongs(): Track[] { try { return JSON.parse(localStorage.getItem(LIKED_SONGS_KEY) || "[]"); } catch { return []; } }
export function getLikedArtists(): Array<{ name: string; avatar: string }> { try { return JSON.parse(localStorage.getItem(LIKED_ARTISTS_KEY) || "[]"); } catch { return []; } }
export function getLikedAlbums(): Array<{ id: string; title: string; artist: string; artwork: string }> { try { return JSON.parse(localStorage.getItem(LIKED_ALBUMS_KEY) || "[]"); } catch { return []; } }

export function toggleLikedSong(track: Track) {
  const liked = getLikedSongs();
  const exists = liked.find(s => s.title === track.title && s.artist === track.artist);
  if (exists) localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(liked.filter(s => !(s.title === track.title && s.artist === track.artist))));
  else localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify([track, ...liked]));
  window.dispatchEvent(new Event("liked-updated"));
  // Sync to Supabase (fire-and-forget; offline-tolerant)
  if (exists) unlikeSong(track.title, track.artist).catch(() => {});
  else likeSong(track).catch(() => {});
  return !exists;
}

export function toggleLikedArtist(artist: { name: string; avatar: string }) {
  const liked = getLikedArtists();
  const exists = liked.find(a => a.name === artist.name);
  if (exists) localStorage.setItem(LIKED_ARTISTS_KEY, JSON.stringify(liked.filter(a => a.name !== artist.name)));
  else localStorage.setItem(LIKED_ARTISTS_KEY, JSON.stringify([artist, ...liked]));
  window.dispatchEvent(new Event("liked-updated"));
  return !exists;
}

export function toggleLikedAlbum(album: { id: string; title: string; artist: string; artwork: string }) {
  const liked = getLikedAlbums();
  const exists = liked.find(a => a.id === album.id);
  if (exists) localStorage.setItem(LIKED_ALBUMS_KEY, JSON.stringify(liked.filter(a => a.id !== album.id)));
  else localStorage.setItem(LIKED_ALBUMS_KEY, JSON.stringify([album, ...liked]));
  window.dispatchEvent(new Event("liked-updated"));
  return !exists;
}

/* Filter pills */
const FILTERS = ["Playlists", "Artists", "Albums", "Downloads"] as const;
type FilterType = typeof FILTERS[number] | "All";

export default function Library() {
  const navigate = useNavigate();
  const [, setRefresh] = useState(0);
  const { play, setQueue } = usePlayer();
  const { localSongs, importFiles, localSongsAsTracks } = useLocalMusic();
  const { isOffline } = useOfflineDetection();
  const [offlineSongs, setOfflineSongs] = useState<OfflineSong[]>([]);
  const [downloadedGroups, setDownloadedGroups] = useState<Array<{ key: string; name: string; type: string; artwork: string; count: number }>>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");

  useEffect(() => {
    const handler = () => setRefresh(n => n + 1);
    window.addEventListener("liked-updated", handler);
    return () => window.removeEventListener("liked-updated", handler);
  }, []);

  useEffect(() => {
    getAllSongs().then(setOfflineSongs).catch(() => {});
    getDownloadedGroups().then(setDownloadedGroups).catch(() => {});
  }, []);

  const { data: playlists, isLoading: loadingPlaylists, refetch: refetchPlaylists } = useQuery({ queryKey: ["user-playlists"], queryFn: getUserPlaylists, staleTime: 30_000 });

  const likedSongs = getLikedSongs();
  const likedArtists = getLikedArtists();
  const likedAlbums = getLikedAlbums();

  const handlePlayTrack = (track: Track, allTracks: Track[]) => { setQueue(allTracks); play(track); };

  const offlineTracks: Track[] = offlineSongs.map(s => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album,
    artwork: s.artwork || "/placeholder.svg", duration: s.duration,
  }));

  // Create playlist now navigates to full page

  // Build unified list items like Spotify's library
  const allItems: Array<{ type: string; id: string; title: string; subtitle: string; artwork: string; onClick: () => void }> = [];

  // Liked songs entry
  if (likedSongs.length > 0 && (activeFilter === "All" || activeFilter === "Playlists")) {
    allItems.push({
      type: "liked", id: "liked-songs",
      title: "Liked Songs",
      subtitle: `Playlist • ${likedSongs.length} songs`,
      artwork: likedSongs[0]?.artwork || "/placeholder.svg",
      onClick: () => navigate("/liked"),
    });
  }

  // Playlists
  if (activeFilter === "All" || activeFilter === "Playlists") {
    (playlists || []).forEach(p => {
      allItems.push({
        type: "playlist", id: p.id,
        title: p.name,
        subtitle: p.description || "Playlist",
        artwork: p.cover_image || "",
        onClick: () => navigate(`/user-playlist/${p.id}`),
      });
    });
  }

  // Artists
  if (activeFilter === "All" || activeFilter === "Artists") {
    likedArtists.forEach(a => {
      allItems.push({
        type: "artist", id: a.name,
        title: toTitleCase(a.name),
        subtitle: "Artist",
        artwork: a.avatar || "",
        onClick: () => navigate(`/artist/${encodeURIComponent(a.name)}`),
      });
    });
  }

  // Albums
  if (activeFilter === "All" || activeFilter === "Albums") {
    likedAlbums.forEach(a => {
      allItems.push({
        type: "album", id: a.id,
        title: toTitleCase(a.title),
        subtitle: toTitleCase(a.artist),
        artwork: a.artwork || "",
        onClick: () => navigate(`/album/${a.id}`),
      });
    });
  }

  // Downloads
  if (activeFilter === "All" || activeFilter === "Downloads") {
    // Show downloaded album/playlist groups first
    downloadedGroups.forEach(g => {
      const isAlbum = g.type === "album";
      const realId = g.key.replace(/^album-/, "").replace(/^playlist-/, "");
      allItems.push({
        type: isAlbum ? "album" : "playlist", id: g.key,
        title: toTitleCase(g.name),
        subtitle: `${isAlbum ? "Album" : "Playlist"} • ${g.count} downloaded`,
        artwork: g.artwork || "",
        onClick: () => navigate(isAlbum ? `/album/${realId}` : `/playlist/${realId}`),
      });
    });
    // Then ungrouped individual songs
    offlineSongs.filter(s => !s.groupKey).forEach(s => {
      const track: Track = { id: s.id, title: s.title, artist: s.artist, album: s.album, artwork: s.artwork || "/placeholder.svg", duration: s.duration };
      allItems.push({
        type: "download", id: s.id,
        title: toTitleCase(s.title),
        subtitle: toTitleCase(s.artist),
        artwork: s.artwork || "/placeholder.svg",
        onClick: () => handlePlayTrack(track, offlineTracks),
      });
    });
  }

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24">
      {isOffline && (
        <div className="mx-4 mt-12 mb-2 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2">
          <WifiOff className="h-4 w-4 text-destructive" />
          <p className="text-xs text-destructive font-medium">You're offline - showing downloaded songs only</p>
        </div>
      )}

      {/* Header — Spotify style */}
      <div className={`px-4 ${isOffline ? "pt-2" : "pt-12"} pb-3`}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-extrabold text-foreground">Your Library</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/search")}><Search className="h-5 w-5 text-foreground" /></button>
            <button onClick={() => navigate("/create-playlist")}><Plus className="h-5 w-5 text-foreground" /></button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {(["All", ...FILTERS] as const).map(filter => (
            <button key={filter} onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter ? "bg-foreground text-background" : "bg-muted/20 text-foreground border border-border/20"
              }`}>
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Sort indicator */}
      <div className="px-4 mb-2">
        <p className="text-xs text-muted-foreground">↕ Recents</p>
      </div>


      {/* Unified vertical list — Spotify style */}
      <div className="px-4">
        {loadingPlaylists ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : allItems.length > 0 ? (
          <div className="space-y-0.5">
            {allItems.map((item, i) => (
              <motion.button key={item.id + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                onClick={item.onClick}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted/15 transition-colors">
                {item.artwork ? (
                  <div className={`h-12 w-12 flex-shrink-0 overflow-hidden ${item.type === "artist" ? "rounded-full" : "rounded-md"}`}>
                    <img src={item.artwork} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="h-12 w-12 flex-shrink-0 rounded-md bg-muted/20 flex items-center justify-center">
                    <Music2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Music2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">Your library is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">Save songs, follow artists, or create your first playlist.</p>
            <button
              onClick={() => navigate("/create-playlist")}
              className="mt-5 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-glow hover:bg-primary/90"
            >
              Create Playlist
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
