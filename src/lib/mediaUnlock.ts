let mediaPlaybackUnlocked = false;
let unlockedPlaybackAudio: HTMLAudioElement | null = null;

// Tiny 1-second silent WAV loop to keep audio session alive in background
const SILENT_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

// Longer silent MP3 (~1s) for background keepalive looping
const SILENT_MP3_LOOP =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwAAAAAAAAAAAAAAAAD/+0DEAAAAAAA0gAAAAAAAAA0gAAAASf/6/gAHBwOB4Pg+D4IAgCAIAgD//Lg+D7/5cHwf/8uD4Pv+D4Pv/lwfB8HwfB9/8uD4Pv//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tAxBkAAADSAAAAAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tAxDEAAADSAAAAAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

let keepAliveAudio: HTMLAudioElement | null = null;
let isKeepAliveActive = false;

/**
 * Unlock browser media playback (especially mobile/PWA) inside a user gesture.
 * Call this synchronously in click/tap handlers before async playback work.
 */
export function unlockMediaPlayback() {
  if (typeof window === "undefined") return;

  try {
    const audio = unlockedPlaybackAudio || new Audio();
    unlockedPlaybackAudio = audio;
    audio.preload = "auto";
    audio.muted = true;
    audio.src = SILENT_AUDIO_DATA_URI;
    (audio as any).playsInline = true;

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          mediaPlaybackUnlocked = true;
        })
        .catch(() => {
          // Ignore; next user gesture can retry unlock.
        });
    } else {
      mediaPlaybackUnlocked = true;
    }
  } catch {
    // No-op: unsupported browser or blocked context.
  }
}

/**
 * Reuse the media element that was activated by the user's tap. Android
 * browsers keep autoplay permission on the element, not on audio elements
 * created later after an asynchronous stream lookup.
 */
export function claimUnlockedPlaybackAudio(): HTMLAudioElement {
  const audio = unlockedPlaybackAudio || new Audio();
  unlockedPlaybackAudio = null;
  audio.muted = false;
  audio.loop = false;
  audio.volume = 1;
  return audio;
}

/**
 * Start a silent audio loop to keep the browser audio session alive.
 * This prevents the browser from suspending the YouTube iframe audio
 * when the PWA is backgrounded or the screen is locked.
 */
export function startBackgroundKeepAlive() {
  if (isKeepAliveActive || typeof window === "undefined") return;

  try {
    if (!keepAliveAudio) {
      keepAliveAudio = new Audio();
      keepAliveAudio.src = SILENT_MP3_LOOP;
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01; // Near-silent but not muted (muted doesn't keep session)
      (keepAliveAudio as any).playsInline = true;
      keepAliveAudio.preload = "auto";
    }

    const playPromise = keepAliveAudio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          isKeepAliveActive = true;
          console.log("[KeepAlive] Background audio session started");
        })
        .catch((e) => {
          console.warn("[KeepAlive] Could not start background audio:", e);
        });
    }
  } catch {
    // No-op
  }
}

/**
 * Stop the silent audio keep-alive loop (when playback is paused/stopped).
 */
export function stopBackgroundKeepAlive() {
  if (!isKeepAliveActive || !keepAliveAudio) return;

  try {
    keepAliveAudio.pause();
    keepAliveAudio.currentTime = 0;
    isKeepAliveActive = false;
    console.log("[KeepAlive] Background audio session stopped");
  } catch {
    // No-op
  }
}

export function isMediaPlaybackUnlocked() {
  return mediaPlaybackUnlocked;
}
