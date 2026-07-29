import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, Play } from "lucide-react";
import { useDeezerSearchTracks } from "@/hooks/useDeezerGenres";
import { usePlayer } from "@/context/PlayerContext";
import { toTitleCase } from "@/utils/toTitleCase";
import { seedRadioQueue } from "@/services/radioQueue";
import type { Track } from "@/data/mockData";

interface Daylist {
  id: string;
  title: string;
  timeRange: string;
  gradient: string;
  query: string;
}

function getUserPrefs(): { genres: string[]; artists: string[] } {
  try {
    const raw = localStorage.getItem("onboarding");
    if (raw) {
      const o = JSON.parse(raw);
      return {
        genres: (o.genres || []).map((g: any) => g?.name || g).filter(Boolean),
        artists: (o.artists || []).map((a: any) => a?.name || a).filter(Boolean),
      };
    }
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem("tunestream-prefs");
    if (raw) {
      const o = JSON.parse(raw);
      return { genres: o.genres || [], artists: o.artists || [] };
    }
  } catch { /* ignore */ }
  return { genres: [], artists: [] };
}

/**
 * Personalized daylists: titles + queries are derived from time-of-day
 * AND the user's onboarding genres/artists. No mock data — every query
 * is sent to the Deezer edge function for real tracks.
 */
function getDaylists(): Daylist[] {
  const { genres, artists } = getUserPrefs();
  const g0 = (genres[0] || "pop").toLowerCase();
  const g1 = (genres[1] || genres[0] || "hits").toLowerCase();
  const a0 = artists[0] || "";
  const hour = new Date().getHours();

  const slot = (range: string): { range: string; mood1: string; mood2: string; mood3: string } => {
    if (hour < 6)  return { range, mood1: "late night chill",        mood2: "ambient sleep",     mood3: "lofi midnight" };
    if (hour < 12) return { range, mood1: "morning energy",          mood2: "wake up motivation",mood3: "coffee shop focus" };
    if (hour < 17) return { range, mood1: "afternoon focus",         mood2: "midday upbeat",     mood3: "productive flow" };
    if (hour < 21) return { range, mood1: "evening wind down",       mood2: "sunset sessions",   mood3: "golden hour" };
    return                  { range, mood1: "night drive",            mood2: "after dark",        mood3: "deep night" };
  };
  const timeRange =
    hour < 6  ? "12am - 6am" :
    hour < 12 ? "6am - 12pm" :
    hour < 17 ? "12pm - 5pm" :
    hour < 21 ? "5pm - 9pm" : "9pm - 12am";
  const s = slot(timeRange);

  return [
    { id: `daylist-${hour}-1`, title: toTitleCase(s.mood1), timeRange, gradient: "from-purple-900 to-indigo-950", query: `${s.mood1} ${g0}`.trim() },
    { id: `daylist-${hour}-2`, title: toTitleCase(s.mood2), timeRange, gradient: "from-rose-700 to-orange-700",   query: `${s.mood2} ${g1}`.trim() },
    { id: `daylist-${hour}-3`, title: toTitleCase(s.mood3), timeRange, gradient: "from-emerald-700 to-teal-800",  query: a0 ? `${a0} mix` : `${s.mood3} ${g0}` },
  ];
}

function mapDeezerToTrack(t: any): Track {
  return {
    id: `deezer-${t.id}`,
    title: toTitleCase(t.title || t.title_short || "Unknown"),
    artist: toTitleCase(t.artist?.name || "Unknown"),
    album: t.album?.title || "",
    artwork: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "/placeholder.svg",
    duration: t.duration || 0,
    preview: t.preview,
  };
}

function DaylistCard({ daylist, index }: { daylist: Daylist; index: number }) {
  const { play, setQueue } = usePlayer();
  const { data: raw } = useDeezerSearchTracks(daylist.query, 30);
  const tracks = useMemo(() => (raw || []).map(mapDeezerToTrack), [raw]);
  const cover = tracks[0]?.artwork;
  const count = tracks.length;

  const onPlay = () => {
    if (tracks.length === 0) return;
    const first = tracks[0];
    setQueue([first], { mode: "radio" });
    seedRadioQueue(first, tracks, daylist.id)
      .then((q) => setQueue(q, { mode: "radio" }))
      .catch(() => {});
    play(first);
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onPlay}
      disabled={count === 0}
      className={`relative flex-shrink-0 w-40 h-40 overflow-hidden rounded-xl bg-gradient-to-br ${daylist.gradient} p-3 text-left active:scale-[0.98] transition-transform`}
    >
      {cover && (
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" loading="lazy" />
      )}
      <div className="relative h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <Clock className="h-4 w-4 text-white/70" />
          {count > 0 && (
            <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-md">
              <Play className="h-3.5 w-3.5 text-primary-foreground ml-0.5" fill="currentColor" />
            </span>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-white leading-tight">{daylist.title}</h3>
          <p className="mt-1 text-[10px] text-white/70">{daylist.timeRange}</p>
          <p className="text-[10px] text-white/60">{count > 0 ? `${count} tracks` : "Loading…"}</p>
        </div>
      </div>
    </motion.button>
  );
}

export function DaylistSection() {
  const daylists = useMemo(getDaylists, []);
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Your Daylist</h2>
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
          Updates throughout the day
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {daylists.map((d, i) => (
          <DaylistCard key={d.id} daylist={d} index={i} />
        ))}
      </div>
    </motion.section>
  );
}