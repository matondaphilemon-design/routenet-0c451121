import { registerPlugin } from "@capacitor/core";

interface BackgroundServicePlugin {
  start: (opts: { title: string; artist: string }) => Promise<unknown>;
  stop: () => Promise<unknown>;
}

const BackgroundService = registerPlugin<BackgroundServicePlugin>("BackgroundService", {
  web: {
    start: async () => null,
    stop: async () => null,
  },
});

export async function startBackgroundService(
  title?: string,
  artist?: string
): Promise<boolean> {
  try {
    await BackgroundService.start({
      title: title || "TuneStream",
      artist: artist || "",
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundService(): Promise<boolean> {
  try {
    await BackgroundService.stop();
    return true;
  } catch {
    return false;
  }
}
