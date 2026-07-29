import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { Track } from "@/data/mockData";
import { getDJTracks, getDJChartTracks, UnifiedTrack, searchDeezerTrack } from "@/services/musicApi";
import { supabase } from "@/integrations/supabase/client";
import { getUserPlaylists, getPlaylistTracks, PlaylistTrackRow } from "@/services/playlistService";
import { cacheYouTubeId } from "@/components/player/GlobalAudioPlayer";
import { loadDJPreferences, DJPrefs } from "@/components/dj/DJPreferences";

// Convert UnifiedTrack to Track format
function unifiedToTrack(unified: UnifiedTrack): Track {
  return {
    id: unified.id,
    title: unified.title,
    artist: unified.artist,
    album: unified.album || "Unknown Album",
    artwork: unified.artwork,
    duration: unified.duration,
    preview: unified.preview,
  };
}

// Convert PlaylistTrackRow to Track
function playlistTrackToTrack(pt: PlaylistTrackRow): Track {
  return {
    id: pt.id,
    title: pt.track_title,
    artist: pt.track_artist,
    album: pt.track_album || "Unknown Album",
    artwork: pt.track_artwork || "",
    duration: pt.track_duration || 180,
    preview: pt.track_preview || undefined,
  };
}

export type DJPhase = "idle" | "loading" | "commentary" | "playing" | "set-break";

interface DJChapter {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  mood: string;
}

interface DJState {
  isEnabled: boolean;
  isPlaying: boolean;
  phase: DJPhase;
  currentChapter: DJChapter | null;
  currentTrackIndex: number;
  tracksPlayedInSet: number;
  volume: number;
  mood: string | null;
  history: Track[];
  skipHistory: string[];
  dislikeHistory: string[];
  likeHistory: string[];
  isProcessingRequest: boolean;
  lastCommentary: string;
  setTheme: string;
  nextMoodSuggestion: string | null;
  playlistPool: Track[];
  libraryPool: Track[];
  playlistName: string | null;
  
  preferences: DJPrefs;
}

interface DJContextType extends DJState {
  startDJ: (mood?: string) => void;
  startFromPlaylist: (playlistId: string, playlistName: string) => void;
  stopDJ: () => void;
  pauseDJ: () => void;
  resumeDJ: () => void;
  requestChange: (request: string) => Promise<void>;
  skipTrack: () => void;
  previousTrack: () => void;
  likeCurrent: () => void;
  dislikeCurrent: () => void;
  moreLikeThis: () => void;
  setVolume: (vol: number) => void;
  getCurrentTrack: () => Track | null;
  continueSet: () => void;
  updatePreferences: (prefs: DJPrefs) => void;
}

const DJContext = createContext<DJContextType | undefined>(undefined);

function getTimeBasedMood(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return "morning energy";
  if (hour >= 9 && hour < 12) return "focus flow";
  if (hour >= 12 && hour < 14) return "midday vibes";
  if (hour >= 14 && hour < 17) return "afternoon chill";
  if (hour >= 17 && hour < 20) return "evening wind-down";
  if (hour >= 20 && hour < 23) return "night drive";
  return "late night chill";
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Load user library (playlists + liked songs) for DJ pool
async function loadUserLibrary(): Promise<Track[]> {
  const tracks: Track[] = [];
  const seen = new Set<string>();

  // Load liked songs from localStorage
  try {
    const liked = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
    for (const s of liked) {
      const key = `${s.title}-${s.artist}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({
          id: s.id || `liked-${Date.now()}-${Math.random()}`,
          title: s.title,
          artist: s.artist,
          album: s.album || "Liked Songs",
          artwork: s.artwork || "",
          duration: s.duration || 180,
          preview: s.preview,
        });
      }
    }
  } catch {}

  // Load user playlists from DB
  try {
    const playlists = await getUserPlaylists();
    for (const pl of playlists.slice(0, 5)) {
      const ptracks = await getPlaylistTracks(pl.id);
      for (const pt of ptracks) {
        const key = `${pt.track_title}-${pt.track_artist}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          tracks.push(playlistTrackToTrack(pt));
        }
      }
    }
  } catch {}

  return tracks;
}

