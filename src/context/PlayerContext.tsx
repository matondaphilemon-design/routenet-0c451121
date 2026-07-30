import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { Track } from "@/data/mockData";
import { unlockMediaPlayback } from "@/lib/mediaUnlock";
import { recordListen } from "@/hooks/useListeningHistory";
import {
  buildRadioQueue,
  expandRadioQueue,
  loadSession,
  markPlayed,
  needsRefill,
  saveSession,
} from "@/services/radioEngine";

export interface VideoContent {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  thumbnail: string;
  duration?: number;
}

interface PlayerState {
  currentTrack: Track | null;
  currentVideo: VideoContent | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  queue: Track[];
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  isVideoMode: boolean;
}

interface PlayerContextType extends PlayerState {
  play: (track?: Track) => void;
  /** Play a track and build a fresh, diverse recommendation queue behind it. */
  playTrack: (track: Track, sourceList?: Track[]) => void;
  /** The song that will actually play next (matches the queue position). */
  nextTrack: Track | null;
  playVideo: (video: VideoContent) => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (progress: number) => void;
  setProgress: (progress: number, duration: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  setQueue: (tracks: Track[], opts?: { mode?: "radio" | "fixed" }) => void;
  stopVideo: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const artistKey = (track?: Track | null) => (track?.artist || "").trim().toLowerCase();

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const track of tracks) {
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    out.push(track);
  }
  return out;
}

