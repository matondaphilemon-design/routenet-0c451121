// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const BASE = "https://www.googleapis.com/youtube/v3";
const PIPED_INSTANCES = [
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
  "https://vid.puffyan.us",
];

interface Track {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

async function ytSearch(q: string, max = 15): Promise<Track[]> {
  if (!YT_KEY) return [];
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10"); // Music
  url.searchParams.set("maxResults", String(max));
  url.searchParams.set("q", q);
  url.searchParams.set("key", YT_KEY);
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.items || []).map((it: any) => ({
    videoId: it.id?.videoId,
    title: it.snippet?.title ?? "",
    channel: it.snippet?.channelTitle ?? "",
    thumbnail:
      it.snippet?.thumbnails?.high?.url ??
      it.snippet?.thumbnails?.medium?.url ??
      it.snippet?.thumbnails?.default?.url ??
      "",
  })).filter((t: Track) => t.videoId);
}

async function pipedSearch(q: string, max = 15): Promise<Track[]> {
  const tryOne = async (instance: string) => {
    const res = await fetch(
      `${instance}/search?q=${encodeURIComponent(q)}&filter=videos`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`${instance} ${res.status}`);
    const j = await res.json();
    if (!Array.isArray(j?.items) || j.items.length === 0) throw new Error(`${instance} empty`);

    return j.items.slice(0, max).map((item: any) => {
      const videoId = item.url?.split("v=")[1]?.split("&")[0] || item.url?.replace("/watch?v=", "");
      return {
        videoId,
        title: item.title ?? "",
        channel: item.uploaderName ?? item.uploader ?? "",
        thumbnail: item.thumbnail ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
      };
    }).filter((t: Track) => t.videoId);
  };

  try {
    return await Promise.any(PIPED_INSTANCES.map(tryOne));
  } catch {
    return [];
  }
}

async function invidiousSearch(q: string, max = 15): Promise<Track[]> {
  const tryOne = async (instance: string) => {
    const params = new URLSearchParams({ q, type: "video", sort_by: "relevance" });
    const res = await fetch(`${instance}/api/v1/search?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`${instance} ${res.status}`);
    const j = await res.json();
    if (!Array.isArray(j) || j.length === 0) throw new Error(`${instance} empty`);

    return j.filter((item: any) => item.type === "video").slice(0, max).map((item: any) => ({
      videoId: item.videoId,
      title: item.title ?? "",
      channel: item.author ?? "",
      thumbnail: item.videoThumbnails?.[3]?.url ?? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
    })).filter((t: Track) => t.videoId);
  };

  try {
    return await Promise.any(INVIDIOUS_INSTANCES.map(tryOne));
  } catch {
    return [];
  }
}

async function searchTracks(query: string, limit: number): Promise<Track[]> {
  const apiTracks = await ytSearch(query, limit);
  if (apiTracks.length > 0) return apiTracks;

  const fallbackQuery = `${query} official music`;
  const pipedTracks = await pipedSearch(fallbackQuery, limit);
  if (pipedTracks.length > 0) return pipedTracks;

  return invidiousSearch(fallbackQuery, limit);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const genre = url.searchParams.get("genre")?.trim();
    const relatedTo = url.searchParams.get("relatedTo")?.trim();
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") ?? 15)));

    let query = "";
    if (genre) query = `top ${genre} songs ${new Date().getFullYear()}`;
    else if (relatedTo) query = `${relatedTo} similar artists music`;
    else {
      return new Response(
        JSON.stringify({ error: "Provide ?genre= or ?relatedTo=" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tracks = await searchTracks(query, limit);
    return new Response(JSON.stringify({ tracks }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e), tracks: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
