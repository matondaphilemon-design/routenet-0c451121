import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Send, Loader2, Music2, ListMusic, Check, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GeneratedPlaylist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  coverImage: string | null;
}

const examplePrompts = [
  "Make me 5 playlists: chill coding vibes, late night R&B, gym beast mode, Sunday morning coffee, and 90s nostalgia",
  "Create workout playlists for different intensities - warmup, steady cardio, HIIT, cooldown",
  "I need playlists for each mood: happy, sad, angry, relaxed, romantic",
  "Generate party playlists: pregame hype, peak dance floor, after-party wind down",
];

export default function BatchPlaylistCreator() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [playlistCount, setPlaylistCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedPlaylist[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the playlists you want");
      return;
    }

    setGenerating(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-batch-playlist", {
        body: { prompt: prompt.trim(), count: playlistCount },
      });

      if (error) throw error;

      if (data?.success && data?.playlists?.length) {
        setResults(data.playlists);
        toast.success(`Created ${data.playlists.length} playlists!`);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error("No playlists were generated");
      }
    } catch (e: any) {
      console.error("Batch playlist error:", e);
      toast.error(e?.message || "Failed to generate playlists");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToLibrary = async (playlist: GeneratedPlaylist) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to save playlists");
        return;
      }

      // Clone the public playlist for the user
      const { data: originalTracks } = await supabase
        .from("playlist_tracks")
        .select("*")
        .eq("playlist_id", playlist.id)
        .order("position");

      const { data: newPlaylist, error } = await supabase
        .from("playlists")
        .insert({
          name: playlist.name,
          description: playlist.description,
          is_public: false,
          user_id: user.id,
          cover_image: playlist.coverImage,
        })
        .select()
        .single();

      if (error || !newPlaylist) throw error;

      if (originalTracks && originalTracks.length > 0) {
        const newTracks = originalTracks.map((t, i) => ({
          playlist_id: newPlaylist.id,
          track_title: t.track_title,
          track_artist: t.track_artist,
          track_album: t.track_album,
          track_artwork: t.track_artwork,
          track_duration: t.track_duration,
          track_preview: t.track_preview,
          position: i,
        }));
        await supabase.from("playlist_tracks").insert(newTracks);
      }

      setSavedIds(prev => new Set(prev).add(playlist.id));
      toast.success(`"${playlist.name}" saved to your library!`);
    } catch (e) {
      console.error("Save error:", e);
      toast.error("Failed to save playlist");
    }
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto px-4 pb-36 pt-12">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">AI Batch Playlists</h1>
          <p className="text-xs text-muted-foreground">Create multiple playlists at once</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
      </motion.header>

      {/* Input Area */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-muted/20 to-background p-4 border border-border/20">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the playlists you want... e.g., 'Create 5 playlists: chill coding vibes, gym bangers, rainy day mood, road trip anthems, and late night jazz'"
            className="min-h-[100px] bg-background/50 border-border/30 text-sm resize-none"
            disabled={generating}
          />

          {/* Count slider */}
          <div className="mt-3 flex items-center gap-3">
            <ListMusic className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Number of playlists</span>
                <span className="font-semibold text-foreground">{playlistCount}</span>
              </div>
              <Slider
                value={[playlistCount]}
                onValueChange={([v]) => setPlaylistCount(v)}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="mt-3 w-full gap-2 rounded-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating {playlistCount} playlists...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create {playlistCount} Playlists
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Example prompts */}
      {results.length === 0 && !generating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
          <p className="text-xs text-muted-foreground mb-2">Try these ideas:</p>
          <div className="space-y-2">
            {examplePrompts.map((example, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(example);
                  const count = example.match(/(\d+)/)?.[1];
                  if (count) setPlaylistCount(Math.min(parseInt(count), 10));
                }}
                className="w-full rounded-xl bg-muted/20 p-3 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading animation */}
      {generating && (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary animate-pulse" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="text-sm text-muted-foreground">AI is curating {playlistCount} playlists...</p>
          <p className="text-xs text-muted-foreground/60">This may take a moment</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">
              {results.length} Playlists Created
            </h2>
            <span className="text-[10px] text-muted-foreground">Public • Anyone can listen</span>
          </div>

          <div className="space-y-2">
            {results.map((playlist, index) => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 rounded-xl bg-muted/20 p-3 hover:bg-muted/30 transition-colors"
              >
                {playlist.coverImage ? (
                  <img src={playlist.coverImage} alt="" className="h-14 w-14 rounded-lg object-cover shadow" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                    <Music2 className="h-6 w-6 text-primary/60" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{playlist.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{playlist.trackCount} tracks</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/user-playlist/${playlist.id}`)}
                    className="h-8 rounded-full text-xs gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveToLibrary(playlist)}
                    disabled={savedIds.has(playlist.id)}
                    className="h-8 rounded-full text-xs gap-1"
                  >
                    {savedIds.has(playlist.id) ? (
                      <><Check className="h-3 w-3" /> Saved</>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          <Button
            onClick={() => { setResults([]); setPrompt(""); }}
            variant="outline"
            className="mt-4 w-full rounded-full"
          >
            Create More Playlists
          </Button>
        </motion.div>
      )}
    </div>
  );
}
