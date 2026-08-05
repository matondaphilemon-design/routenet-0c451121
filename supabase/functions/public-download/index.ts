import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveStream } from "../_shared/ytresolve.ts";

/**
 * Public media download proxy.
 * Resolves a YouTube video id to a real muxed MP4 / audio stream via Piped and
 * streams the bytes back with `content-disposition: attachment` so the browser
 * (or the app's download service) can save a real file. Bypasses CORS.
 */

const ALLOWED_HOSTS = [
  "googlevideo.com",
  "youtube.com",
  "ytimg.com",
  "nadeko.net",
  "nerdvpn.de",
  "yewtu.be",
  "f5.si",
  "ggtyler.dev",
  "leptons.xyz",
  "drgns.space",
  "piped.yt",
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
      const resolved = await resolveStream(videoId, audioOnly);
      console.log(`[public-download] ${videoId} resolved via ${resolved.source} (${resolved.mimeType})`);
      target = resolved.url;
    }

    return await proxyMedia(req, target, name);
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error)?.message || "download failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
