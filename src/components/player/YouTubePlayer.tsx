import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";

// YouTube IFrame API types
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  destroy: () => void;
  cueVideoById: (videoId: string) => void;
  loadVideoById: (videoId: string) => void;
  getPlayerState: () => number;
}

interface YTPlayerState {
  UNSTARTED: number;
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
}

interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: {
    autoplay?: number;
    controls?: number;
    modestbranding?: number;
    rel?: number;
    playsinline?: number;
    fs?: number;
    start?: number;
  };
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YTPlayerEvent) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
  PlayerState: YTPlayerState;
}

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  /** Resume position in seconds (used when failing over from a dead stream). */
  startSeconds?: number;
  isPlaying: boolean;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onProgress?: (progress: number, duration: number) => void;
  onEnd?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  className?: string;
  autoplay?: boolean;
}

export interface YouTubePlayerRef {
  seekTo: (seconds: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
}

let isAPILoaded = false;
let isAPILoading = false;
const apiReadyCallbacks: (() => void)[] = [];

const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (isAPILoaded && window.YT) {
      resolve();
      return;
    }

    apiReadyCallbacks.push(resolve);

    if (isAPILoading) return;

    isAPILoading = true;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      isAPILoaded = true;
      apiReadyCallbacks.forEach((cb) => cb());
      apiReadyCallbacks.length = 0;
    };
  });
};

export const preloadYouTubeAPI = loadYouTubeAPI;

/**
 * Check if the YT player instance is still alive (iframe not killed by browser).
 */
