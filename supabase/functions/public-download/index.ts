import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveStream, getVisitorData } from "../_shared/ytresolve.ts";

/**
 * Public media endpoint with four modes:
 *
 * - `?mode=visitor`  → mint a YouTube `visitorData` id for the browser
 * - `?mode=bgrelay`  → relay a BotGuard/JNN HTTP call the browser can't make (CORS)
 * - `?mode=resolve`  → return direct stream URLs + headers so the browser can fetch bytes itself
 * - default          → proxy the media bytes (range-aware fallback when the direct fetch fails)
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

/** Hosts the BotGuard relay may talk to. */
const BG_HOSTS = ["jnn-pa.googleapis.com", "www.youtube.com", "youtube.com"];

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function expectedUpstreamError(error: unknown) {
  const message = error instanceof Error ? error.message : "download failed";
  const blocked = /blocking this request|bot check|sign in|login_required/i.test(message);
  return json(
    {
      error: message,
      code: blocked ? "YOUTUBE_TEMPORARILY_BLOCKED" : "MEDIA_UNAVAILABLE",
      retryable: blocked,
    },
    // An upstream media miss is an expected, recoverable result. Returning a
    // 5xx makes the preview treat it as an Edge Function runtime crash.
    422,
  );
}

async function proxyMedia(request: Request, target: string, name: string, trusted = false) {
  let parsed: URL;
  try {
    // URLs we resolved server-side are trusted; only client-supplied ones are
    // restricted to the allowlist (SSRF guard).
    parsed = trusted ? new URL(target) : assertAllowedTarget(target);
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

/** Relay a BotGuard / JNN call on behalf of the browser. */
async function bgRelay(body: any) {
  const target = String(body?.url || "");
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: "bad url" }, 400);
  }
  if (parsed.protocol !== "https:" || !BG_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return json({ error: "unsupported relay host" }, 400);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json+protobuf",
    "x-goog-api-key": "AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw",
    "x-user-agent": "grpc-web-javascript/0.1",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  };

  const res = await fetch(parsed.toString(), {
    method: String(body?.method || "POST"),
    headers,
    body: typeof body?.body === "string" ? body.body : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  let parsedBody: unknown = text;
  try { parsedBody = JSON.parse(text); } catch { /* keep raw */ }
  return json({ status: res.status, body: parsedBody }, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "";

  try {
    if (mode === "visitor") {
      const visitorData = await getVisitorData();
      // Soft failure: 200 with a null value so the client can fall back
      // instead of surfacing a 502 runtime error.
      return json({ visitorData: visitorData ?? null });
    }


    if (mode === "bgrelay") {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "bad body" }, 400);
      return await bgRelay(body);
    }

    let videoId = "";
    let target = "";
    let name = "media";
    let audioOnly = false;
    let trusted = false;
    let poToken: string | undefined;
    let gvsPoToken: string | undefined;
    let visitorData: string | undefined;

    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as
        | { videoId?: string; url?: string; name?: string; audio?: boolean; poToken?: string; gvsPoToken?: string; visitorData?: string }
        | null;
      if (!body) return new Response("bad body", { status: 400, headers: corsHeaders });
      videoId = body.videoId || "";
      target = body.url || "";
      name = body.name || "media";
      audioOnly = !!body.audio;
      poToken = body.poToken;
      gvsPoToken = body.gvsPoToken;
      visitorData = body.visitorData;
    } else {
      videoId = url.searchParams.get("v") || "";
      target = url.searchParams.get("u") || "";
      name = url.searchParams.get("n") || "media";
      audioOnly = url.searchParams.get("a") === "1";
      poToken = url.searchParams.get("po") || undefined;
      gvsPoToken = url.searchParams.get("gpo") || undefined;
      visitorData = url.searchParams.get("vd") || undefined;
    }

    if (mode === "resolve") {
      if (!videoId) return json({ error: "missing videoId" }, 400);
      const resolved = await resolveStream(videoId, audioOnly, { poToken, gvsPoToken, visitorData });
      console.log(`[public-download] resolve ${videoId} via ${resolved.source}`);
      return json({
        url: resolved.url,
        mimeType: resolved.mimeType,
        source: resolved.source,
        alternatives: resolved.alternatives ?? [],
      });
    }

    if (!target) {
      if (!videoId) return new Response("missing target", { status: 400, headers: corsHeaders });
      const resolved = await resolveStream(videoId, audioOnly, { poToken, gvsPoToken, visitorData });
      console.log(`[public-download] ${videoId} resolved via ${resolved.source} (${resolved.mimeType})`);
      target = resolved.url;
      trusted = true;
    }

    return await proxyMedia(req, target, name, trusted);
  } catch (error) {
    console.warn("[public-download] media unavailable:", error instanceof Error ? error.message : error);
    return expectedUpstreamError(error);
  }
});