function recordAdvancedTrack(track: Track) {
  recordListen(track);
  markPlayed(track);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    currentVideo: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    queue: [],
    shuffle: false,
    repeat: "off",
    isVideoMode: false,
  });

  // Shuffle history: track IDs played during current shuffle pass
  const shuffleHistoryRef = useRef<Set<string>>(new Set());
  // Guards against overlapping discovery runs (only the newest one applies).
  const discoveryToken = useRef(0);
  const extendingRef = useRef(false);
  const hydratedRef = useRef(false);

  // Queue recovery — restore the previous session on refresh (paused).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const session = loadSession();
    if (!session || session.queue.length === 0) return;
    const index = Math.min(Math.max(session.index, 0), session.queue.length - 1);
    setState((p) => (p.currentTrack ? p : { ...p, queue: session.queue, currentTrack: session.queue[index] }));
  }, []);

  // Persist lightweight session data (played IDs, queue, position).
  useEffect(() => {
    if (!state.queue.length) return;
    const index = Math.max(0, state.queue.findIndex((t) => t.id === state.currentTrack?.id));
    saveSession(state.queue, index);
  }, [state.queue, state.currentTrack]);

  /**
   * Every song selection starts a fresh Piped discovery session: the queue
   * behind the seed is rebuilt from ranked, diversified candidates.
   */
  const buildRecommendations = useCallback((track: Track, _sourceList?: Track[]) => {
    const token = ++discoveryToken.current;
    buildRadioQueue(track)
      .then((queue) => {
        if (queue.length < 2 || token !== discoveryToken.current) return;
        setState((p) => {
          if (p.currentTrack?.id !== track.id) return p; // user moved on
          return { ...p, queue: dedupeTracks(queue) };
        });
      })
      .catch(() => {});
  }, []);

  /**
   * Append a fresh batch seeded by the currently playing song so the
   * session never ends. Runs in the background — playback is untouched.
   */
  const extendQueue = useCallback((seed: Track) => {
    if (extendingRef.current) return;
    extendingRef.current = true;
    setState((p) => {
      expandRadioQueue(seed, p.queue)
        .then((extras) => {
          if (!extras.length) return;
          setState((cur) => {
            const existing = new Set(cur.queue.map((t) => t.id));
            const fresh = extras.filter((t) => !existing.has(t.id));
            if (!fresh.length) return cur;
            return { ...cur, queue: dedupeTracks([...cur.queue, ...fresh]) };
          });
        })
        .catch(() => {})
        .finally(() => { extendingRef.current = false; });
      return p;
    });
  }, []);

  const play = useCallback((track?: Track) => {
    unlockMediaPlayback();
    if (track) {
      recordListen(track);
      markPlayed(track);
      setState((prev) => {
        // Any explicit song selection starts a fresh Piped discovery session.
        buildRecommendations(track);
        return {
          ...prev,
          currentTrack: track,
          currentVideo: null,
          isPlaying: true,
          progress: 0,
          isVideoMode: false,
          queue: [track],
        };
      });
    } else {
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [buildRecommendations]);

  /**
   * Canonical entry point for "user selected a song". Starts playback
   * immediately and swaps in a genre-matched, multi-artist playlist as soon
   * as discovery resolves.
   */
  const playTrack = useCallback((track: Track, sourceList?: Track[]) => {
    unlockMediaPlayback();
    recordListen(track);
    markPlayed(track);
    shuffleHistoryRef.current.clear();
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      currentVideo: null,
      isPlaying: true,
      progress: 0,
      isVideoMode: false,
      queue: [track],
    }));
    buildRecommendations(track, sourceList);
  }, [buildRecommendations]);

  const playVideo = useCallback((video: VideoContent) => {
    unlockMediaPlayback();
    setState((prev) => ({
      ...prev,
      currentVideo: video,
      currentTrack: null,
      isPlaying: true,
      progress: 0,
      duration: video.duration || 0,
      isVideoMode: true,
    }));
  }, []);

  const stopVideo = useCallback(() => {
    setState((prev) => ({ ...prev, currentVideo: null, isPlaying: false, isVideoMode: false }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const togglePlay = useCallback(() => {
    unlockMediaPlayback();
    setState((prev) => {
      if (!prev.currentTrack && prev.queue.length > 0) {
        return { ...prev, currentTrack: prev.queue[0], isPlaying: true };
      }
      return { ...prev, isPlaying: !prev.isPlaying };
    });
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      if (!prev.currentTrack || prev.queue.length === 0) return prev;

      const currentIndex = prev.queue.findIndex((t) => t.id === prev.currentTrack?.id);

      if (prev.shuffle) {
        // Add current track to shuffle history
        if (prev.currentTrack) {
          shuffleHistoryRef.current.add(prev.currentTrack.id);
        }

        // Get unplayed tracks
        const unplayed = prev.queue.filter((t) => !shuffleHistoryRef.current.has(t.id));

        if (unplayed.length === 0) {
          // All tracks played — reset history
          shuffleHistoryRef.current.clear();
          if (prev.repeat === "all") {
            // Start fresh shuffle pass
            const others = prev.queue.filter((_, i) => i !== currentIndex);
            if (others.length === 0) return { ...prev, isPlaying: false, progress: 0 };
            const currentArtist = artistKey(prev.currentTrack);
            const pool = others.filter((t) => artistKey(t) !== currentArtist);
            const pick = (pool.length > 0 ? pool : others)[Math.floor(Math.random() * (pool.length > 0 ? pool : others).length)];
            shuffleHistoryRef.current.add(pick.id);
            recordAdvancedTrack(pick);
            return { ...prev, currentTrack: pick, progress: 0 };
          }
          // No repeat — stop
          return { ...prev, isPlaying: false, progress: 0 };
        }

        const currentArtist = artistKey(prev.currentTrack);
        const artistSafe = unplayed.filter((t) => artistKey(t) !== currentArtist);
        const pool = artistSafe.length > 0 ? artistSafe : unplayed;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        shuffleHistoryRef.current.add(pick.id);
        recordAdvancedTrack(pick);
        return { ...prev, currentTrack: pick, progress: 0 };
      }

      const nextIndex = currentIndex + 1;

      if (nextIndex >= prev.queue.length) {
        if (prev.repeat === "all") {
          const currentArtist = artistKey(prev.currentTrack);
          const restart = prev.queue.find((t) => artistKey(t) !== currentArtist) || prev.queue[0];
          recordAdvancedTrack(restart);
          return { ...prev, currentTrack: restart, progress: 0, isPlaying: true };
        }
        // End of an album / playlist / radio — keep the session alive by
        // pulling in a fresh, genre-matched recommendation playlist.
        extendQueue(prev.currentTrack);
        return { ...prev, progress: 0 };
      }

      let nextQueue = prev.queue;
      let pickIndex = nextIndex;
      const currentArtist = artistKey(prev.currentTrack);
      if (artistKey(prev.queue[nextIndex]) === currentArtist) {
        const safeIndex = prev.queue.findIndex((t, i) => i > nextIndex && artistKey(t) !== currentArtist);
        if (safeIndex > nextIndex) {
          const moved = prev.queue[safeIndex];
          nextQueue = [
            ...prev.queue.slice(0, nextIndex),
            moved,
            ...prev.queue.slice(nextIndex, safeIndex),
            ...prev.queue.slice(safeIndex + 1),
          ];
          pickIndex = nextIndex;
        }
      }

      const nextTrack = nextQueue[pickIndex];
      recordAdvancedTrack(nextTrack);
      // Top up before the queue runs dry (works for fixed queues too).
      if (nextQueue.length - pickIndex <= 3) extendQueue(nextTrack);
      // Trigger radio refill if needed (radio mode only)
      maybeRefillRadioQueue(nextTrack, nextQueue, pickIndex).then((extras) => {
        if (extras.length > 0) {
          setState((p) => {
            const dedup = extras.filter(e => !p.queue.some(t => t.id === e.id));
            if (dedup.length === 0) return p;
            const queue = enforceQueueRules(dedupeTracks([...p.queue, ...dedup]), p.queue.length + dedup.length);
            return { ...p, queue };
          });
        }
      }).catch(() => {});
      return { ...prev, queue: nextQueue, currentTrack: nextTrack, progress: 0, isPlaying: true };
    });
  }, [extendQueue]);

  const previous = useCallback(() => {
    setState((prev) => {
      if (!prev.currentTrack || prev.queue.length === 0) return prev;
      const currentIndex = prev.queue.findIndex((t) => t.id === prev.currentTrack?.id);
      const prevIndex = currentIndex === 0 ? prev.queue.length - 1 : currentIndex - 1;
      recordAdvancedTrack(prev.queue[prevIndex]);
      return { ...prev, currentTrack: prev.queue[prevIndex], progress: 0 };
    });
  }, []);

  const seek = useCallback((progress: number) => {
    setState((prev) => ({ ...prev, progress: Math.max(0, Math.min(1, progress)) }));
  }, []);

  const setProgress = useCallback((currentTime: number, duration: number) => {
    setState((prev) => ({
      ...prev,
      progress: duration > 0 ? currentTime / duration : 0,
      duration,
    }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => {
      if (!prev.shuffle) {
        // Turning shuffle ON — reset history
        shuffleHistoryRef.current.clear();
      }
      return { ...prev, shuffle: !prev.shuffle };
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setState((prev) => ({ ...prev, queue: [...prev.queue, track] }));
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setState((prev) => ({
      ...prev,
      queue: prev.queue.filter((t) => t.id !== trackId),
    }));
  }, []);

  const setQueue = useCallback((tracks: Track[], opts?: { mode?: "radio" | "fixed" }) => {
    shuffleHistoryRef.current.clear();
    // Default: setQueue with multiple tracks = fixed (album/playlist). Single = radio.
    const mode = opts?.mode ?? (tracks.length > 1 ? "fixed" : "radio");
    if (mode === "fixed") {
      queueManager.setFixedMode();
    }
    const queue = tracks.length > 1 ? enforceQueueRules(dedupeTracks(tracks), tracks.length) : tracks;
    setState((prev) => ({ ...prev, queue }));
  }, []);

  // The real "up next" — derived from the current position in the queue so
  // the player never advertises the wrong song.
  const nextTrack = (() => {
    if (!state.currentTrack || state.queue.length === 0) return null;
    const i = state.queue.findIndex((t) => t.id === state.currentTrack?.id);
    if (i === -1) return state.queue[0] ?? null;
    if (i + 1 < state.queue.length) return state.queue[i + 1];
    return state.repeat === "all" ? state.queue[0] ?? null : null;
  })();

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        nextTrack,
        play,
        playTrack,
        playVideo,
        pause,
        togglePlay,
        next,
        previous,
        seek,
        setProgress,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        removeFromQueue,
        setQueue,
        stopVideo,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
