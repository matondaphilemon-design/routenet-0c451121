import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, Pause, Shuffle, Globe, Lock, Trash2, Edit2, Plus, Music2,
  BookmarkPlus, Check, Download, Loader2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { Track, formatDuration } from "@/data/mockData";
import {
  getPlaylistTracks, removeTrackFromPlaylist, updatePlaylist, deletePlaylist,
  PlaylistRow, PlaylistTrackRow,
} from "@/services/playlistService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadTrack } from "@/services/downloadService";
import { DownloadProgressCircle } from "@/components/DownloadProgressCircle";
import { toTitleCase } from "@/utils/toTitleCase";

export default function UserPlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { play, setQueue, currentTrack, isPlaying, togglePlay } = usePlayer();

  const [playlist, setPlaylist] = useState<PlaylistRow | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { status: "pending" | "downloading" | "done" | "failed"; percent: number }>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      if (id.startsWith("local-")) {
        const localPlaylists = JSON.parse(localStorage.getItem("tunestream_local_playlists") || "[]");
        const localPl = localPlaylists.find((p: any) => p.id === id);
        if (localPl) { setPlaylist(localPl as PlaylistRow); setIsOwner(true); }
        const tData = await getPlaylistTracks(id);
        setTracks(tData);
        setLoading(false);
        return;
      }
      const { data: pData } = await supabase.from("playlists").select("*").eq("id", id).single();
      if (pData) {
        setPlaylist(pData as PlaylistRow);
        const { data: { user } } = await supabase.auth.getUser();
        setIsOwner(user?.id === pData.user_id);
        if (user && pData.user_id !== user.id) {
          const saved = JSON.parse(localStorage.getItem("tunestream_saved_playlists") || "[]");
          setIsSaved(saved.includes(id));
        }
      }
      const tData = await getPlaylistTracks(id);
      setTracks(tData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tracksAsPlayerTracks = useCallback((): Track[] => {
    return tracks.map((t) => ({
      id: t.id, title: t.track_title, artist: t.track_artist,
      album: t.track_album || "", artwork: t.track_artwork || "",
      duration: t.track_duration || 0, preview: t.track_preview || undefined,
    }));
  }, [tracks]);

  const handlePlayAll = () => { const pt = tracksAsPlayerTracks(); if (pt.length > 0) { setQueue(pt); play(pt[0]); } };
  const handleShufflePlay = () => { const pt = tracksAsPlayerTracks(); const s = [...pt].sort(() => Math.random() - 0.5); if (s.length > 0) { setQueue(s); play(s[0]); } };
  const handlePlayTrack = (index: number) => { const pt = tracksAsPlayerTracks(); setQueue(pt); play(pt[index]); };
  const handleRemoveTrack = async (trackId: string) => { const s = await removeTrackFromPlaylist(trackId); if (s) { setTracks(p => p.filter(t => t.id !== trackId)); toast.success("Track removed"); } };
  const handleTogglePublic = async () => { if (!playlist) return; const nv = !playlist.is_public; const s = await updatePlaylist(playlist.id, { is_public: nv }); if (s) { setPlaylist({ ...playlist, is_public: nv }); toast.success(nv ? "Playlist is now public" : "Playlist is now private"); } };
  const handleSaveName = async () => { if (!playlist || !editName.trim()) return; const s = await updatePlaylist(playlist.id, { name: editName.trim() }); if (s) { setPlaylist({ ...playlist, name: editName.trim() }); setEditing(false); toast.success("Name updated"); } };
  const handleDelete = async () => { if (!playlist) return; const s = await deletePlaylist(playlist.id); if (s) { toast.success("Playlist deleted"); navigate("/library"); } };

  const handleSaveToLibrary = async () => {
    if (!playlist || !id) return;
    setSavingToLibrary(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please log in to save playlists"); return; }
      const { data: np, error } = await supabase.from("playlists").insert({ name: playlist.name, description: playlist.description, is_public: false, user_id: user.id, cover_image: playlist.cover_image }).select().single();
      if (error || !np) throw error;
      if (tracks.length > 0) {
        const nt = tracks.map((t, i) => ({ playlist_id: np.id, track_title: t.track_title, track_artist: t.track_artist, track_album: t.track_album, track_artwork: t.track_artwork, track_duration: t.track_duration, track_preview: t.track_preview, position: i }));
        await supabase.from("playlist_tracks").insert(nt);
      }
      const saved = JSON.parse(localStorage.getItem("tunestream_saved_playlists") || "[]");
      saved.push(id);
      localStorage.setItem("tunestream_saved_playlists", JSON.stringify(saved));
      setIsSaved(true);
      toast.success(`"${playlist.name}" saved to your library!`);
    } catch (e) { console.error(e); toast.error("Failed to save playlist"); } finally { setSavingToLibrary(false); }
  };

  const handleDownloadAll = useCallback(async () => {
    const pt = tracksAsPlayerTracks();
    if (pt.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    const initial: Record<string, any> = {};
    pt.forEach(t => { initial[t.id] = { status: "pending", percent: 0 }; });
    setDownloadProgress(initial);
    toast.info(`Downloading ${pt.length} tracks...`);
    let downloaded = 0;
    for (const track of pt) {
      setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
      try {
        const ok = await downloadTrack(track, (p) => setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: p } })),
          { groupKey: `playlist-${id}`, groupName: playlist?.name || "", groupType: "playlist" });
        setDownloadProgress(prev => ({ ...prev, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } }));
        if (ok) downloaded++;
        await new Promise(r => setTimeout(r, 800));
      } catch { setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "failed", percent: 0 } })); }
    }
    setIsDownloadingAll(false);
    toast.success(`Downloaded ${downloaded} of ${pt.length} tracks`);
  }, [tracksAsPlayerTracks, isDownloadingAll, id, playlist]);

  const coverImage = playlist?.cover_image || tracks[0]?.track_artwork || "";
  const totalDuration = tracks.reduce((sum, t) => sum + (t.track_duration || 0), 0);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!playlist) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4"><p className="text-muted-foreground">Playlist not found</p><button onClick={() => navigate(-1)} className="text-primary">Go back</button></div>;

  return (
    <div className="min-h-full flex flex-col pb-4">
      {/* Hero */}
      <div className="relative px-4 pb-4 pt-12">
        <button onClick={() => navigate(-1)} className="absolute left-4 top-12 z-10 rounded-full p-1.5 text-foreground/80 hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center pt-8">
          {coverImage ? (
            <img src={coverImage} alt={playlist.name} className="mb-4 h-40 w-40 rounded-xl object-cover shadow-lg" />
          ) : (
            <div className="mb-4 flex h-40 w-40 items-center justify-center rounded-xl bg-muted shadow-lg"><Music2 className="h-16 w-16 text-muted-foreground/30" /></div>
          )}
          {isOwner && editing ? (
            <div className="mb-2 flex items-center gap-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-muted text-center text-lg font-bold" autoFocus onKeyDown={(e) => e.key === "Enter" && handleSaveName()} />
              <button onClick={handleSaveName} className="text-primary text-sm">Save</button>
              <button onClick={() => setEditing(false)} className="text-muted-foreground text-sm">Cancel</button>
            </div>
          ) : (
            <div className="mb-1 flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-foreground">{playlist.name}</h1>
              {isOwner && <button onClick={() => { setEditing(true); setEditName(playlist.name); }}><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></button>}
            </div>
          )}
          {playlist.description && <p className="mb-2 text-center text-sm text-muted-foreground">{playlist.description}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{tracks.length} tracks</span><span>•</span><span>{Math.floor(totalDuration / 60)} min</span><span>•</span>
            <div className="flex items-center gap-1">{playlist.is_public ? <Globe className="h-3 w-3 text-primary" /> : <Lock className="h-3 w-3" />}{playlist.is_public ? "Public" : "Private"}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={handleShufflePlay} className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm text-foreground hover:bg-muted/80"><Shuffle className="h-4 w-4" /> Shuffle</button>
          <button onClick={handlePlayAll} className="flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Play className="h-4 w-4" /> Play</button>
          <button onClick={handleDownloadAll} disabled={isDownloadingAll} className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm text-foreground hover:bg-muted/80 disabled:opacity-50">
            {isDownloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
          </button>
          {!isOwner && (
            <Button onClick={handleSaveToLibrary} disabled={isSaved || savingToLibrary} variant="outline" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm">
              {savingToLibrary ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : isSaved ? <><Check className="h-4 w-4 text-primary" /> Saved</> : <><BookmarkPlus className="h-4 w-4" /> Save</>}
            </Button>
          )}
          {isOwner && <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> Delete</button>}
        </div>
      </div>

      {/* Track list */}
      <div className="px-4">
        {isOwner && (
          <button onClick={() => navigate(`/create-playlist?addTo=${playlist.id}`)}
            className="mb-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-muted-foreground hover:border-primary hover:text-primary">
            <Plus className="h-5 w-5" /><span className="text-sm">Add more songs</span>
          </button>
        )}

        {tracks.map((track, index) => {
          const isCurrentTrack = currentTrack?.id === track.id;
          const dl = downloadProgress[track.id];
          return (
            <motion.div key={track.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }}
              className={`group flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-muted/30 ${isCurrentTrack ? "bg-primary/10" : ""}`}>
              <div className="flex-1 flex items-center gap-3" onClick={() => handlePlayTrack(index)}>
                <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span>
                {track.track_artwork ? <img src={track.track_artwork} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded bg-muted"><Music2 className="h-4 w-4 text-muted-foreground" /></div>}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isCurrentTrack ? "text-primary" : "text-foreground"}`}>{toTitleCase(track.track_title)}</p>
                  <p className="truncate text-xs text-muted-foreground">{toTitleCase(track.track_artist)}</p>
                </div>
                <span className="text-xs text-muted-foreground">{track.track_duration ? formatDuration(track.track_duration) : ""}</span>
              </div>
              <DownloadProgressCircle status={dl?.status || "idle"} percent={dl?.percent || 0} size={22}
                onClick={() => {
                  if (!dl) {
                    const pt: Track = { id: track.id, title: track.track_title, artist: track.track_artist, album: track.track_album || "", artwork: track.track_artwork || "", duration: track.track_duration || 0 };
                    setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
                    downloadTrack(pt, (p) => setDownloadProgress(prev => ({ ...prev, [track.id]: { status: "downloading", percent: p } })),
                      { groupKey: `playlist-${id}`, groupName: playlist?.name || "", groupType: "playlist" }
                    ).then(ok => { setDownloadProgress(prev => ({ ...prev, [track.id]: { status: ok ? "done" : "failed", percent: ok ? 100 : 0 } })); });
                  }
                }} />
              {isOwner && (
                <button onClick={(e) => { e.stopPropagation(); handleRemoveTrack(track.id); }}
                  className="rounded-full p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
