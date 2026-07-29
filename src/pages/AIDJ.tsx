import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Loader2, SkipBack, SkipForward, Play, Pause, Mic, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDJ } from "@/context/DJContext";
import { usePlayer } from "@/context/PlayerContext";
import { getGlobalPlayerRef } from "@/components/player/GlobalAudioPlayer";
import { unlockMediaPlayback } from "@/lib/mediaUnlock";
import DJPreferences, { loadDJPreferences, EditPreferencesButton } from "@/components/dj/DJPreferences";
import type { DJPrefs } from "@/components/dj/DJPreferences";
import { toTitleCase } from "@/utils/toTitleCase";
import { useAutoMix } from "@/hooks/useAutoMix";
import { supabase } from "@/integrations/supabase/client";

const DJ_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris" },
];
const VOICE_KEY = "tunestream_dj_voice_id";
const getDJVoice = () => localStorage.getItem(VOICE_KEY) || DJ_VOICES[0].id;

const SUPABASE_URL = "https://ykcdlqceysffegrmraid.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrY2RscWNleXNmZmVncm1yYWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0ODAwNDQsImV4cCI6MjA4MzA1NjA0NH0.j0oxJ6-aLbLTJS4LO4eB11i8LOxv0Avjd1nstBaWFwU";

let djAudio: HTMLAudioElement | null = null;
async function speakDJ(text: string) {
  if (!text) return;
  try {
    if (djAudio) { djAudio.pause(); djAudio = null; }
    // Cancel any browser TTS that may be queued
    window.speechSynthesis?.cancel();
    // Use raw fetch — supabase.functions.invoke parses body as JSON and corrupts binary audio
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token || SUPABASE_ANON;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({ text, voiceId: getDJVoice() }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    if (!blob.size) throw new Error("empty audio");
    const url = URL.createObjectURL(blob);
    djAudio = new Audio(url);
    djAudio.volume = 0.9;
    await djAudio.play();
    djAudio.onended = () => { URL.revokeObjectURL(url); djAudio = null; };
  } catch (err) {
    console.warn("ElevenLabs TTS failed, using browser fallback:", err);
    // fallback to browser TTS if ElevenLabs unavailable
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.05; u.volume = 0.9;
    window.speechSynthesis.speak(u);
  }
}

export default function AIDJ() {
  const navigate = useNavigate();
  const dj = useDJ();
  const { autoMixEnabled, toggleAutoMix } = useAutoMix();
  const [request, setRequest] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(getDJVoice());
  const { progress, duration, currentTrack: playerCurrentTrack } = usePlayer();

  // Prefer the actual playing track from PlayerContext so artwork/metadata always match
  const djCurrentTrack = dj.getCurrentTrack();
  const currentTrack = playerCurrentTrack || djCurrentTrack;
  const isActive = dj.phase === "playing" || dj.phase === "commentary";
  const prefs = loadDJPreferences();
  const needsOnboarding = !prefs.setupComplete;

  // When DJ becomes enabled, ensure AutoMix is on automatically
  useEffect(() => {
    if (dj.isEnabled && !autoMixEnabled) {
      toggleAutoMix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dj.isEnabled]);

  const lastSpokenRef = useRef("");
  useEffect(() => {
    if (dj.lastCommentary && dj.lastCommentary !== lastSpokenRef.current && dj.isEnabled) {
      lastSpokenRef.current = dj.lastCommentary;
      speakDJ(dj.lastCommentary);
    }
  }, [dj.lastCommentary, dj.isEnabled]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;
    await dj.requestChange(request.trim());
    setRequest("");
    setShowChat(false);
  };

  const handlePrefsComplete = (newPrefs: DJPrefs) => {
    dj.updatePreferences(newPrefs);
    setShowPrefs(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background"
      style={{ background: "var(--gradient-bg)" }}>

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => { window.speechSynthesis?.cancel(); navigate(-1); }}
          className="rounded-full p-1.5 text-foreground/80 hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded-md" />
          <h1 className="text-base font-bold text-foreground">AI Sonic Pulse</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVoicePicker(v => !v)}
            className="rounded-full px-3 py-1 text-xs font-semibold text-foreground bg-white/10 hover:bg-white/20">
            {DJ_VOICES.find(v => v.id === selectedVoice)?.name || "Voice"}
          </button>
          <button onClick={() => setShowChat(!showChat)}
            className="rounded-full p-1.5 text-foreground/80 hover:text-foreground">
            <Mic className="h-5 w-5" />
          </button>
        </div>
      </motion.header>


      {/* Voice picker */}
      <AnimatePresence>
        {showVoicePicker && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-4 z-30 rounded-2xl p-2 shadow-2xl"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)" }}>
            {DJ_VOICES.map(v => (
              <button key={v.id}
                onClick={async () => {
                  localStorage.setItem(VOICE_KEY, v.id);
                  setSelectedVoice(v.id);
                  setShowVoicePicker(false);
                  await speakDJ(`Hey, this is ${v.name}, your new DJ.`);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  v.id === selectedVoice ? "bg-white text-black" : "text-white hover:bg-white/15"
                }`}>
                <span>{v.name}</span>
                {v.id === selectedVoice && <Check className="h-4 w-4" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center overflow-y-auto">
        {(needsOnboarding && !dj.isEnabled) || showPrefs ? (
          <AnimatePresence>
            <DJPreferences onComplete={handlePrefsComplete} editMode={showPrefs} onClose={() => setShowPrefs(false)} />
          </AnimatePresence>
        ) : (
          <>
            {/* Green Circle */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative mb-10"
            >
              {/* Pulsing rings when active */}
              {isActive && [1, 2, 3].map(i => (
                <motion.div key={i}
                  className="absolute rounded-full border-2 border-primary"
                  style={{
                    width: `${140 + i * 30}px`,
                    height: `${140 + i * 30}px`,
                    top: `${-i * 15}px`,
                    left: `${-i * 15}px`,
                  }}
                  animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.05, 0.35] }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}

              <div className="relative h-[140px] w-[140px] rounded-full flex items-center justify-center border-[6px] border-primary shadow-glow">
                {currentTrack?.artwork && isActive ? (
                  <img src={currentTrack.artwork} alt=""
                    className="h-[112px] w-[112px] rounded-full object-cover" />
                ) : (
                  <div className="h-[112px] w-[112px] rounded-full bg-gradient-to-br from-primary to-accent" />
                )}
              </div>

            </motion.div>

            {/* Track info when playing */}
            {currentTrack && isActive && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4">
                <h2 className="text-lg font-bold text-foreground">{toTitleCase(currentTrack.title)}</h2>
                <p className="text-sm text-muted-foreground">{toTitleCase(currentTrack.artist)}</p>
              </motion.div>
            )}

            {/* Welcome text when idle */}
            {!isActive && !dj.isEnabled && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-3xl font-bold text-foreground mb-1">AI Sonic Pulse</h2>
                <p className="text-base text-muted-foreground mb-16">Generating your vibe…</p>
              </motion.div>
            )}


            {/* Loading state */}
            {dj.phase === "loading" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mb-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Creating your mix...</p>
              </motion.div>
            )}

            {/* Player Controls */}
            <div className="flex items-center justify-center gap-10">
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => { if (dj.isEnabled) dj.previousTrack(); }}
                className="text-foreground/85 cursor-pointer">
                <SkipBack className="h-7 w-7" fill="currentColor" />
              </motion.button>

              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (!dj.isEnabled && prefs.setupComplete) {
                    unlockMediaPlayback();
                    dj.startDJ();
                  } else if (dj.isPlaying) {
                    dj.pauseDJ();
                  } else {
                    unlockMediaPlayback();
                    dj.resumeDJ();
                  }
                }}
                className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-glow text-white">
                {dj.phase === "loading" ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : dj.isPlaying ? (
                  <Pause className="h-8 w-8" fill="currentColor" />
                ) : (
                  <Play className="h-8 w-8 ml-0.5" fill="currentColor" />
                )}
              </motion.button>

              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => { if (dj.isEnabled) dj.skipTrack(); }}
                className="text-foreground/85 cursor-pointer">
                <SkipForward className="h-7 w-7" fill="currentColor" />
              </motion.button>
            </div>


            {/* Preferences button */}
            {dj.isEnabled && !showPrefs && prefs.setupComplete && (
              <div className="mt-6"><EditPreferencesButton onClick={() => setShowPrefs(true)} /></div>
            )}

            {/* Start button when not started but setup is done */}
            {!dj.isEnabled && prefs.setupComplete && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-6">
                <EditPreferencesButton onClick={() => setShowPrefs(true)} />
              </motion.div>
            )}

            {dj.phase === "set-break" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <Button onClick={dj.continueSet} className="gap-2 rounded-full px-6 bg-white text-black font-semibold hover:bg-white/90">
                  Keep Playing
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Chat overlay */}
      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-16 left-0 right-0 z-20 rounded-t-2xl p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)" }}>
            <p className="text-xs text-white/60 mb-2">Tell the DJ what you want</p>
            <form onSubmit={handleRequest} className="flex gap-2">
              <Input value={request} onChange={(e) => setRequest(e.target.value)}
                placeholder="Play some chill hip-hop..."
                className="flex-1 rounded-full bg-white/10 border-white/20 text-sm text-white placeholder:text-white/40"
                disabled={dj.isProcessingRequest} autoFocus />
              <Button type="submit" size="icon" className="rounded-full bg-white text-black hover:bg-white/90"
                disabled={!request.trim() || dj.isProcessingRequest}>
                {dj.isProcessingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
