import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Music2, Loader2, X, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUserPlaylists, addTrackToPlaylist, PlaylistRow } from "@/services/playlistService";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface AddToPlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: { title: string; artist: string; album?: string; artwork?: string; duration?: number; preview?: string } | null;
}

export function AddToPlaylistDialog({ isOpen, onClose, track }: AddToPlaylistDialogProps) {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getUserPlaylists().then((p) => {
        setPlaylists(p);
        setLoading(false);
        // if no playlists, show create form automatically
        if (p.length === 0) setShowCreate(true);
      });
    } else {
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    }
  }, [isOpen]);

  const handleAdd = async (playlistId: string) => {
    if (!track) return;
    setAdding(playlistId);
    const ok = await addTrackToPlaylist(playlistId, track);
    if (ok) {
      toast.success("added to playlist");
      onClose();
    } else {
      toast.error("failed to add");
    }
    setAdding(null);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !track) return;
    setCreating(true);
    try {
      const { createPlaylist } = await import("@/services/playlistService");
      const playlist = await createPlaylist(newName.trim(), newDesc.trim() || undefined);
      if (playlist) {
        await addTrackToPlaylist(playlist.id, track);
        toast.success(`created "${newName}" and added song`);
        onClose();
      } else {
        toast.error("failed to create playlist");
      }
    } catch {
      toast.error("failed to create playlist");
    }
    setCreating(false);
  };

  if (!isOpen || !track) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-2xl bg-card border-t border-border/30 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold text-foreground">add to playlist</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* track preview */}
        <div className="flex items-center gap-2 px-4 pb-3 border-b border-border/20">
          {track.artwork ? <img src={track.artwork} className="h-10 w-10 rounded object-cover" /> : <Music2 className="h-10 w-10 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{track.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">{track.artist}</p>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] px-4 py-2">
          {/* create new inline */}
          {showCreate ? (
            <div className="space-y-2 mb-3 p-3 rounded-xl bg-muted/10 border border-border/20">
              <p className="text-xs font-semibold text-foreground">create new playlist</p>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="playlist name"
                className="text-sm rounded-lg" autoFocus />
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="description (optional)"
                className="text-sm rounded-lg" />
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={!newName.trim() || creating}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {creating ? "creating..." : "save & add song"}
                </button>
                <button onClick={() => setShowCreate(false)} className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-3 rounded-lg p-2.5 hover:bg-muted/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">create new playlist</span>
            </button>
          )}

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : playlists.length === 0 && !showCreate ? (
            <p className="text-center py-4 text-xs text-muted-foreground">no playlists yet</p>
          ) : (
            playlists.map((pl) => (
              <button key={pl.id} onClick={() => handleAdd(pl.id)} disabled={adding === pl.id}
                className="flex w-full items-center gap-3 rounded-lg p-2.5 hover:bg-muted/20 disabled:opacity-50">
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0">
                  {pl.cover_image ? <img src={pl.cover_image} className="h-full w-full object-cover" /> : <Music2 className="h-full w-full p-2 text-muted-foreground" />}
                </div>
                <span className="text-sm font-medium text-foreground flex-1 text-left truncate">{pl.name}</span>
                {adding === pl.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </>
  );
}