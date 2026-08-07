import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Lock, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { Track } from "@/data/mockData";
import { DetailPage, totalLength } from "@/components/detail/DetailPage";
import { Button } from "@/components/ui/button";
import { getPlaylistTracks, updatePlaylist, deletePlaylist, type PlaylistRow, type PlaylistTrackRow } from "@/services/playlistService";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/utils/toTitleCase";

export default function UserPlaylistDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistRow | null>(null);
  const [rows, setRows] = useState<PlaylistTrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      if (id.startsWith("local-")) {
        const local = JSON.parse(localStorage.getItem("tunestream_local_playlists") || "[]") as PlaylistRow[];
        setPlaylist(local.find((item) => item.id === id) || null);
        setIsOwner(true);
      } else {
        const [{ data }, { data: auth }] = await Promise.all([
          supabase.from("playlists").select("*").eq("id", id).single(),
          supabase.auth.getUser(),
        ]);
        setPlaylist((data as PlaylistRow | null) || null);
        setIsOwner(Boolean(data && auth.user?.id === data.user_id));
      }
      setRows(await getPlaylistTracks(id));
    } catch {
      setPlaylist(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const tracks = useMemo<Track[]>(() => rows.map((row) => ({
    id: row.id,
    title: toTitleCase(row.track_title),
    artist: toTitleCase(row.track_artist),
    album: toTitleCase(row.track_album || ""),
    artwork: row.track_artwork || "",
    duration: row.track_duration || 0,
    preview: row.track_preview || undefined,
  })), [rows]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!playlist) return <div className="flex min-h-screen flex-col items-center justify-center gap-3"><p className="text-muted-foreground">Playlist not found</p><Button onClick={() => navigate(-1)}>Go back</Button></div>;

  const toggleVisibility = async () => {
    const value = !playlist.is_public;
    if (await updatePlaylist(playlist.id, { is_public: value })) {
      setPlaylist({ ...playlist, is_public: value });
      toast.success(value ? "Playlist is now public" : "Playlist is now private");
    }
  };

  const removePlaylist = async () => {
    if (await deletePlaylist(playlist.id)) {
      toast.success("Playlist deleted");
      navigate("/library");
    }
  };

  const cover = playlist.cover_image || tracks[0]?.artwork || "/placeholder.svg";

  return (
    <DetailPage
      cover={cover}
      title={playlist.name}
      typeLabel={playlist.is_public ? "Public Playlist" : "Private Playlist"}
      meta={[playlist.description, `${tracks.length} songs`, totalLength(tracks)]}
      owner={{ name: isOwner ? "Your playlist" : "Routenet listener" }}
      tracks={tracks}
      group={{ groupKey: `playlist-${id}`, groupName: playlist.name, groupType: "playlist" }}
      actions={isOwner ? (
        <>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => navigate(`/create-playlist?addTo=${playlist.id}`)} aria-label="Add songs"><Plus className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={toggleVisibility} aria-label={playlist.is_public ? "Make private" : "Make public"}>{playlist.is_public ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={removePlaylist} aria-label="Delete playlist"><Trash2 className="h-5 w-5" /></Button>
        </>
      ) : undefined}
    />
  );
}