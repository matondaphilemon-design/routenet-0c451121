import { useEffect } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { getGlobalPlayerRef } from "@/components/player/GlobalAudioPlayer";

/**
 * Hook to integrate with the Media Session API for lock-screen / notification controls.
 * Background-playback hardening: metadata + position state are pushed eagerly
 * so the OS keeps the notification/lock-screen widget alive when the tab is
 * hidden, and stop/seek handlers are registered for completeness.
 */
export function useMediaSession() {
  const { currentTrack, isPlaying, next, previous, togglePlay, pause, duration, progress } = usePlayer();

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || "",
      artwork: currentTrack.artwork
        ? [
            { src: currentTrack.artwork, sizes: "96x96", type: "image/jpeg" },
            { src: currentTrack.artwork, sizes: "128x128", type: "image/jpeg" },
            { src: currentTrack.artwork, sizes: "256x256", type: "image/jpeg" },
            { src: currentTrack.artwork, sizes: "512x512", type: "image/jpeg" },
          ]
        : [],
    });
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.artwork]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Update position state for lock screen scrubber
  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(progress * duration, duration),
      });
    } catch {
      // Some browsers don't support setPositionState
    }
  }, [progress, duration]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => previous());
    try { navigator.mediaSession.setActionHandler("stop", () => pause()); } catch {}

    // Seek support for lock screen scrubber
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      const player = getGlobalPlayerRef();
      if (player && details.seekTime !== undefined) {
        player.seekTo(details.seekTime);
      }
    });

    // Skip forward/backward 10s from lock screen
    navigator.mediaSession.setActionHandler("seekforward", () => {
      const player = getGlobalPlayerRef();
      if (player) {
        const cur = player.getCurrentTime();
        const dur = player.getDuration();
        player.seekTo(Math.min(dur, cur + 10));
      }
    });

    navigator.mediaSession.setActionHandler("seekbackward", () => {
      const player = getGlobalPlayerRef();
      if (player) {
        const cur = player.getCurrentTime();
        player.seekTo(Math.max(0, cur - 10));
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      try {
        navigator.mediaSession.setActionHandler("seekto", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {}
    };
  }, [togglePlay, pause, next, previous]);
}
