/**
 * AutoMix hook: crossfade between tracks with configurable duration.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

const AUTOMIX_KEY = "tunestream_automix_enabled";
const CROSSFADE_DURATION = 12000; // 12 seconds — matches GlobalAudioPlayer
const FADE_INTERVAL = 100; // ms

export function useAutoMix() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(AUTOMIX_KEY) === "true"; } catch { return false; }
  });
  const fadeRef = useRef<ReturnType<typeof setInterval>>();

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      localStorage.setItem(AUTOMIX_KEY, String(next));
      toast.success(next ? "automix on" : "automix off");
      return next;
    });
  }, []);

  /** 
   * Call this when the current track is approaching its end.
   * Returns a cleanup function. 
   * currentAudio: the currently playing HTMLAudioElement
   * nextPlay: function to start the next track
   */
  const startCrossfade = useCallback((currentAudio: HTMLAudioElement | null, nextPlay: () => void) => {
    if (!enabled || !currentAudio) {
      nextPlay();
      return;
    }

    const steps = CROSSFADE_DURATION / FADE_INTERVAL;
    const volumeStep = currentAudio.volume / steps;
    let step = 0;

    // Start fading out current
    fadeRef.current = setInterval(() => {
      step++;
      const newVol = Math.max(0, currentAudio.volume - volumeStep);
      currentAudio.volume = newVol;

      if (step >= steps) {
        if (fadeRef.current) clearInterval(fadeRef.current);
        currentAudio.pause();
        currentAudio.volume = 1;
        nextPlay();
      }
    }, FADE_INTERVAL);

    // Trigger next track play after a short delay (overlap)
    setTimeout(() => {
      nextPlay();
    }, CROSSFADE_DURATION / 2);
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
    };
  }, []);

  return { autoMixEnabled: enabled, toggleAutoMix: toggle, startCrossfade };
}