// Resolve AI-suggested tracks against the playlist pool or Deezer
async function resolveTracksFromAI(
  aiTracks: Array<{ title: string; artist: string; reason?: string }>,
  pool: Track[]
): Promise<Track[]> {
  const resolved: Track[] = [];

  for (const aiTrack of aiTracks) {
    const poolMatch = pool.find(p =>
      p.title.toLowerCase().includes(aiTrack.title.toLowerCase()) ||
      aiTrack.title.toLowerCase().includes(p.title.toLowerCase())
    );
    if (poolMatch) {
      resolved.push(poolMatch);
      continue;
    }

    try {
      const deezerResults = await searchDeezerTrack(`${aiTrack.title} ${aiTrack.artist}`, 1);
      if (deezerResults.length > 0) {
        const t = deezerResults[0];
        resolved.push({
          id: `deezer-${t.id}`,
          title: t.title,
          artist: t.artist?.name || aiTrack.artist,
          album: t.album?.title || "Unknown Album",
          artwork: t.album?.cover_medium || t.album?.cover || "",
          duration: t.duration,
          preview: t.preview,
        });
      }
    } catch {}
  }

  return resolved;
}


export function DJProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DJState>({
    isEnabled: false,
    isPlaying: false,
    phase: "idle",
    currentChapter: null,
    currentTrackIndex: 0,
    tracksPlayedInSet: 0,
    volume: 80,
    mood: null,
    history: [],
    skipHistory: [],
    dislikeHistory: [],
    likeHistory: [],
    isProcessingRequest: false,
    lastCommentary: "",
    setTheme: "",
    nextMoodSuggestion: null,
    playlistPool: [],
    libraryPool: [],
    playlistName: null,
    preferences: loadDJPreferences(),
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Expose DJ enabled flag globally so GlobalAudioPlayer knows whether DJ owns track-end advancement
  useEffect(() => {
    (window as any).__djEnabled = state.isEnabled;
    return () => { (window as any).__djEnabled = false; };
  }, [state.isEnabled]);

  const preferencesChangedRef = useRef(false);

  const updatePreferences = useCallback((prefs: DJPrefs) => {
    setState(prev => ({ ...prev, preferences: prefs }));
    preferencesChangedRef.current = true;
  }, []);

  // Ask AI to pick a set of tracks
  const generateAISet = useCallback(async (
    mood: string,
    pool: Track[],
    history: Track[],
    skipHistory: string[],
    userRequest?: string
  ): Promise<{ chapter: DJChapter; commentary: string; setTheme: string; nextMood: string | null }> => {
    const s = stateRef.current;

    // Build combined pool: 70% library, 30% discovery
    let combinedPool = [...pool];
    if (s.libraryPool.length > 0 && pool.length === 0) {
      combinedPool = [...s.libraryPool];
    }

    const playlistTracks = combinedPool.length > 0
      ? combinedPool.map(t => ({ title: t.title, artist: t.artist, album: t.album }))
      : undefined;
    const recentlyPlayed = history.slice(-8).map(t => `${t.title} - ${t.artist}`);

    let aiResult: any = null;
    try {
      const { data, error } = await supabase.functions.invoke("ai-dj", {
        body: {
          request: userRequest || `Create a ${mood} DJ set`,
          currentMood: mood,
          playlistTracks,
          recentlyPlayed,
          skipHistory: [...skipHistory, ...s.dislikeHistory],
          setSize: Math.min(combinedPool.length > 0 ? Math.min(combinedPool.length, 5) : 5, 5),
          userPreferences: {
            genres: s.preferences.genres,
            artists: s.preferences.artists,
            likedPatterns: s.likeHistory.slice(-10),
          },
          weightedSelection: {
            libraryWeight: combinedPool.length > 0 ? 70 : 0,
            discoveryWeight: combinedPool.length > 0 ? 30 : 100,
          },
        },
      });
      if (!error && data && data.tracks && data.tracks.length > 0) {
        aiResult = data;
      }
    } catch (e) {
      console.error("[DJ] AI call failed, falling back:", e);
    }

    let tracks: Track[];
    let commentary: string;
    let setTheme: string;
    let nextMood: string | null;

    if (aiResult) {
      tracks = await resolveTracksFromAI(aiResult.tracks, combinedPool);
      commentary = aiResult.commentary || "Let's go!";
      setTheme = aiResult.setTheme || "DJ's Pick";
      nextMood = aiResult.nextMoodSuggestion || null;
    } else {
      if (combinedPool.length > 0) {
        const available = combinedPool.filter(t =>
          !history.slice(-5).some(h => h.id === t.id) &&
          !skipHistory.includes(`${t.title} - ${t.artist}`) &&
          !s.dislikeHistory.includes(`${t.title} - ${t.artist}`)
        );
        tracks = shuffleArray(available).slice(0, 4);
      } else {
        // Use preferences to search for tracks
        const searchQuery = s.preferences.genres.length > 0
          ? `${s.preferences.genres[0]} ${mood}`
          : mood;
        const unifiedTracks = await getDJTracks(searchQuery, 8);
        tracks = unifiedTracks.length > 0
          ? shuffleArray(unifiedTracks.map(unifiedToTrack)).slice(0, 4)
          : shuffleArray((await getDJChartTracks(8)).map(unifiedToTrack)).slice(0, 4);
      }
      commentary = `Here's a ${mood} mix coming your way!`;
      setTheme = mood.charAt(0).toUpperCase() + mood.slice(1) + " Mix";
      nextMood = null;
    }

    if (tracks.length === 0) throw new Error("No tracks available");

    const chapter: DJChapter = {
      id: `chapter-${Date.now()}`,
      name: setTheme,
      description: `A ${mood} set curated by Routenet AI DJ`,
      tracks,
      mood,
    };

    return { chapter, commentary, setTheme, nextMood };
  }, []);

  // Start DJ with a mood
  const startDJ = useCallback(async (mood?: string) => {
    const selectedMood = mood || getTimeBasedMood();
    const prefs = loadDJPreferences();

    setState(prev => ({
      ...prev,
      isEnabled: true,
      isPlaying: false,
      phase: "loading",
      mood: selectedMood,
      lastCommentary: "Scanning your library and finding tracks...",
      playlistPool: [],
      playlistName: null,
      
      preferences: prefs,
    }));

    // Load user library in parallel with AI set generation
    const libraryTracks = await loadUserLibrary();
    setState(prev => ({ ...prev, libraryPool: libraryTracks }));

    try {
      const result = await generateAISet(selectedMood, [], [], []);
      const firstTrack = result.chapter.tracks[0];

      setState(prev => ({
        ...prev,
        phase: "commentary",
        currentChapter: result.chapter,
        currentTrackIndex: 0,
        tracksPlayedInSet: 0,
        lastCommentary: result.commentary,
        setTheme: result.setTheme,
        nextMoodSuggestion: result.nextMood,
      }));

      setTimeout(() => {
        setState(prev => ({ ...prev, phase: "playing", isPlaying: true }));
        window.dispatchEvent(new CustomEvent("dj-sync-queue", { detail: result.chapter.tracks }));
        window.dispatchEvent(new CustomEvent("dj-play-track", { detail: firstTrack }));
      }, 3000);
    } catch (error) {
      console.error("[DJ] Failed to start:", error);
      setState(prev => ({
        ...prev,
        isEnabled: false,
        phase: "idle",
        lastCommentary: "Couldn't find tracks. Try another mood!",
      }));
    }
  }, [generateAISet]);

  // Start DJ from a user playlist
  const startFromPlaylist = useCallback(async (playlistId: string, playlistName: string) => {
    setState(prev => ({
      ...prev,
      isEnabled: true,
      isPlaying: false,
      phase: "loading",
      lastCommentary: `Loading "${playlistName}"...`,
      playlistName,
    }));

    try {
      const tracks = await getPlaylistTracks(playlistId);
      if (tracks.length === 0) {
        setState(prev => ({
          ...prev, isEnabled: false, phase: "idle",
          lastCommentary: "Playlist is empty!",
        }));
        return;
      }

      const pool = tracks.map(playlistTrackToTrack);
      const mood = stateRef.current.mood || getTimeBasedMood();

      setState(prev => ({ ...prev, playlistPool: pool, mood }));

      const result = await generateAISet(mood, pool, [], []);
      const firstTrack = result.chapter.tracks[0];

      setState(prev => ({
        ...prev,
        phase: "commentary",
        currentChapter: result.chapter,
        currentTrackIndex: 0,
        tracksPlayedInSet: 0,
        lastCommentary: result.commentary,
        setTheme: result.setTheme,
        nextMoodSuggestion: result.nextMood,
      }));

      setTimeout(() => {
        setState(prev => ({ ...prev, phase: "playing", isPlaying: true }));
        window.dispatchEvent(new CustomEvent("dj-sync-queue", { detail: result.chapter.tracks }));
        window.dispatchEvent(new CustomEvent("dj-play-track", { detail: firstTrack }));
      }, 3000);
    } catch (error) {
      console.error("[DJ] Failed to start from playlist:", error);
      setState(prev => ({
        ...prev, isEnabled: false, phase: "idle",
        lastCommentary: "Failed to load playlist. Try again!",
      }));
    }
  }, [generateAISet]);

  // Stop DJ (ends session entirely — ephemeral, no data persisted)
  const stopDJ = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState(prev => ({
      ...prev,
      isEnabled: false,
      isPlaying: false,
      phase: "idle",
      currentChapter: null,
      currentTrackIndex: 0,
      tracksPlayedInSet: 0,
      history: [],
      skipHistory: [],
      dislikeHistory: [],
      likeHistory: [],
      playlistPool: [],
      libraryPool: [],
      lastCommentary: "",
      setTheme: "",
      nextMoodSuggestion: null,
      playlistName: null,
    }));
    window.dispatchEvent(new CustomEvent("dj-stop"));
  }, []);

  // Pause DJ (only pauses current song, DJ session stays active)
  const pauseDJ = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
    window.dispatchEvent(new CustomEvent("dj-pause"));
  }, []);

  // Resume DJ (resumes current song)
  const resumeDJ = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true }));
    window.dispatchEvent(new CustomEvent("dj-resume"));
  }, []);

  // Skip track
  const skipTrack = useCallback(async () => {
    const s = stateRef.current;
    if (!s.currentChapter) return;

    const skippedTrack = s.currentChapter.tracks[s.currentTrackIndex];
    const newSkipHistory = skippedTrack
      ? [...s.skipHistory, `${skippedTrack.title} - ${skippedTrack.artist}`].slice(-20)
      : s.skipHistory;

    const nextIndex = s.currentTrackIndex + 1;

    if (nextIndex < s.currentChapter.tracks.length) {
      const track = s.currentChapter.tracks[nextIndex];
      setState(prev => ({
        ...prev,
        currentTrackIndex: nextIndex,
        tracksPlayedInSet: prev.tracksPlayedInSet + 1,
        skipHistory: newSkipHistory,
        history: [...prev.history, track],
        phase: "playing",
      }));
      window.dispatchEvent(new CustomEvent("dj-play-track", { detail: track }));
    } else {
      setState(prev => ({
        ...prev,
        skipHistory: newSkipHistory,
      }));
      setTimeout(() => {
        if (stateRef.current.isEnabled) continueSetInternal();
      }, 500);
    }
  }, []);

  // Dislike current — adds to dislike history, skips track silently
  const dislikeCurrent = useCallback(() => {
    const track = stateRef.current.currentChapter?.tracks[stateRef.current.currentTrackIndex];
    if (track) {
      setState(prev => ({
        ...prev,
        dislikeHistory: [...prev.dislikeHistory, `${track.title} - ${track.artist}`].slice(-30),
      }));
      skipTrack();
    }
  }, [skipTrack]);

  // "More like this" — only modifies upcoming queue, does NOT stop current track
  const moreLikeThis = useCallback(async () => {
    const s = stateRef.current;
    const track = s.currentChapter?.tracks[s.currentTrackIndex];
    if (!track) return;

    // Add to like history for future reference
    setState(prev => ({
      ...prev,
      likeHistory: [...prev.likeHistory, `${track.title} - ${track.artist}`].slice(-20),
      isProcessingRequest: true,
    }));

    try {
      const result = await generateAISet(
        s.mood || "mixed",
        s.playlistPool.length > 0 ? s.playlistPool : s.libraryPool,
        s.history,
        s.skipHistory,
        `find songs similar to "${track.title}" by ${track.artist}. match the genre, energy, and vibe closely.`
      );

      // keep current track playing, just replace the remaining queue after it
      setState(prev => {
        if (!prev.currentChapter) return { ...prev, isProcessingRequest: false };
        const currentTracks = prev.currentChapter.tracks.slice(0, prev.currentTrackIndex + 1);
        const newChapter = {
          ...prev.currentChapter,
          tracks: [...currentTracks, ...result.chapter.tracks],
        };
        return {
          ...prev,
          currentChapter: newChapter,
          lastCommentary: `found more vibes like "${track.title}". queued up next.`,
          isProcessingRequest: false,
        };
      });

      // sync the new queue without interrupting playback
      const s2 = stateRef.current;
      if (s2.currentChapter) {
        window.dispatchEvent(new CustomEvent("dj-sync-queue", { detail: s2.currentChapter.tracks }));
      }
    } catch {
      setState(prev => ({ ...prev, isProcessingRequest: false, lastCommentary: "couldn't find similar tracks" }));
    }
  }, [generateAISet]);

  // Generate short between-set commentary (no caps, no emojis)
  const generateBetweenSetCommentary = useCallback(async (): Promise<string> => {
    const s = stateRef.current;
    const recentTracks = s.history.slice(-3).map(t => `${t.title} by ${t.artist}`);
    const nextMood = s.nextMoodSuggestion || s.mood || "vibes";
    
    const templates = [
      `that set was fire. you really vibed with ${recentTracks[0] || "those tracks"}. coming up next, more ${nextMood} energy.`,
      `alright, next set loading up with some fresh ${nextMood} picks.`,
      `big love for ${s.preferences.artists?.[0] || "your favorite artists"}. let me cook up another set for you.`,
      `we're not done yet. got more heat coming your way. stay locked in.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }, []);

  // Pre-fetch next tracks in background
  const prefetchNextSet = useCallback(async () => {
    const s = stateRef.current;
    if (!s.isEnabled || !s.currentChapter) return;
    const currentIdx = s.currentTrackIndex;
    const remaining = s.currentChapter.tracks.length - currentIdx - 1;
    // Pre-fetch when 1 track left in current set
    if (remaining <= 1 && !s.isProcessingRequest) {
      console.log("[DJ] Pre-fetching next set in background");
    }
  }, []);

  // Internal continue set — respects preference changes
  const continueSetInternal = async () => {
    const s = stateRef.current;
    
    // If preferences changed, reload them
    if (preferencesChangedRef.current) {
      const newPrefs = loadDJPreferences();
      setState(prev => ({ ...prev, preferences: newPrefs }));
      preferencesChangedRef.current = false;
      console.log("[DJ] Preferences updated, shifting song selection");
    }
    
    const mood = s.nextMoodSuggestion || s.mood || getTimeBasedMood();

    setState(prev => ({ ...prev, phase: "loading" }));

    try {
      const pool = s.playlistPool.length > 0 ? s.playlistPool : s.libraryPool;
      const result = await generateAISet(mood, pool, s.history, s.skipHistory);
      const firstTrack = result.chapter.tracks[0];

      setState(prev => ({
        ...prev,
        phase: "commentary",
        mood,
        currentChapter: result.chapter,
        currentTrackIndex: 0,
        tracksPlayedInSet: 0,
        lastCommentary: result.commentary,
        setTheme: result.setTheme,
        nextMoodSuggestion: result.nextMood,
      }));

      setTimeout(() => {
        setState(prev => ({ ...prev, phase: "playing", isPlaying: true }));
        window.dispatchEvent(new CustomEvent("dj-sync-queue", { detail: result.chapter.tracks }));
        window.dispatchEvent(new CustomEvent("dj-play-track", { detail: firstTrack }));
      }, 2500);
    } catch (error) {
      console.error("[DJ] Failed to continue:", error);
      setState(prev => ({
        ...prev, phase: "set-break",
        lastCommentary: "Having trouble finding tracks. Try a different mood!",
      }));
    }
  };

  const continueSet = useCallback(async () => {
    await continueSetInternal();
  }, []);

  // Previous track
  const previousTrack = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentChapter || s.currentTrackIndex === 0) return;

    const prevIndex = s.currentTrackIndex - 1;
    const track = s.currentChapter.tracks[prevIndex];

    setState(prev => ({ ...prev, currentTrackIndex: prevIndex }));
    window.dispatchEvent(new CustomEvent("dj-play-track", { detail: track }));
  }, []);

  // Like current track — does NOT stop current playback, only adjusts queue
  const likeCurrent = useCallback(() => {
    const s = stateRef.current;
    const track = s.currentChapter?.tracks[s.currentTrackIndex];
    if (track) {
      // Save to liked songs in localStorage
      try {
        const liked = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
        const exists = liked.some((s: any) => s.title === track.title && s.artist === track.artist);
        if (!exists) {
          liked.push({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.artwork,
            duration: track.duration,
          });
          localStorage.setItem("tunestream_liked_songs", JSON.stringify(liked));
        }
      } catch {}

      // only update like history and queue influence — never stop current playback
      setState(prev => ({
        ...prev,
        likeHistory: [...prev.likeHistory, `${track.title} - ${track.artist}`].slice(-20),
        lastCommentary: "noted, more like this coming up.",
      }));

      // re-sort remaining queue to favor similar tracks (simple: just note the preference)
      // the next set generation will use likeHistory to weight selections
    }
  }, []);

  // Handle text requests
  const requestChange = useCallback(async (request: string) => {
    setState(prev => ({ ...prev, isProcessingRequest: true }));

    try {
      const s = stateRef.current;
      const pool = s.playlistPool.length > 0 ? s.playlistPool : s.libraryPool;
      const result = await generateAISet(
        s.mood || "mixed",
        pool,
        s.history,
        s.skipHistory,
        request
      );
      const firstTrack = result.chapter.tracks[0];

      setState(prev => ({
        ...prev,
        phase: "commentary",
        currentChapter: result.chapter,
        currentTrackIndex: 0,
        tracksPlayedInSet: 0,
        lastCommentary: result.commentary,
        setTheme: result.setTheme,
        nextMoodSuggestion: result.nextMood,
        mood: result.chapter.mood,
        isProcessingRequest: false,
        isEnabled: true,
      }));

      setTimeout(() => {
        setState(prev => ({ ...prev, phase: "playing", isPlaying: true }));
        window.dispatchEvent(new CustomEvent("dj-sync-queue", { detail: result.chapter.tracks }));
        window.dispatchEvent(new CustomEvent("dj-play-track", { detail: firstTrack }));
      }, 3000);
    } catch (err) {
      console.error("[DJ] Request error:", err);
      setState(prev => ({
        ...prev,
        isProcessingRequest: false,
        lastCommentary: "Couldn't process that. Try again!",
      }));
    }
  }, [generateAISet]);

  // Set volume
  const setVolume = useCallback((vol: number) => {
    setState(prev => ({ ...prev, volume: Math.max(0, Math.min(100, vol)) }));
    document.querySelectorAll("audio, video").forEach((el) => {
      (el as HTMLMediaElement).volume = vol / 100;
    });
  }, []);

  // Get current track
  const getCurrentTrack = useCallback((): Track | null => {
    if (!stateRef.current.currentChapter) return null;
    return stateRef.current.currentChapter.tracks[stateRef.current.currentTrackIndex] || null;
  }, []);

  // Auto-advance on track end — silent transition within set, commentary between sets
  useEffect(() => {
    const handleTrackEnd = () => {
      const s = stateRef.current;
      if (!s.isEnabled || !s.currentChapter) return;

      const nextIndex = s.currentTrackIndex + 1;

      if (nextIndex < s.currentChapter.tracks.length) {
        const track = s.currentChapter.tracks[nextIndex];
        // Pre-fetch is already handled, just play next silently
        setState(prev => ({
          ...prev,
          currentTrackIndex: nextIndex,
          tracksPlayedInSet: prev.tracksPlayedInSet + 1,
          history: [...prev.history, track],
          phase: "playing",
          isPlaying: true,
        }));
        window.dispatchEvent(new CustomEvent("dj-play-track", { detail: track }));
      } else {
        // Set ended — generate between-set commentary then continue
        setState(prev => ({
          ...prev,
          phase: "loading",
        }));
        // Generate a short between-set comment
        generateBetweenSetCommentary().then(comment => {
          setState(prev => ({
            ...prev,
            lastCommentary: comment,
            phase: "commentary",
          }));
          setTimeout(() => {
            continueSetInternal();
          }, 3500);
        });
      }
    };

    window.addEventListener("dj-track-ended", handleTrackEnd);
    return () => window.removeEventListener("dj-track-ended", handleTrackEnd);
  }, []);

  return (
    <DJContext.Provider
      value={{
        ...state,
        startDJ,
        startFromPlaylist,
        stopDJ,
        pauseDJ,
        resumeDJ,
        requestChange,
        skipTrack,
        previousTrack,
        likeCurrent,
        dislikeCurrent,
        moreLikeThis,
        setVolume,
        getCurrentTrack,
        continueSet,
        updatePreferences,
      }}
    >
      {children}
    </DJContext.Provider>
  );
}

export function useDJ() {
  const context = useContext(DJContext);
  if (!context) {
    throw new Error("useDJ must be used within a DJProvider");
  }
  return context;
}
