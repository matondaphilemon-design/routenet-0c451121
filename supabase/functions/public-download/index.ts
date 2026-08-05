import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Public media download proxy.
 * Resolves a YouTube video id to a real muxed MP4 / audio stream via Piped and
 * streams the bytes back with `content-disposition: attachment` so the browser
 * (or the app's download service) can save a real file. Bypasses CORS.
 */

const INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.r4fo.com",
];

const ALLOWED_HOSTS = [
  "googlevideo.com",
  "pipedapi.kavin.rocks",
  "pipedapi.adminforge.de",
  "api.piped.private.coffee",
  "pipedapi.reallyaweso.me",
  "pipedapi.r4fo.com",
  "adminforge.de",
  "private.coffee",
  "reallyaweso.me",
  "r4fo.com",
];

function cleanName(name: string) {
  const safe = name.replace(/["\\]/g, "").replace(/[^\w\d ._-]+/g, "_").slice(0, 90) || "media";
  return /\.(mp4|m4a|webm|mp3)$/i.test(safe) ? safe : `${safe}.mp4`;
}

function assertAllowedTarget(target: string) {
  const parsed = new URL(target);
  if (parsed.protocol !== "https:") throw new Error("bad protocol");
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some((a) => host === a || host.endsWith(`.${a}`))) {
    throw new Error("unsupported media host");
  }
  return parsed;
}

async function pipedStreams(videoId: string) {
  let lastError: unknown;
  for (const base of INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.audioStreams || data?.videoStreams) return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("no streams found");
}

function pickAudio(data: any): string {
  const list = (Array.isArray(data?.audioStreams) ? data.audioStreams : [])
    .filter((s: any) => s?.url)
    .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  const mp4 = list.find((s: any) => String(s.mimeType || "").includes("mp4"));
  const chosen = mp4 || list[0];
  if (!chosen?.url) throw new Error("no audio stream found");
  return chosen.url as string;
}

function pickMuxedMp4(data: any): string {
  const muxed = (Array.isArray(data?.videoStreams) ? data.videoStreams : [])
    .filter((s: any) => s?.url && s.videoOnly === false)
    .filter((s: any) => !s.mimeType || String(s.mimeType).includes("mp4"))
    .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0));
  if (!muxed[0]?.url) throw new Error("no downloadable MP4 stream found");
  return muxed[0].url as string;
}

async function proxyMedia(request: Request, target: string, name: string) {
  let parsed: URL;
  try {
    parsed = assertAllowedTarget(target);
  } catch (error) {
    return new Response((error as Error)?.message || "bad url", { status: 400, headers: corsHeaders });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(parsed.toString(), {
    headers: {
      ...(range ? { range } : {}),
      "user-agent": "Mozilla/5.0",
      accept: "audio/mp4,video/mp4,video/*,*/*",
    },
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`upstream ${upstream.status}`, { status: 502, headers: corsHeaders });
  }

  const headers = new Headers(corsHeaders);
  for (const h of ["content-length", "content-range", "accept-ranges", "content-type"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  headers.set("content-disposition", `attachment; filename="${cleanName(name)}"`);
  headers.set("cache-control", "no-store");
  headers.set("access-control-expose-headers", "content-length,content-range,content-type,content-disposition");

  return new Response(upstream.body, { status: upstream.status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let videoId = "";
    let target = "";
    let name = "media";
    let audioOnly = false;

    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as
        | { videoId?: string; url?: string; name?: string; audio?: boolean }
        | null;
      if (!body) return new Response("bad body", { status: 400, headers: corsHeaders });
      videoId = body.videoId || "";
      target = body.url || "";
      name = body.name || "media";
      audioOnly = !!body.audio;
    } else {
      const url = new URL(req.url);
      videoId = url.searchParams.get("v") || "";
      target = url.searchParams.get("u") || "";
      name = url.searchParams.get("n") || "media";
      audioOnly = url.searchParams.get("a") === "1";
    }

    if (!target) {
      if (!videoId) return new Response("missing target", { status: 400, headers: corsHeaders });
      const data = await pipedStreams(videoId);
      target = audioOnly ? pickAudio(data) : pickMuxedMp4(data);
    }

    return await proxyMedia(req, target, name);
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error)?.message || "download failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
