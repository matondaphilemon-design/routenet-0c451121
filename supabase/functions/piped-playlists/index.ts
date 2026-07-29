// deno-lint-ignore-file no-explicit-any
// Piped (YouTube) playlist discovery.
//   GET ?q=<query>&limit=<n>       -> candidate playlists
//   GET ?playlistId=<id>&limit=<n> -> tracks inside a playlist
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.tokhmi.xyz",
  "https://pipedapi.syncpundit.io",
  "https://api-piped.mha.fi",
  "https://piped-api.garudalinux.org",
  "https://pipedapi.rivo.lol",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.qdi.fi",
  "https://api.piped.private.coffee",
];

const INVIDIOUS_INSTANCES = [
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://inv.nadeko.net",
];

function vid(url: string | undefined): string {
  if (!url) return "";
  return url.split("v=")[1]?.split("&")[0] ?? url.replace("/watch?v=", "");
}
function plid(url: string | undefined): string {
  if (!url) return "";
  return url.split("list=")[1]?.split("&")[0] ?? "";
}

async function racePiped<T>(fn: (base: string) => Promise<T>): Promise<T | null> {
  try {
    return await Promise.any(PIPED_INSTANCES.map(fn));
  } catch {
    return null;
  }
}

async function searchPlaylists(q: string, limit: number) {
  const viaPiped = await racePiped(async (base) => {
    const res = await fetch(
      `${base}/search?q=${encodeURIComponent(q)}&filter=playlists`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const items = (j?.items || []).filter((i: any) => plid(i.url));
    if (!items.length) throw new Error("empty");
    return items.slice(0, limit).map((i: any) => ({
      id: plid(i.url),
      title: i.name || i.title || "",
      uploader: i.uploaderName || i.uploader || "",
      uploaderVerified: !!i.uploaderVerified,
      videos: i.videos ?? i.videoCount ?? 0,
      thumbnail: i.thumbnail || "",
      source: "piped",
    }));
  });
  if (viaPiped?.length) return viaPiped;

  // Invidious fallback
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(
        `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=playlist`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) continue;
      const j = await res.json();
      const items = (Array.isArray(j) ? j : []).filter((i: any) => i.playlistId);
      if (!items.length) continue;
      return items.slice(0, limit).map((i: any) => ({
        id: i.playlistId,
        title: i.title || "",
        uploader: i.author || "",
        uploaderVerified: !!i.authorVerified,
        videos: i.videoCount ?? 0,
        thumbnail: i.playlistThumbnail || i.videos?.[0]?.videoThumbnails?.[0]?.url || "",
        source: "invidious",
      }));
    } catch { /* next */ }
  }
  return [];
}

async function playlistTracks(id: string, limit: number) {
  const viaPiped = await racePiped(async (base) => {
    const res = await fetch(`${base}/playlists/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const items = j?.relatedStreams || [];
    if (!items.length) throw new Error("empty");
    return {
      name: j?.name ?? "",
      uploader: j?.uploader ?? "",
      thumbnail: j?.thumbnailUrl ?? "",
      tracks: items.slice(0, limit).map((s: any) => ({
        videoId: vid(s.url),
        title: s.title || "",
        artist: (s.uploaderName || "").replace(/\s*-\s*Topic$/i, ""),
        thumbnail: s.thumbnail || "",
        duration: s.duration || 0,
      })).filter((t: any) => t.videoId),
    };
  });
  if (viaPiped?.tracks?.length) return viaPiped;

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/playlists/${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const items = j?.videos || [];
      if (!items.length) continue;
      return {
        name: j?.title ?? "",
        uploader: j?.author ?? "",
        thumbnail: j?.playlistThumbnail ?? "",
        tracks: items.slice(0, limit).map((s: any) => ({
          videoId: s.videoId,
          title: s.title || "",
          artist: (s.author || "").replace(/\s*-\s*Topic$/i, ""),
          thumbnail: s.videoThumbnails?.[2]?.url || `https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`,
          duration: s.lengthSeconds || 0,
        })).filter((t: any) => t.videoId),
      };
    } catch { /* next */ }
  }
  return { name: "", uploader: "", thumbnail: "", tracks: [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    let q = url.searchParams.get("q") ?? "";
    let playlistId = url.searchParams.get("playlistId") ?? "";
    let limit = Number(url.searchParams.get("limit") ?? 0);

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      q = body.q ?? q;
      playlistId = body.playlistId ?? playlistId;
      limit = Number(body.limit ?? limit);
    }

    if (playlistId) {
      const data = await playlistTracks(playlistId, Math.min(Math.max(limit || 50, 1), 100));
      return json(data);
    }
    if (q.trim().length < 2) return json({ error: "q or playlistId required" }, 400);

    const playlists = await searchPlaylists(q.trim(), Math.min(Math.max(limit || 12, 1), 30));
    return json({ playlists });
  } catch (e) {
    return json({ error: String(e), playlists: [], tracks: [] }, 200);
  }
});
