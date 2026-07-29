import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Settings, Edit2, Music, Clock, Users, Heart, ChevronRight, Share2, Play, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getUserPlaylists } from "@/services/playlistService";
import { useDeezerChartTracks } from "@/hooks/useMusicSearch";
import { Track, formatDuration } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useOnboardingPrefs } from "@/hooks/useOnboardingPrefs";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, setQueue } = usePlayer();
  const { prefs } = useOnboardingPrefs();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; bio: string | null } | null>(null);

  const { data: playlists } = useQuery({ queryKey: ["user-playlists"], queryFn: getUserPlaylists });
  const { data: chartTracks } = useDeezerChartTracks(10);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url, bio").eq("user_id", user.id).single().then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const displayName = profile?.display_name || (prefs as any)?.displayName || user?.email?.split("@")[0] || "User";
  const topTracks: Track[] = chartTracks?.slice(0, 5).map((t: any) => ({
    id: `deezer-${t.id}`, title: t.title, artist: t.artist?.name || "Unknown", album: t.album?.title || "", artwork: t.album?.cover_medium || "", duration: t.duration,
  })) || [];

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24">
      {/* Red gradient hero */}
      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(346 100% 40%) 0%, hsl(346 100% 25%) 50%, hsl(0 0% 4%) 100%)" }} />
        <div className="relative z-10 flex flex-col items-center pt-14">
          <div className="flex w-full items-center justify-between px-4 mb-4">
            <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-white/80"><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-sm text-white/80">Profile</span>
            <button onClick={() => navigate("/settings")} className="rounded-full p-1.5 text-white/80"><Settings className="h-5 w-5" /></button>
          </div>
          <div className="relative mb-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-white/30 bg-muted/30">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/60">{displayName.charAt(0).toUpperCase()}</div>
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">{displayName}</h2>
          <p className="text-xs text-white/60 mt-0.5">Main</p>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-5">
        {/* Stats row */}
        <div className="flex items-center justify-between glass-card p-4">
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-foreground">1,234</p>
            <p className="text-[10px] text-muted-foreground">Listeners</p>
          </div>
          <div className="w-px h-8 bg-border/30" />
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-foreground">567</p>
            <p className="text-[10px] text-muted-foreground">Hours streamed</p>
          </div>
        </div>

        {/* Progress bar (listening) */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Hours streamed</span>
            <span className="text-xs text-muted-foreground">567</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30">
            <div className="h-full rounded-full bg-primary" style={{ width: "65%" }} />
          </div>
        </div>

        {/* 2026 Wrapped */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 cursor-pointer hover:bg-muted/20 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">Routenet</p>
          <h3 className="text-lg font-bold text-foreground mb-3">2026 Wrapped</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-primary" /><span className="text-sm text-foreground">Your top genres</span></div>
            <div className="flex items-center gap-2"><Music className="h-3 w-3 text-muted-foreground" /><span className="text-sm text-foreground">Your top artists</span></div>
          </div>
        </motion.div>

        {/* Top Artists */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Top Artists</h3>
            <button className="text-xs text-muted-foreground">•••</button>
          </div>
          <div className="space-y-1">
            {topTracks.slice(0, 4).map((track, index) => (
              <motion.button key={track.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 }}
                onClick={() => { setQueue(topTracks); play(track); }}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 hover:bg-muted/15 transition-colors">
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-primary/20"><img src={track.artwork} alt="" className="h-full w-full object-cover" /></div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-foreground">{track.artist}</p>
                  <p className="text-xs text-muted-foreground">For You</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center"><Play className="h-3.5 w-3.5 text-primary-foreground ml-0.5" fill="currentColor" /></div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Recently Played */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Recently Played</h3>
            <button onClick={() => navigate("/recently-played")} className="text-xs text-muted-foreground">•••</button>
          </div>
          <button className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground btn-primary-glow">
            Story Next
          </button>
        </section>

        {/* Profile Settings */}
        <section className="glass-card overflow-hidden">
          <h3 className="text-sm font-bold text-foreground px-4 pt-4 pb-2">Profile Settings</h3>
          {[
            { label: "Account", color: "text-primary" },
            { label: "Display", color: "text-foreground" },
            { label: "Help", color: "text-foreground" },
          ].map(item => (
            <button key={item.label} onClick={() => navigate("/settings")}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
              <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
