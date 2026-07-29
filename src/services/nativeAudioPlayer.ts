import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capgo/native-audio";
import { startBackgroundService } from "./backgroundService";

const isNativeCapacitor = Capacitor.getPlatform() !== "web";
let nativeAudioConfigured = false;

export function isNativeAudioPluginAvailable() {
  return isNativeCapacitor && typeof NativeAudio !== "undefined";
}

export async function configureNativeAudio() {
  if (!isNativeAudioPluginAvailable() || nativeAudioConfigured) return false;
  try {
    if (typeof NativeAudio.configure === "function") {
      await NativeAudio.configure({
        showNotification: true,
        focus: true,
        background: true,
        backgroundPlayback: true,
      });
    }
    nativeAudioConfigured = true;
    return true;
  } catch (error) {
    console.warn("[NativeAudio] configure failed", error);
    return false;
  }
}

export async function startAppForegroundService(): Promise<boolean> {
  if (!isNativeAudioPluginAvailable()) return false;
  try {
    return await startBackgroundService("Routenet", "Audio playback");
  } catch (error) {
    console.warn('[NativeAudio] startForegroundService failed', error);
    return false;
  }
}
export async function preloadNativeAudio(
  assetId: string,
  assetPath: string,
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    artworkUrl?: string;
  }
) {
  if (!isNativeAudioPluginAvailable()) return false;
  try {
    await configureNativeAudio();
    await NativeAudio.preload({
      assetId,
      assetPath,
      isUrl: true,
      // Extra fields supported by the patched native plugin; cast for TS.
      ...({ backgroundPlayback: true, notificationMetadata: metadata } as Record<string, unknown>),
    } as Parameters<typeof NativeAudio.preload>[0]);
    return true;
  } catch (error) {
    console.warn("[NativeAudio] preload failed", error);
    return false;
  }
}

export async function playNativeAudio(assetId: string) {
  if (!isNativeAudioPluginAvailable()) return false;
  try {
    await NativeAudio.play({ assetId });
    return true;
  } catch (error) {
    console.warn("[NativeAudio] play failed", error);
    return false;
  }
}

export async function resumeNativeAudio(assetId: string) {
  if (!isNativeAudioPluginAvailable()) return false;
  try {
    await NativeAudio.resume({ assetId });
    return true;
  } catch (error) {
    console.warn("[NativeAudio] resume failed", error);
    return false;
  }
}

export async function pauseNativeAudio(assetId: string) {
  if (!isNativeAudioPluginAvailable()) return false;
  try {
    await NativeAudio.pause({ assetId });
    return true;
  } catch (error) {
    console.warn("[NativeAudio] pause failed", error);
    return false;
  }
}

export async function stopNativeAudio(assetId: string) {
  if (!isNativeAudioPluginAvailable()) return false;
  try {
    if (typeof NativeAudio.stop === "function") {
      await NativeAudio.stop({ assetId });
    } else {
      await NativeAudio.pause({ assetId });
    }
    return true;
  } catch (error) {
    console.warn("[NativeAudio] stop failed", error);
    return false;
  }
}

export async function getNativeAudioCurrentTime(assetId: string) {
  if (!isNativeAudioPluginAvailable()) return null;
  try {
    const result = await NativeAudio.getCurrentTime({ assetId });
    return typeof result?.currentTime === "number" ? result.currentTime : null;
  } catch (error) {
    console.warn("[NativeAudio] getCurrentTime failed", error);
    return null;
  }
}

export async function getNativeAudioDuration(assetId: string) {
  if (!isNativeAudioPluginAvailable()) return null;
  try {
    const result = await NativeAudio.getDuration({ assetId });
    return typeof result?.duration === "number" ? result.duration : null;
  } catch (error) {
    console.warn("[NativeAudio] getDuration failed", error);
    return null;
  }
}
