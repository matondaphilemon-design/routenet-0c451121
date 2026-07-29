/**
 * Piped API fallback chain for direct audio streaming.
 * Tries multiple Piped instances; if all fail, returns null
 * so the caller can fall back to YouTube iframe.
 */

// Per user request: a SINGLE stable Piped instance. No fan-out, no mirrors,
// no fallbacks. Keeps the link contract deterministic.
const PIPED_PRIMARY = "https://pipedapi.kavin.rocks";
const PIPED_INSTANCES = [PIPED_PRIMARY];

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
  timeoutMs = 6000
): Promise<PipedAudioResult | null> {
  if (shouldUseIframe(videoId)) {
    console.log(`[Piped] ${videoId} marked iframe-only, skipping`);
    return null;
  }

  for (const base of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;

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
    } catch {
      // Continue to next instance
    }
  }

  console.warn("[Piped] All instances failed for", videoId);
  markAsIframeOnly(videoId);
  return null;
}
