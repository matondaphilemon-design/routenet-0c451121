import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Search, Sparkles, Send, Loader2, Globe, Lock,
  Music2, X, Check, Play, Pause, Sliders,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";
import { createPlaylist, addTracksToPlaylist } from "@/services/playlistService";
import { searchDeezerTrack, DeezerTrack } from "@/services/musicApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PendingTrack {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
  preview?: string;
}

const promptSuggestions = [
  "Chill lo-fi for studying",
  "High-energy workout bangers",
  "Late night R&B vibes",
  "Feel-good summer anthems",
  "90s hip-hop classics",
  "Acoustic coffee shop vibes",
];

export default function CreatePlaylist() {
  const navigate = useNavigate();
  const { play, setQueue, isPlaying, currentTrack, togglePlay } = usePlayer();

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [tracks, setTracks] = useState<PendingTrack[]>([]);
  const [saving, setSaving] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeezerTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // AI
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiSongCount, setAiSongCount] = useState(0); // 0 = random
  const [showAISettings, setShowAISettings] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchDeezerTrack(searchQuery, 15);
      setSearchResults(results);
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  }, [searchQuery]);

  const addFromDeezer = (t: DeezerTrack) => {
    if (tracks.some((tr) => tr.title === t.title && tr.artist === t.artist?.name)) {
      toast.info("Already added"); return;
    }
    setTracks((prev) => [...prev, {
      title: t.title, artist: t.artist?.name || "Unknown",
      album: t.album?.title, artwork: t.album?.cover_medium || "",
      duration: t.duration, preview: t.preview,
    }]);
    toast.success(`Added "${t.title}"`);
  };

  const removeTrack = (i: number) => setTracks((p) => p.filter((_, idx) => idx !== i));

  const previewTrack = (track: PendingTrack) => {
    const t = { id: `preview-${track.title}`, title: track.title, artist: track.artist, album: track.album || "", artwork: track.artwork || "", duration: track.duration || 0, preview: track.preview || "" };
    setQueue([t]);
    play(t);
  };

  const handleAIGenerate = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (!name.trim()) { toast.error("Please name your playlist first"); return; }
    setGenerating(true);
    try {
      const countInstruction = aiSongCount > 0 ? `Generate exactly ${aiSongCount} songs.` : `Generate a random number of songs between 5 and 30.`;
      const { data, error } = await supabase.functions.invoke("ai-playlist", {
        body: { prompt: `${prompt}. ${countInstruction}`, provider: "gemini" },
      });
      if (error) throw error;

      if (data?.tracks?.length) {
        const deezerResults = await Promise.allSettled(
          data.tracks.map((t: any) => searchDeezerTrack(`${t.title} ${t.artist}`, 1))
        );
        const newTracks: PendingTrack[] = data.tracks.map((t: any, i: number) => {
          const r = deezerResults[i];
          if (r.status === "fulfilled" && r.value.length > 0) {
            const d = r.value[0];
            return { title: d.title || t.title, artist: d.artist?.name || t.artist, album: d.album?.title, artwork: d.album?.cover_medium || "", duration: d.duration, preview: d.preview };
          }
          return { title: t.title, artist: t.artist };
        });
        setTracks((prev) => [...prev, ...newTracks]);
        toast.success(`AI added ${newTracks.length} tracks!`);
      }
    } catch (e: any) {
      console.error("AI playlist error:", e);
      toast.error("Failed to generate playlist");
    } finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Please name your playlist"); return; }
    if (tracks.length === 0) { toast.error("Add at least one track"); return; }
    setSaving(true);
    try {
      const coverImage = tracks[0]?.artwork || null;
      const playlist = await createPlaylist(name.trim(), undefined, isPublic);
      if (!playlist) throw new Error("Failed to create");
      if (coverImage) {
        const { updatePlaylist } = await import("@/services/playlistService");
        await updatePlaylist(playlist.id, { cover_image: coverImage });
      }
      await addTracksToPlaylist(playlist.id, tracks);
      toast.success("Playlist created!");
      navigate(`/user-playlist/${playlist.id}`);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto px-4 pb-36 pt-12">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-bold text-foreground">Create Playlist</h1>
        <Button onClick={handleSave} disabled={saving || !name.trim() || tracks.length === 0} size="sm" className="gap-1 rounded-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </Button>
      </motion.header>

      {/* Name + Visibility */}
      <div className="mb-4 space-y-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name *" className="bg-muted/20 border-border text-base font-semibold" />
        <div className="flex items-center justify-between rounded-lg bg-muted/20 p-2.5">
          <div className="flex items-center gap-2">
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <span className="text-xs text-foreground">{isPublic ? "Public" : "Private"}</span>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-3 flex gap-2">
        <Button variant={showSearch ? "default" : "outline"} size="sm" onClick={() => { setShowSearch(!showSearch); setShowAI(false); }} className="gap-1 rounded-full text-xs">
          <Search className="h-3.5 w-3.5" /> Search
        </Button>
        <Button variant={showAI ? "default" : "outline"} size="sm" onClick={() => { setShowAI(!showAI); setShowSearch(false); }} className="gap-1 rounded-full text-xs">
          <Sparkles className="h-3.5 w-3.5" /> AI Generate
        </Button>
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
            <div className="glass-card p-3">
              <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="mb-2 flex gap-2">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search songs..." className="flex-1 bg-background/50 border-border text-xs" />
                <Button type="submit" size="icon" disabled={searching} className="h-9 w-9">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </form>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {searchResults.map((t) => (
                  <button key={t.id} onClick={() => addFromDeezer(t)} className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted/50">
                    <img src={t.album?.cover_small || ""} alt="" className="h-9 w-9 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{t.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{t.artist?.name}</p>
                    </div>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Panel */}
      <AnimatePresence>
        {showAI && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
            <div className="glass-card p-3">
              {/* AI Settings */}
              <button onClick={() => setShowAISettings(!showAISettings)} className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground hover:text-foreground">
                <Sliders className="h-3.5 w-3.5" /> Customize
              </button>
              <AnimatePresence>
                {showAISettings && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-3 overflow-hidden">
                    <div className="rounded-lg bg-muted/20 p-3 space-y-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Number of songs: {aiSongCount === 0 ? "Random" : aiSongCount}</label>
                        <Slider value={[aiSongCount]} onValueChange={([v]) => setAiSongCount(v)} min={0} max={50} step={1} className="mt-1" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={(e) => { e.preventDefault(); handleAIGenerate(aiPrompt); }} className="mb-2 flex gap-2">
                <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe your vibe..." className="flex-1 bg-background/50 border-border text-xs" disabled={generating} />
                <Button type="submit" size="icon" disabled={!aiPrompt.trim() || generating} className="h-9 w-9">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
              <div className="flex flex-wrap gap-1">
                {promptSuggestions.map((s) => (
                  <button key={s} onClick={() => { setAiPrompt(s); handleAIGenerate(s); }} disabled={generating} className="rounded-full bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track List */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground">Tracks ({tracks.length})</h2>
        {tracks.length > 0 && <button onClick={() => setTracks([])} className="text-[10px] text-destructive">Clear all</button>}
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Music2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No tracks yet. Search or use AI to add songs.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {tracks.map((track, index) => {
            const isPreviewPlaying = currentTrack?.title === track.title && isPlaying;
            return (
              <motion.div
                key={`${track.title}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted/20"
              >
                <span className="w-4 text-center text-[10px] text-muted-foreground">{index + 1}</span>
                {track.artwork ? (
                  <img src={track.artwork} alt="" className="h-9 w-9 rounded object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-muted"><Music2 className="h-4 w-4 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{track.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{track.artist}</p>
                </div>
                {/* Preview play button */}
                <button onClick={() => isPreviewPlaying ? togglePlay() : previewTrack(track)} className="rounded-full p-1 text-primary">
                  {isPreviewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => removeTrack(index)} className="rounded-full p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