function isPlayerAlive(player: YTPlayer | null): boolean {
  if (!player) return false;
  try {
    // Calling getPlayerState on a dead iframe throws or returns undefined
    const state = player.getPlayerState();
    return typeof state === "number";
  } catch {
    return false;
  }
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  (
    {
      videoId,
      startSeconds = 0,
      isPlaying,
      onReady,
      onStateChange,
      onProgress,
      onEnd,
      onEnded,
      onError,
      className = "",
      autoplay = false,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isPlayerReady = useRef(false);
    const currentVideoIdRef = useRef<string>("");
    const isPlayingRef = useRef(isPlaying);
    const initCountRef = useRef(0);
    const startSecondsRef = useRef(startSeconds);
    startSecondsRef.current = startSeconds;
    isPlayingRef.current = isPlaying;

    // Store callbacks in refs to avoid recreating player on callback changes
    const onReadyRef = useRef(onReady);
    const onStateChangeRef = useRef(onStateChange);
    const onProgressRef = useRef(onProgress);
    const onEndRef = useRef(onEnd);
    const onEndedRef = useRef(onEnded);
    const onErrorRef = useRef(onError);
    onReadyRef.current = onReady;
    onStateChangeRef.current = onStateChange;
    onProgressRef.current = onProgress;
    onEndRef.current = onEnd;
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;

    const startProgressTracking = useCallback(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current && onProgressRef.current) {
          try {
            const currentTime = playerRef.current.getCurrentTime();
            const duration = playerRef.current.getDuration();
            if (duration > 0) {
              onProgressRef.current(currentTime, duration);
            }
          } catch {
            // Player may not be ready
          }
        }
      }, 250);
    }, []);

    const stopProgressTracking = useCallback(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
      },
      getDuration: () => {
        try {
          return playerRef.current?.getDuration() || 0;
        } catch { return 0; }
      },
      getCurrentTime: () => {
        try {
          return playerRef.current?.getCurrentTime() || 0;
        } catch { return 0; }
      },
    }));

    // Create/recreate the YT player instance
    const createPlayer = useCallback((targetVideoId: string) => {
      if (!containerRef.current || !window.YT) return;

      // Clean up existing player
      stopProgressTracking();
      isPlayerReady.current = false;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;

      const playerId = `youtube-player-persistent-${++initCountRef.current}`;
      const playerDiv = document.createElement("div");
      playerDiv.id = playerId;
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(playerDiv);

      currentVideoIdRef.current = targetVideoId;

      playerRef.current = new window.YT.Player(playerId, {
        videoId: targetVideoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          fs: 1,
          start: Math.floor(startSecondsRef.current || 0),
        },
        events: {
          onReady: () => {
            isPlayerReady.current = true;
            if (startSecondsRef.current > 0) {
              try { playerRef.current?.seekTo(startSecondsRef.current, true); } catch {}
            }
            onReadyRef.current?.();
            if (isPlayingRef.current) {
              playerRef.current?.playVideo();
              startProgressTracking();
            }
          },
          onStateChange: (event: YTPlayerEvent) => {
            onStateChangeRef.current?.(event.data);

            if (event.data === window.YT.PlayerState.PLAYING) {
              startProgressTracking();
            } else if (event.data === window.YT.PlayerState.PAUSED ||
                       event.data === window.YT.PlayerState.ENDED) {
              stopProgressTracking();
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current?.();
              onEndRef.current?.();
            }
          },
          onError: (event: { data: number }) => {
            console.warn(`[YouTubePlayer] Player error code: ${event.data}`);
            onErrorRef.current?.();
          },
        },
      });
    }, [startProgressTracking, stopProgressTracking]);

    // Initialize player ONCE
    useEffect(() => {
      let isMounted = true;

      const initPlayer = async () => {
        await loadYouTubeAPI();
        if (!isMounted) return;
        createPlayer(videoId);
      };

      initPlayer();

      return () => {
        isMounted = false;
        stopProgressTracking();
        isPlayerReady.current = false;
        try { playerRef.current?.destroy(); } catch {}
        playerRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When videoId changes, load new video — reinitialize if player is dead
    useEffect(() => {
      if (!videoId) return;
      if (videoId === currentVideoIdRef.current && isPlayerAlive(playerRef.current)) return;

      // If player is dead or not ready, recreate it entirely
      if (!isPlayerAlive(playerRef.current)) {
        console.log(`[YouTubePlayer] Player is dead/stale — reinitializing for: ${videoId}`);
        createPlayer(videoId);
        return;
      }

      currentVideoIdRef.current = videoId;
      console.log(`[YouTubePlayer] Loading new video: ${videoId} (reusing player)`);

      try {
        playerRef.current!.loadVideoById(videoId);
        if (startSecondsRef.current > 0) {
          const at = startSecondsRef.current;
          setTimeout(() => { try { playerRef.current?.seekTo(at, true); } catch {} }, 400);
        }
        startProgressTracking();
      } catch (e) {
        console.warn("[YouTubePlayer] loadVideoById failed, reinitializing:", e);
        createPlayer(videoId);
      }
    }, [videoId, createPlayer, startProgressTracking]);

    // Periodic health check — detect killed iframes (PWA background)
    useEffect(() => {
      const healthCheck = setInterval(() => {
        if (isPlayerReady.current && !isPlayerAlive(playerRef.current) && currentVideoIdRef.current) {
          console.log("[YouTubePlayer] Health check: player dead, reinitializing");
          createPlayer(currentVideoIdRef.current);
        }
      }, 5000);

      // Also check on visibility change (app coming back from background)
      const handleVisibility = () => {
        if (document.visibilityState === "visible" && isPlayerReady.current && currentVideoIdRef.current) {
          setTimeout(() => {
            if (!isPlayerAlive(playerRef.current)) {
              console.log("[YouTubePlayer] Visibility restored: player dead, reinitializing");
              createPlayer(currentVideoIdRef.current);
            } else if (isPlayingRef.current) {
              // Nudge playback in case it stalled
              try { playerRef.current?.playVideo(); } catch {}
            }
          }, 500);
        }
      };

      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        clearInterval(healthCheck);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, [createPlayer]);

    // Handle play/pause state changes
    useEffect(() => {
      if (!playerRef.current || !isPlayerReady.current) return;

      let retryTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        if (isPlaying) {
          playerRef.current.playVideo();
          retryTimer = setTimeout(() => {
            try {
              playerRef.current?.playVideo();
            } catch {}
          }, 200);
        } else {
          playerRef.current.pauseVideo();
        }
      } catch {
        // Player not ready yet
      }

      return () => {
        if (retryTimer) clearTimeout(retryTimer);
      };
    }, [isPlaying]);

    return (
      <div
        ref={containerRef}
        className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}
      />
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";
