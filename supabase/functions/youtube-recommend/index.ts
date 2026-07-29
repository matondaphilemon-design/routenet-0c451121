// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const BASE = "https://www.googleapis.com/youtube/v3";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const genre = url.searchParams.get("genre")?.trim();
    const relatedTo = url.searchParams.get("relatedTo")?.trim();
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") ?? 15)));

    if (!YT_KEY) {
      return new Response(
        JSON.stringify({ error: "YOUTUBE_API_KEY not configured", tracks: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = "";
    if (genre) query = `top ${genre} songs ${new Date().getFullYear()}`;
    else if (relatedTo) query = `${relatedTo} similar artists music`;
    else {
      return new Response(
        JSON.stringify({ error: "Provide ?genre= or ?relatedTo=" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tracks = await ytSearch(query, limit);
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
