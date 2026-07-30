/**
 * Piped API fallback chain for direct audio streaming.
 * Tries a small pool of healthy Piped instances; if all fail, returns null
 * so the caller can fall back to the YouTube iframe (which always works).
 */

// Instance pool. Dead instances are put on a cooldown at runtime so a single
// outage never stalls playback again for the rest of the session.
const PIPED_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.drgns.space",
  "https://pipedapi.kavin.rocks",
];

const INSTANCE_COOLDOWN_MS = 10 * 60 * 1000;
const deadInstances = new Map<string, number>();

function healthyInstances(): string[] {
  const now = Date.now();
  return PIPED_INSTANCES.filter((base) => {
    const until = deadInstances.get(base);
    return !until || until < now;
  });
}

function markInstanceDead(base: string) {
  deadInstances.set(base, Date.now() + INSTANCE_COOLDOWN_MS);
}

// Track IDs that always fail piped — go straight to iframe
const iframeOnlyIds = new Set<string>(
  JSON.parse(localStorage.getItem("tunestream_iframe_only") || "[]")
);

export function markAsIframeOnly(videoId: string) {
  iframeOnlyIds.add(videoId);
  try {
    localStorage.setItem(
      "tunestream_iframe_only",
      JSON.stringify([...iframeOnlyIds].slice(-200))
    );
  } catch {}
}

export function shouldUseIframe(videoId: string): boolean {
  return iframeOnlyIds.has(videoId);
}

export interface PipedAudioResult {
  url: string;
  instance: string;
}

export async function getPipedAudioUrl(
  videoId: string,
  timeoutMs = 4000
): Promise<PipedAudioResult | null> {
  if (shouldUseIframe(videoId)) {
    console.log(`[Piped] ${videoId} marked iframe-only, skipping`);
    return null;
  }

  const instances = healthyInstances();
  if (instances.length === 0) return null;

  for (const base of instances) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        markInstanceDead(base);
        continue;
      }

      const data = await res.json();
      // Prefer the highest-bitrate opus/m4a stream that's not DRM/HLS so
      // playback is gapless and the matched audio is the official one.
      const streams: any[] = (data.audioStreams || []).filter(
        (s: any) => s?.url && !s?.format?.toString().toLowerCase().includes("hls"),
      );
      streams.sort((a, b) => (b?.bitrate || 0) - (a?.bitrate || 0));
      const audioStream =
        streams.find((s) => s.codec === "opus") ||
        streams.find((s) => (s.mimeType || "").includes("audio/mp4")) ||
        streams[0];

      if (audioStream?.url) {
        console.log(`✅ Piped audio via ${base}`);
        return { url: audioStream.url, instance: base };
      }
      markInstanceDead(base);
    } catch {
      markInstanceDead(base);
    }
  }

  console.warn("[Piped] All instances failed for", videoId);
  return null;
}
