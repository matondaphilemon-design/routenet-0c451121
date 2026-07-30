import { useEffect, useRef, useCallback, useState } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { YouTubePlayer, YouTubePlayerRef, preloadYouTubeAPI } from "./YouTubePlayer";
import { searchYouTubeForTrack } from "@/hooks/useYouTubePlayback";
import { Track } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
import { startBackgroundKeepAlive, stopBackgroundKeepAlive } from "@/lib/mediaUnlock";
import { getPipedAudioUrl, shouldUseIframe, markAsIframeOnly } from "@/services/pipedAudio";
import {
  isNativeAudioPluginAvailable,
  preloadNativeAudio,
  playNativeAudio,
  resumeNativeAudio,
  pauseNativeAudio,
  stopNativeAudio,
  getNativeAudioCurrentTime,
  startAppForegroundService,
} from "@/services/nativeAudioPlayer";

const youtubeIdCache = new Map<string, string>();

// Crossfade settings: 12s overlap. The outgoing track keeps playing to
// its natural end while the incoming track fades in over the same window
// so two songs literally play simultaneously during the handover.
// Only active when AutoMix is explicitly enabled — otherwise tracks play
// in full with a hard cut between them (no fade, no truncation).
const CROSSFADE_DURATION_MS = 12000;
const CROSSFADE_FADE_INTERVAL_MS = 200;
const FADE_IN_DURATION_MS = 12000;
function isAutoMixEnabled(): boolean {
  try {
    // Default OFF. Only enabled when explicitly set to "true".
    return localStorage.getItem("tunestream_automix_enabled") === "true";
  } catch { return false; }
}

