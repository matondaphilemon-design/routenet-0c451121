import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, artist } = await req.json();

    if (!title || !artist) {
      return new Response(JSON.stringify({ error: "title and artist required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try lrclib FIRST (faster, supports synced lyrics)
    try {
      const lrclibRes = await fetch(
        `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(4000) }
      );

      if (lrclibRes.ok) {
        const lrcData = await lrclibRes.json();
        if (lrcData.syncedLyrics || lrcData.plainLyrics) {
          return new Response(JSON.stringify({
            lyrics: lrcData.plainLyrics || lrcData.syncedLyrics,
            syncedLyrics: lrcData.syncedLyrics || null,
            source: "lrclib",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        await lrclibRes.text();
      }
    } catch (_) { /* timeout, try fallback */ }

    // Fallback: lyrics.ovh
    try {
      const query = encodeURIComponent(artist) + "/" + encodeURIComponent(title);
      const lyricsRes = await fetch(`https://api.lyrics.ovh/v1/${query}`, {
        signal: AbortSignal.timeout(4000),
      });

      if (lyricsRes.ok) {
        const data = await lyricsRes.json();
        if (data.lyrics) {
          return new Response(JSON.stringify({ lyrics: data.lyrics, source: "lyrics.ovh" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        await lyricsRes.text();
      }
    } catch (_) { /* timeout */ }

    return new Response(JSON.stringify({ lyrics: null, error: "Lyrics not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
