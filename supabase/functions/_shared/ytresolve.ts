/**
 * Shared YouTube media resolver.
 *
 * Order: InnerTube (with a caller-supplied browser PO token when available)
 * → Piped pool → Invidious pool. Returns direct googlevideo stream URLs.
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

/**
 * Client order matters: ANDROID_VR and IOS resolve without a PO token from
 * datacenter IPs; TVHTML5 and WEB become viable once the browser hands us a
 * real PO token.
 */
const INNERTUBE_CLIENTS = [
  { name: "ANDROID_VR", version: "1.60.19", userAgent: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip", extra: { deviceMake: "Oculus", deviceModel: "Quest 3", osName: "Android", osVersion: "12L", androidSdkVersion: 32 } },
  { name: "IOS", version: "20.10.4", userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)", extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iOS", osVersion: "18.0.0.22A3354" } },
  { name: "TVHTML5", version: "7.20250312.16.00", userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version" },
  { name: "WEB", version: "2.20250312.04.00", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36" },
  { name: "MWEB", version: "2.20250312.04.00", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
  { name: "IOS_MUSIC", version: "7.31.2", userAgent: "com.google.ios.youtubemusic/7.31.2 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)", extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iOS", osVersion: "18.0.0.22A3354" } },
  { name: "ANDROID", version: "19.44.38", userAgent: "com.google.android.youtube/19.44.38 (Linux; U; Android 14) gzip", extra: { androidSdkVersion: 34, osName: "Android", osVersion: "14" } },
  { name: "WEB_EMBEDDED_PLAYER", version: "1.20250306.01.00", userAgent: "Mozilla/5.0", thirdParty: { embedUrl: "https://www.youtube.com" } },
  { name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", version: "2.0", userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version", thirdParty: { embedUrl: "https://www.youtube.com" } },
] as const;

export interface ResolvedStream {
  url: string;
  mimeType: string;
  source: string;
  /** Extra formats the caller can try if the first URL 403s. */
  alternatives?: Array<{ url: string; mimeType: string; bitrate: number }>;
}

export interface ResolveOptions {
  poToken?: string;
  gvsPoToken?: string;
  visitorData?: string;
}

/* ------------------------------------------------------------------ */
/* visitorData + signatureTimestamp                                    */
/* ------------------------------------------------------------------ */

let visitorDataCache: { value: string; at: number } | null = null;
let stsCache: { value: number; at: number } | null = null;

function ytCookie(): string | null {
  try {
    return Deno.env.get("YT_COOKIE") || null;
  } catch {
    return null;
  }
}

export async function getVisitorData(): Promise<string | null> {
  if (visitorDataCache && Date.now() - visitorDataCache.at < 30 * 60 * 1000) {
    return visitorDataCache.value;
  }

  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
  const headers = { "User-Agent": ua, ...(ytCookie() ? { cookie: ytCookie()! } : {}) };
  const pick = (value?: string | null) => {
    if (!value) return null;
    visitorDataCache = { value, at: Date.now() };
    return value;
  };

  // 1) InnerTube visitor_id — most reliable from datacenter IPs.
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/visitor_id?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: "2.20250312.04.00", hl: "en", gl: "US" } },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const value = data?.responseContext?.visitorData;
      if (typeof value === "string" && value.length > 10) return pick(value);
    }
  } catch { /* next source */ }

  // 2) Service-worker bootstrap data.
  try {
    const res = await fetch("https://www.youtube.com/sw.js_data", { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const text = (await res.text()).replace(/^\)\]\}'/, "");
      const match = text.match(/"(Cgt[A-Za-z0-9_\-%]{10,})"/);
      if (match?.[1]) return pick(match[1]);
    }
  } catch { /* next source */ }

  // 3) Homepage HTML.
  try {
    const res = await fetch("https://www.youtube.com/", { headers, signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"visitorData":"([^"]+)"/) || html.match(/"(Cgt[A-Za-z0-9_\-%]{10,})"/);
      if (match?.[1]) return pick(match[1].replace(/\\u003d/g, "="));
    }
  } catch { /* give up */ }

  return null;
}