function getCacheKey(title: string, artist: string): string {
  return `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;
}

export function cacheYouTubeId(title: string, artist: string, videoId: string) {
  youtubeIdCache.set(getCacheKey(title, artist), videoId);
}

export function getCachedYouTubeId(title: string, artist: string): string | undefined {
  return youtubeIdCache.get(getCacheKey(title, artist));
}

const preloadingSet = new Set<string>();

async function preloadNextTracks(queue: Track[], currentTrackId: string | undefined) {
  if (!currentTrackId || queue.length === 0) return;
  const currentIndex = queue.findIndex(t => t.id === currentTrackId);
  if (currentIndex === -1) return;

  const upcoming = queue.slice(currentIndex + 1, currentIndex + 4);
  const toPreload = upcoming.filter(track => {
    const key = getCacheKey(track.title, track.artist);
    return !youtubeIdCache.has(key) && !track.youtubeId && !preloadingSet.has(key);
  });

  await Promise.allSettled(
    toPreload.map(async (track) => {
      const key = getCacheKey(track.title, track.artist);
      preloadingSet.add(key);
      try {
        const id = await searchYouTubeForTrack(track);
        if (id) {
          cacheYouTubeId(track.title, track.artist, id);
          track.youtubeId = id;
        }
      } catch {} finally {
        preloadingSet.delete(key);
      }
    })
  );
}

let hasProactivelyCached = false;
function proactiveCacheLikedSongs() {
  if (hasProactivelyCached) return;
  hasProactivelyCached = true;
  try {
    const liked = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
    const uncached = liked.filter((s: any) => !getCachedYouTubeId(s.title, s.artist)).slice(0, 10);
    if (uncached.length === 0) return;
    const schedule = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 3000));
    schedule(() => {
      Promise.allSettled(
        uncached.map(async (s: any) => {
          const key = getCacheKey(s.title, s.artist);
          if (preloadingSet.has(key)) return;
          preloadingSet.add(key);
          try {
            const id = await searchYouTubeForTrack({ id: s.id, title: s.title, artist: s.artist, album: s.album || "", artwork: s.artwork || "", duration: s.duration || 180 } as Track);
            if (id) cacheYouTubeId(s.title, s.artist, id);
          } catch {} finally {
            preloadingSet.delete(key);
          }
        })
      );
    });
  } catch {}
}

export function GlobalAudioPlayer() {
  const {
    currentTrack, isPlaying, setProgress, next, repeat, queue, pause,
  } = usePlayer();

  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [usePipedAudio, setUsePipedAudio] = useState(false);
  const [useNativeAudio, setUseNativeAudio] = useState(false);
  const playerRef = useRef<YouTubePlayerRef>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nativeProgressRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const nativeEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nativeCurrentTimeRef = useRef<number>(0);
  const nativeAssetIdRef = useRef<string | null>(null);
  // While crossfading, the outgoing audio is moved here so the new track
  // can be created in audioRef without killing the tail of the previous song.
  const prevAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevFadeOutRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const searchTokenRef = useRef(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pipedProgressRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const iframeFailCountRef = useRef(0);
  const hasEndedRef = useRef(false); // Prevent double-fire of track end
  const crossfadeTriggeredRef = useRef(false);
  const crossfadeFadeRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Set when crossfade fired; consumed by the next track's load to fade in.
  const pendingFadeInRef = useRef(false);
  const fadeInIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    preloadYouTubeAPI();
    const timer = setTimeout(proactiveCacheLikedSongs, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentTrack && queue.length > 0) {
      const timer = setTimeout(() => preloadNextTracks(queue, currentTrack.id), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack?.id, queue]);

  const stopPrevAudio = useCallback(() => {
    if (prevFadeOutRef.current) {
      clearInterval(prevFadeOutRef.current);
      prevFadeOutRef.current = undefined;
    }
    if (prevAudioRef.current) {
      try { prevAudioRef.current.pause(); } catch {}
      try { prevAudioRef.current.src = ""; } catch {}
      prevAudioRef.current = null;
    }
  }, []);

  const stopNativeAudioPlayback = useCallback(async () => {
    if (nativeProgressRef.current) {
      clearInterval(nativeProgressRef.current);
      nativeProgressRef.current = undefined;
    }
    if (nativeEndTimeoutRef.current) {
      clearTimeout(nativeEndTimeoutRef.current);
      nativeEndTimeoutRef.current = undefined;
    }
    nativeCurrentTimeRef.current = 0;
    if (nativeAssetIdRef.current) {
      await stopNativeAudio(nativeAssetIdRef.current);
      nativeAssetIdRef.current = null;
    }
    setUseNativeAudio(false);
  }, []);

  // Handle track end — called from both iframe and piped
  const handleTrackEnd = useCallback(() => {
    if (hasEndedRef.current) return; // Prevent double-fire
    hasEndedRef.current = true;

    // Only fire DJ event if DJ is enabled (avoids interference with normal playback)
    const djEnabled = (window as any).__djEnabled === true;

    window.dispatchEvent(new CustomEvent("player-track-ended"));
    if (djEnabled) {
      window.dispatchEvent(new CustomEvent("dj-track-ended"));
    }

    if (repeat === "one") {
      // Replay same track
      hasEndedRef.current = false;
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } else {
        playerRef.current?.seekTo(0);
      }
    } else if (!djEnabled) {
      // Normal player — advance to next track
      setTimeout(() => {
        hasEndedRef.current = false;
        next();
      }, 150);
    } else {
      // DJ handles its own advancement; just reset the flag
      setTimeout(() => {
        hasEndedRef.current = false;
      }, 1000);
    }
  }, [repeat, next]);

  const startNativeProgress = useCallback(
    (duration: number) => {
      if (nativeProgressRef.current) {
        clearInterval(nativeProgressRef.current);
        nativeProgressRef.current = undefined;
      }
      if (nativeEndTimeoutRef.current) {
        clearTimeout(nativeEndTimeoutRef.current);
        nativeEndTimeoutRef.current = undefined;
      }
      nativeCurrentTimeRef.current = 0;
      if (duration > 0) {
        nativeProgressRef.current = setInterval(() => {
          const assetId = nativeAssetIdRef.current;
          if (!assetId) return;
          getNativeAudioCurrentTime(assetId).then((currentTime) => {
            if (currentTime === null) return;
            nativeCurrentTimeRef.current = Math.min(duration, Math.max(0, Math.floor(currentTime)));
            setProgress(nativeCurrentTimeRef.current, duration);
            if (nativeCurrentTimeRef.current >= duration - 1 && !hasEndedRef.current) {
              handleTrackEnd();
            }
          });
        }, 1000);
      }
    },
    [handleTrackEnd, setProgress]
  );

  const stopPipedAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (pipedProgressRef.current) {
      clearInterval(pipedProgressRef.current);
      pipedProgressRef.current = undefined;
    }
    if (crossfadeFadeRef.current) {
      clearInterval(crossfadeFadeRef.current);
      crossfadeFadeRef.current = undefined;
    }
    setUsePipedAudio(false);
    stopNativeAudioPlayback().catch(() => {});
  }, [stopNativeAudioPlayback]);

  /**
   * Hand playback over to the YouTube iframe, resuming at `seconds`.
   * Used whenever a direct stream dies so a song never stops half-way.
   */
  const failoverToIframe = useCallback((videoId: string, seconds: number) => {
    resumeAtRef.current = seconds > 2 ? seconds : 0;
    iframeFailCountRef.current = 0;
    setYoutubeId(videoId);
    setShowPlayer(true);
  }, []);



  /**
   * Promote audioRef to prevAudioRef and begin fading it out over the
   * crossfade window. The element keeps playing — only `audioRef` is
   * cleared so the next track can attach without cutting the tail.
   */
  const beginPrevFadeOut = useCallback(() => {
    // Kill any earlier prev (very fast back-to-back crossfade)
    stopPrevAudio();
    const outgoing = audioRef.current;
    if (!outgoing) return;
    prevAudioRef.current = outgoing;
    audioRef.current = null;
    if (pipedProgressRef.current) {
      clearInterval(pipedProgressRef.current);
      pipedProgressRef.current = undefined;
    }
    const startVol = outgoing.volume;
    const steps = Math.max(1, Math.floor(CROSSFADE_DURATION_MS / CROSSFADE_FADE_INTERVAL_MS));
    let step = 0;
    prevFadeOutRef.current = setInterval(() => {
      step++;
      try { outgoing.volume = Math.max(0, startVol * (1 - step / steps)); } catch {}
      if (step >= steps) {
        if (prevFadeOutRef.current) {
          clearInterval(prevFadeOutRef.current);
          prevFadeOutRef.current = undefined;
        }
        try { outgoing.pause(); } catch {}
        try { outgoing.src = ""; } catch {}
        if (prevAudioRef.current === outgoing) prevAudioRef.current = null;
      }
    }, CROSSFADE_FADE_INTERVAL_MS);
  }, [stopPrevAudio]);

  // Try Piped audio as fallback
  const tryPlayWithPiped = useCallback(async (videoId: string, track: Track) => {
    if (shouldUseIframe(videoId)) return false;

    try {
      const result = await getPipedAudioUrl(videoId, 6000);
      if (!result) return false;

      if (isNativeAudioPluginAvailable()) {
        stopPipedAudio();
        await stopNativeAudioPlayback();

        await startAppForegroundService();

        const loaded = await preloadNativeAudio(track.id, result.url, {
          title: track.title,
          artist: track.artist,
          album: track.album || "",
          artworkUrl: track.artwork || undefined,
        });
        if (loaded) {
          nativeAssetIdRef.current = track.id;
          setUseNativeAudio(true);
          setUsePipedAudio(false);
          if (track.duration > 0) {
            startNativeProgress(track.duration);
          }
          if ("mediaSession" in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: track.title,
              artist: track.artist,
              album: track.album || "",
              artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512" }] : [],
            });
          }
          const played = await playNativeAudio(track.id);
          return played;
        }
      }

      stopPipedAudio();

      const audio = new Audio(result.url);
      audio.crossOrigin = "anonymous";
      // Background-playback hardening: make sure the element is treated as
      // a real media player, preloads aggressively, and survives tab hide.
      audio.preload = "auto";
      (audio as any).playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
      audio.autoplay = true;
      audioRef.current = audio;

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || "",
          artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512" }] : [],
        });
      }

      audio.addEventListener("ended", handleTrackEnd);

      // If the direct stream dies part-way through (expired/geo-locked CDN
      // URL, network hiccup), don't kill playback — hand the rest of the
      // song over to the YouTube iframe at the exact same position so the
      // track always plays to the end.
      audio.addEventListener("error", () => {
        const at = audioRef.current?.currentTime || 0;
        console.warn("[Piped Audio] Playback error — failing over to iframe at", at);
        markAsIframeOnly(videoId);
        stopPipedAudio();
        failoverToIframe(videoId, at);
      });

      await audio.play();
      setUsePipedAudio(true);

      let lastTime = -1;
      let stalledTicks = 0;
      pipedProgressRef.current = setInterval(() => {
        if (audioRef.current) {
          const ct = audioRef.current.currentTime;
          const dur = audioRef.current.duration;

          // Stall watchdog: playback position frozen for ~8s while we think
          // we're playing means the stream died silently. Fail over.
          if (!audioRef.current.paused && !hasEndedRef.current) {
            if (Math.abs(ct - lastTime) < 0.01) {
              stalledTicks++;
              if (stalledTicks > 32) {
                stalledTicks = 0;
                console.warn("[Piped Audio] Stalled — failing over to iframe at", ct);
                markAsIframeOnly(videoId);
                stopPipedAudio();
                failoverToIframe(videoId, ct);
                return;
              }
            } else {
              stalledTicks = 0;
            }
          }
          lastTime = ct;

          if (dur > 0) {
            setProgress(ct, dur);
            if (
              isAutoMixEnabled() &&
              dur > CROSSFADE_DURATION_MS / 1000 + 1 &&
              dur - ct <= CROSSFADE_DURATION_MS / 1000 &&
              !crossfadeTriggeredRef.current &&
              !hasEndedRef.current
            ) {
              // Inline crossfade trigger (avoids stale closure on usePipedAudio)
              if ((window as any).__djEnabled !== true && repeat !== "one") {
                crossfadeTriggeredRef.current = true;
                pendingFadeInRef.current = true;
                // Move outgoing audio aside so the next track can attach
                // without truncating the current song. The element keeps
                // playing while fading out over CROSSFADE_DURATION_MS.
                beginPrevFadeOut();
                setTimeout(() => { next(); }, 50);
              }
            }
          }
        }
      }, 250);


      console.log(`✅ Playing via Piped audio: ${track.title}`);
      return true;
    } catch {
      return false;
    }
  }, [stopPipedAudio, setProgress, handleTrackEnd, beginPrevFadeOut, next, repeat]);

  // Handle play/pause for piped or native audio
  useEffect(() => {
    if (useNativeAudio) {
      if (currentTrack?.id) {
        if (isPlaying) {
          resumeNativeAudio(currentTrack.id).catch(() => {});
        } else {
          pauseNativeAudio(currentTrack.id).catch(() => {});
        }
      }
      return;
    }

    if (!usePipedAudio || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, usePipedAudio, useNativeAudio, currentTrack?.id]);

  // Reset hasEnded when track changes
  useEffect(() => {
    hasEndedRef.current = false;
    crossfadeTriggeredRef.current = false;
    if (crossfadeFadeRef.current) {
      clearInterval(crossfadeFadeRef.current);
      crossfadeFadeRef.current = undefined;
    }
    // If this track change was NOT triggered by an automix crossfade,
    // stop any lingering previous-audio fade-out so we don't have two
    // tracks overlapping after a manual skip.
    if (!pendingFadeInRef.current) {
      stopPrevAudio();
    }
    if (useNativeAudio) {
      nativeCurrentTimeRef.current = 0;
      if (nativeProgressRef.current) {
        clearInterval(nativeProgressRef.current);
        nativeProgressRef.current = undefined;
      }
      if (nativeEndTimeoutRef.current) {
        clearTimeout(nativeEndTimeoutRef.current);
        nativeEndTimeoutRef.current = undefined;
      }
    }
    // If a crossfade triggered this transition, ramp the new track's
    // volume from 0 to 1 over the fade-in window (Piped audio only —
    // YouTube iframe volume control isn't reliable cross-origin).
    if (fadeInIntervalRef.current) {
      clearInterval(fadeInIntervalRef.current);
      fadeInIntervalRef.current = undefined;
    }
    if (pendingFadeInRef.current) {
      pendingFadeInRef.current = false;
      const ramp = () => {
        const audio = audioRef.current;
        if (!audio) return false;
        audio.volume = 0;
        const steps = Math.max(1, Math.floor(FADE_IN_DURATION_MS / CROSSFADE_FADE_INTERVAL_MS));
        let step = 0;
        fadeInIntervalRef.current = setInterval(() => {
          step++;
          try { audio.volume = Math.min(1, step / steps); } catch {}
          if (step >= steps && fadeInIntervalRef.current) {
            clearInterval(fadeInIntervalRef.current);
            fadeInIntervalRef.current = undefined;
          }
        }, CROSSFADE_FADE_INTERVAL_MS);
        return true;
      };
      // Audio may not be created yet — retry briefly until it exists.
      if (!ramp()) {
        let tries = 0;
        const waiter = setInterval(() => {
          tries++;
          if (ramp() || tries > 20) clearInterval(waiter);
        }, 200);
      }
    } else if (audioRef.current) {
      audioRef.current.volume = 1;
    }
  }, [currentTrack?.id]);

  // Search YouTube for current track
  useEffect(() => {
    const track = currentTrack;
    const requestToken = ++searchTokenRef.current;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = undefined;
    }

    if (!track) {
      setYoutubeId(null);
      setIsSearching(false);
      stopPipedAudio();
      return;
    }

    const resolveAndPlay = async (videoId: string) => {
      if (requestToken !== searchTokenRef.current) return;

      stopPipedAudio();
      iframeFailCountRef.current = 0;

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || "",
          artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512" }] : [],
        });
      }

      if (isNativeAudioPluginAvailable()) {
        const pipedOk = await tryPlayWithPiped(videoId, track);
        if (pipedOk) {
          setYoutubeId(null);
          setShowPlayer(false);
          return;
        }
      }
      // On web (no native plugin), still try Piped first — it gives us real
      // <audio> control which is the only way crossfade can overlap two
      // tracks. The YouTube iframe can't be ducked/overlapped reliably.
      if (!isNativeAudioPluginAvailable()) {
        const pipedOk = await tryPlayWithPiped(videoId, track);
        if (pipedOk) {
          setYoutubeId(null);
          setShowPlayer(false);
          return;
        }
      }

      setYoutubeId(videoId);
      setShowPlayer(true);
    };

    if (track.youtubeId) {
      cacheYouTubeId(track.title, track.artist, track.youtubeId);
      stopPipedAudio();
      setIsSearching(false);
      resolveAndPlay(track.youtubeId);
      return;
    }

    const memCached = getCachedYouTubeId(track.title, track.artist);
    if (memCached) {
      track.youtubeId = memCached;
      setIsSearching(false);
      resolveAndPlay(memCached);
      return;
    }

    setIsSearching(true);
    stopPipedAudio();

    searchTimeoutRef.current = setTimeout(() => {
      if (requestToken === searchTokenRef.current) {
        toast({ title: "Skipping song", description: `"${track.title}" took too long to load`, variant: "destructive" });
        setIsSearching(false);
        next();
      }
    }, 15000);

    const trySearch = async (attempt: number): Promise<string | null> => {
      try {
        const id = await searchYouTubeForTrack(track);
        if (id) return id;
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
          return trySearch(attempt + 1);
        }
        return null;
      } catch (e) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
          return trySearch(attempt + 1);
        }
        throw e;
      }
    };

    trySearch(1)
      .then(async (id) => {
        if (requestToken !== searchTokenRef.current) return;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (id) {
          cacheYouTubeId(track.title, track.artist, id);
          track.youtubeId = id;
          await resolveAndPlay(id);
        } else {
          toast({ title: "Song unavailable", description: `Couldn't find "${track.title}" — skipping`, variant: "destructive" });
          next();
        }
      })
      .catch((e) => {
        if (requestToken !== searchTokenRef.current) return;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        console.error("[GlobalAudioPlayer] YouTube search error:", e);
        toast({ title: "Playback error", description: `Skipping "${track.title}"`, variant: "destructive" });
        next();
      })
      .finally(() => {
        if (requestToken === searchTokenRef.current) setIsSearching(false);
      });

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.youtubeId, next, stopPipedAudio, tryPlayWithPiped]);

  const triggerCrossfade = useCallback(() => {
    if (crossfadeTriggeredRef.current || hasEndedRef.current) return;
    if (repeat === "one") return;
    const djEnabled = (window as any).__djEnabled === true;
    if (djEnabled) return; // DJ manages its own transitions

    crossfadeTriggeredRef.current = true;
    pendingFadeInRef.current = true;

    // If using Piped audio, move the outgoing audio aside so it can keep
    // playing while fading out — the new track will attach to audioRef.
    if (audioRef.current && usePipedAudio) {
      beginPrevFadeOut();
    }

    // Kick off the next track immediately so it overlaps the tail
    setTimeout(() => { next(); }, 50);
  }, [next, repeat, usePipedAudio, beginPrevFadeOut]);

  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      setProgress(currentTime, duration);
      if (
        isAutoMixEnabled() &&
        duration > CROSSFADE_DURATION_MS / 1000 + 1 &&
        currentTime > 0 &&
        duration - currentTime <= CROSSFADE_DURATION_MS / 1000 &&
        !crossfadeTriggeredRef.current
      ) {
        triggerCrossfade();
      }
    },
    [setProgress, triggerCrossfade]
  );

  const handleVideoEnd = useCallback(() => {
    handleTrackEnd();
  }, [handleTrackEnd]);

  const handlePlayerError = useCallback(() => {
    iframeFailCountRef.current++;
    if (iframeFailCountRef.current > 2 && currentTrack && youtubeId) {
      console.warn("[Player] Iframe failed, trying Piped fallback...");
      tryPlayWithPiped(youtubeId, currentTrack).then(pipedOk => {
        if (pipedOk) {
          setYoutubeId(null);
          setShowPlayer(false);
        } else {
          toast({ title: "Playback failed", description: `Skipping "${currentTrack.title}"`, variant: "destructive" });
          next();
        }
      });
    }
  }, [currentTrack, youtubeId, tryPlayWithPiped, next]);

  useEffect(() => {
    (window as any).__globalAudioPlayerRef = playerRef;
    (window as any).__globalAudioRef = audioRef;
    (window as any).__isUsingPipedAudio = () => usePipedAudio;
    return () => {
      delete (window as any).__globalAudioPlayerRef;
      delete (window as any).__globalAudioRef;
      delete (window as any).__isUsingPipedAudio;
    };
  }, [usePipedAudio]);

  useEffect(() => {
    if (isPlaying && (youtubeId || usePipedAudio || useNativeAudio)) {
      startBackgroundKeepAlive();
    } else {
      stopBackgroundKeepAlive();
    }
    return () => stopBackgroundKeepAlive();
  }, [isPlaying, youtubeId, usePipedAudio, useNativeAudio]);

  if (usePipedAudio || !showPlayer || !youtubeId) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
      <YouTubePlayer
        ref={playerRef}
        videoId={youtubeId}
        isPlaying={isPlaying}
        onProgress={handleProgress}
        onEnd={handleVideoEnd}
        onReady={() => console.log("[GlobalAudioPlayer] YouTube player ready")}
        onError={handlePlayerError}
      />
    </div>
  );
}

export function getGlobalPlayerRef(): YouTubePlayerRef | null {
  return (window as any).__globalAudioPlayerRef?.current || null;
}

export function seekGlobalAudio(seconds: number) {
  const isPiped = (window as any).__isUsingPipedAudio?.();
  if (isPiped) {
    const audio = (window as any).__globalAudioRef?.current as HTMLAudioElement | null;
    if (audio) audio.currentTime = seconds;
  } else {
    getGlobalPlayerRef()?.seekTo(seconds);
  }
}

export function getGlobalCurrentTime(): number {
  const isPiped = (window as any).__isUsingPipedAudio?.();
  if (isPiped) {
    const audio = (window as any).__globalAudioRef?.current as HTMLAudioElement | null;
    return audio?.currentTime || 0;
  }
  return getGlobalPlayerRef()?.getCurrentTime() || 0;
}

export function getGlobalDuration(): number {
  const isPiped = (window as any).__isUsingPipedAudio?.();
  if (isPiped) {
    const audio = (window as any).__globalAudioRef?.current as HTMLAudioElement | null;
    return audio?.duration || 0;
  }
  return getGlobalPlayerRef()?.getDuration() || 0;
}
