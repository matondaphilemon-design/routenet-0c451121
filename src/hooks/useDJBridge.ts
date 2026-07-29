import { useEffect } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { Track } from "@/data/mockData";

/**
 * Bridge between DJ Context and Player Context
 * Handles DJ events and translates them to player actions
 */
export function useDJBridge() {
  const { play, pause, togglePlay, next, previous, toggleShuffle, setQueue } = usePlayer();

  useEffect(() => {
    const handlePlayTrack = (e: CustomEvent<Track>) => {
      const track = e.detail;
      if (track) play(track);
    };

    // Sync the DJ chapter queue to PlayerContext without auto-playing
    const handleSyncQueue = (e: CustomEvent<Track[]>) => {
      const tracks = e.detail;
      if (tracks && tracks.length > 0) {
        setQueue(tracks);
      }
    };

    const handleStop = () => pause();
    const handlePause = () => pause();
    const handleResume = () => play();
    const handleNext = () => next();
    const handlePrevious = () => previous();

    const handleSetQueue = (e: CustomEvent<Track[]>) => {
      const tracks = e.detail;
      if (tracks && tracks.length > 0) {
        setQueue(tracks);
        play(tracks[0]);
      }
    };

    const handleShuffle = () => toggleShuffle();

    window.addEventListener('dj-play-track', handlePlayTrack as EventListener);
    window.addEventListener('dj-sync-queue', handleSyncQueue as EventListener);
    window.addEventListener('dj-stop', handleStop);
    window.addEventListener('dj-pause', handlePause);
    window.addEventListener('dj-resume', handleResume);
    window.addEventListener('dj-next', handleNext);
    window.addEventListener('dj-previous', handlePrevious);
    window.addEventListener('dj-set-queue', handleSetQueue as EventListener);
    window.addEventListener('dj-shuffle', handleShuffle);

    return () => {
      window.removeEventListener('dj-play-track', handlePlayTrack as EventListener);
      window.removeEventListener('dj-sync-queue', handleSyncQueue as EventListener);
      window.removeEventListener('dj-stop', handleStop);
      window.removeEventListener('dj-pause', handlePause);
      window.removeEventListener('dj-resume', handleResume);
      window.removeEventListener('dj-next', handleNext);
      window.removeEventListener('dj-previous', handlePrevious);
      window.removeEventListener('dj-set-queue', handleSetQueue as EventListener);
      window.removeEventListener('dj-shuffle', handleShuffle);
    };
  }, [play, pause, next, previous, toggleShuffle, setQueue]);

  // NOTE: GlobalAudioPlayer already dispatches both 'player-track-ended' AND 'dj-track-ended'
  // so we do NOT re-dispatch here (was causing double-skip / loop bug).
}
