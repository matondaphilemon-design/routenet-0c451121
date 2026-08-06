/**
 * Shared YouTube media resolver — Piped pool → Invidious pool → Innertube.
 * Returns a direct (googlevideo) stream URL for audio or muxed video.
 */

const PIPED_INSTANCES: string[] = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.drgns.space",
  "https://piapi.ggtyler.dev",
  "https://pipedapi.leptons.xyz",
  "https://api.piped.yt",
];

const INVIDIOUS_INSTANCES: string[] = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.f5.si",
];

const INNERTUBE_ENDPOINT =
  "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const INNERTUBE_CLIENTS = [
  { name: "IOS", version: "20.10.4", userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)", extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iOS", osVersion: "18.0.0.22A3354" } },
  { name: "IOS_MUSIC", version: "7.31.2", userAgent: "com.google.ios.youtubemusic/7.31.2 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)", extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iOS", osVersion: "18.0.0.22A3354" } },
  { name: "ANDROID", version: "19.44.38", userAgent: "com.google.android.youtube/19.44.38 (Linux; U; Android 14) gzip", extra: { androidSdkVersion: 34, osName: "Android", osVersion: "14" } },
  { name: "WEB_EMBEDDED_PLAYER", version: "1.20250306.01.00", userAgent: "Mozilla/5.0", thirdParty: { embedUrl: "https://www.youtube.com" } },
  { name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", version: "2.0", userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version", thirdParty: { embedUrl: "https://www.youtube.com" } },
] as const;


export interface ResolvedStream {
  url: string;
  mimeType: string;
  source: string;
}

async function pipedResolve(videoId: string, audio: boolean): Promise<ResolvedStream | null> {
  for (let i = 0; i < PIPED_INSTANCES.length; i += 4) {
    const batch = PIPED_INSTANCES.slice(i, i + 4);
    const results = await Promise.allSettled(
      batch.map(async (base) => {
        const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (audio) {
          const list = (Array.isArray(data?.audioStreams) ? data.audioStreams : [])
            .filter((s: any) => s?.url)
            .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
          const pick = list.find((s: any) => String(s.mimeType || "").includes("mp4")) || list[0];
          if (!pick?.url) throw new Error("no audio");
          return { url: pick.url as string, mimeType: pick.mimeType || "audio/mp4", source: `piped:${base}` };
        }
        const muxed = (Array.isArray(data?.videoStreams) ? data.videoStreams : [])
          .filter((s: any) => s?.url && s.videoOnly === false)
          .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0));
        if (!muxed[0]?.url) throw new Error("no muxed");
        return { url: muxed[0].url as string, mimeType: muxed[0].mimeType || "video/mp4", source: `piped:${base}` };
      }),
    );
    for (const r of results) if (r.status === "fulfilled" && r.value) return r.value;
  }
  return null;
}

async function invidiousResolve(videoId: string, audio: boolean): Promise<ResolvedStream | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (audio) {
        const list = (data?.adaptiveFormats || [])
          .filter((f: any) => String(f?.type || "").startsWith("audio/") && f?.url)
          .sort((a: any, b: any) => Number(b.bitrate || 0) - Number(a.bitrate || 0));
        if (list[0]?.url) return { url: list[0].url, mimeType: list[0].type || "audio/mp4", source: `invidious:${base}` };
      } else {
        const list = (data?.formatStreams || []).filter((f: any) => f?.url);
        if (list[0]?.url) return { url: list[0].url, mimeType: list[0].type || "video/mp4", source: `invidious:${base}` };
      }
    } catch { /* next instance */ }
  }
  return null;
}

function urlFromCipher(cipher?: string): string | undefined {
  if (!cipher) return undefined;
  const params = new URLSearchParams(cipher);
  const url = params.get("url");
  return url || undefined;
}

async function innertubeResolve(videoId: string, audio: boolean): Promise<ResolvedStream | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch(INNERTUBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": client.userAgent },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              hl: "en",
              gl: "US",
              ...(("extra" in client) ? (client as any).extra : {}),
            },
            ...(("thirdParty" in client) ? { thirdParty: (client as any).thirdParty } : {}),
          },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const hasFormats =
        Array.isArray(data?.streamingData?.adaptiveFormats) || Array.isArray(data?.streamingData?.formats);
      if (!hasFormats) continue;


      const adaptive = Array.isArray(data?.streamingData?.adaptiveFormats) ? data.streamingData.adaptiveFormats : [];
      const regular = Array.isArray(data?.streamingData?.formats) ? data.streamingData.formats : [];
      const pool = audio
        ? adaptive.filter((f: any) => String(f?.mimeType || "").startsWith("audio/"))
        : regular.filter((f: any) => String(f?.mimeType || "").startsWith("video/"));

      const candidates = pool
        .map((f: any) => ({
          url: typeof f?.url === "string" ? f.url : urlFromCipher(f?.signatureCipher),
          mimeType: String(f?.mimeType || (audio ? "audio/mp4" : "video/mp4")).split(";")[0],
          bitrate: Number(f?.bitrate || 0),
        }))
        .filter((f: any) => !!f.url)
        .sort((a: any, b: any) => b.bitrate - a.bitrate);

      if (candidates[0]?.url) {
        return { url: candidates[0].url, mimeType: candidates[0].mimeType, source: `innertube:${client.name}` };
      }
    } catch { /* next client */ }
  }
  return null;
}

export async function resolveStream(videoId: string, audio: boolean): Promise<ResolvedStream> {
  const resolved =
    (await pipedResolve(videoId, audio)) ||
    (await invidiousResolve(videoId, audio)) ||
    (await innertubeResolve(videoId, audio)) ||
    // Last resort: a muxed/video stream still yields playable audio.
    (audio ? await pipedResolve(videoId, false) || await innertubeResolve(videoId, false) : null);

  if (!resolved?.url) throw new Error(audio ? "no audio stream found" : "no video stream found");
  return resolved;
}