/** Scrape the player's signatureTimestamp from base.js (cached for an hour). */
export async function getSignatureTimestamp(): Promise<number | null> {
  if (stsCache && Date.now() - stsCache.at < 60 * 60 * 1000) return stsCache.value;
  try {
    const iframe = await fetch("https://www.youtube.com/iframe_api", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const body = await iframe.text();
    const hash = body.match(/player\\?\/([0-9a-fA-F]{8})\\?\//)?.[1];
    if (!hash) return null;
    const baseJsUrl = `https://www.youtube.com/s/player/${hash}/player_ias.vflset/en_US/base.js`;
    const res = await fetch(baseJsUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const js = await res.text();
    const sts = js.match(/signatureTimestamp[:=](\d{5})/)?.[1];
    if (!sts) return null;
    stsCache = { value: Number(sts), at: Date.now() };
    return stsCache.value;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Resolvers                                                           */
/* ------------------------------------------------------------------ */

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
          return {
            url: pick.url as string,
            mimeType: pick.mimeType || "audio/mp4",
            source: `piped:${base}`,
            alternatives: list.slice(0, 4).map((s: any) => ({ url: s.url, mimeType: s.mimeType || "audio/mp4", bitrate: s.bitrate || 0 })),
          };
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
        if (list[0]?.url) {
          return {
            url: list[0].url,
            mimeType: list[0].type || "audio/mp4",
            source: `invidious:${base}`,
            alternatives: list.slice(0, 4).map((f: any) => ({ url: f.url, mimeType: f.type || "audio/mp4", bitrate: Number(f.bitrate || 0) })),
          };
        }
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
  return params.get("url") || undefined;
}

async function innertubeResolve(
  videoId: string,
  audio: boolean,
  opts: ResolveOptions = {},
): Promise<ResolvedStream | null> {
  const visitorData = opts.visitorData || (await getVisitorData());
  const poToken = opts.poToken;
  const cookie = ytCookie();
  const sts = await getSignatureTimestamp();

  // WebPO tokens are generated for the WEB client. Try compatible clients
  // first when one is supplied; mobile app clients use different attestation.
  const clients = poToken
    ? [...INNERTUBE_CLIENTS].sort((a, b) => Number(b.name === "WEB") - Number(a.name === "WEB"))
    : INNERTUBE_CLIENTS;

  for (const client of clients) {
    try {
      const res = await fetch(INNERTUBE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
          ...(visitorData ? { "X-Goog-Visitor-Id": visitorData } : {}),
          ...(cookie ? { cookie } : {}),
        },
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
              ...(visitorData ? { visitorData } : {}),
              ...(("extra" in client) ? (client as any).extra : {}),
            },
            ...(("thirdParty" in client) ? { thirdParty: (client as any).thirdParty } : {}),
          },
          ...(sts
            ? { playbackContext: { contentPlaybackContext: { signatureTimestamp: sts, html5Preference: "HTML5_PREF_WANTS" } } }
            : {}),
          ...(poToken
            ? { serviceIntegrityDimensions: { poToken } }
            : {}),
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.log(`[ytresolve] innertube ${client.name} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const adaptive = Array.isArray(data?.streamingData?.adaptiveFormats) ? data.streamingData.adaptiveFormats : [];
      const regular = Array.isArray(data?.streamingData?.formats) ? data.streamingData.formats : [];
      console.log(
        `[ytresolve] innertube ${client.name} po=${!!poToken} status=${data?.playabilityStatus?.status} formats=${adaptive.length + regular.length} reason=${data?.playabilityStatus?.reason ?? ""}`,
      );
      if (!adaptive.length && !regular.length) continue;

      const pool = audio
        ? adaptive.filter((f: any) => String(f?.mimeType || "").startsWith("audio/"))
        : [...regular, ...adaptive].filter((f: any) => String(f?.mimeType || "").startsWith("video/"));

      const candidates = pool
        .map((f: any) => ({
          url: typeof f?.url === "string" ? f.url : urlFromCipher(f?.signatureCipher),
          mimeType: String(f?.mimeType || (audio ? "audio/mp4" : "video/mp4")).split(";")[0],
          bitrate: Number(f?.bitrate || 0),
        }))
        .filter((f: any) => !!f.url)
        .map((f: any) => {
          if (!opts.gvsPoToken) return f;
          try {
            const mediaUrl = new URL(f.url);
            mediaUrl.searchParams.set("pot", opts.gvsPoToken);
            return { ...f, url: mediaUrl.toString() };
          } catch {
            return f;
          }
        })
        .sort((a: any, b: any) => b.bitrate - a.bitrate);

      if (candidates[0]?.url) {
        return {
          url: candidates[0].url,
          mimeType: candidates[0].mimeType,
          source: `innertube:${client.name}${poToken ? "+po" : ""}`,
          alternatives: candidates.slice(0, 5),
        };
      }
    } catch { /* next client */ }
  }
  return null;
}

export async function resolveStream(
  videoId: string,
  audio: boolean,
  opts: ResolveOptions = {},
): Promise<ResolvedStream> {
  const resolved =
    (await innertubeResolve(videoId, audio, opts)) ||
    (await pipedResolve(videoId, audio)) ||
    (await invidiousResolve(videoId, audio)) ||
    (audio ? (await innertubeResolve(videoId, false, opts)) || (await pipedResolve(videoId, false)) : null);

  if (!resolved?.url) {
    throw new Error(
      "YouTube is currently blocking this request (bot check). Please try again in a moment.",
    );
  }

  return resolved;
}
