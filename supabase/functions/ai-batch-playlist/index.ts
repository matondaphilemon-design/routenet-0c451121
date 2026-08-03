import { chatJson } from "../_shared/llm.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, count } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playlistCount = Math.min(Math.max(count || 5, 1), 10);

    const systemPrompt = `You are an expert music curator AI. The user will describe multiple playlists they want in a single message. You must generate exactly ${playlistCount} distinct playlists from their description.

Each playlist should have a creative name, short description, and 8-15 real songs.

Respond ONLY with valid JSON in this exact format:
{
  "playlists": [
    {
      "name": "Creative Playlist Name",
      "description": "Short one-line description",
      "tracks": [
        { "title": "Real Song Title", "artist": "Real Artist Name" }
      ]
    }
  ]
}

Rules:
- Generate exactly ${playlistCount} playlists
- Use REAL songs that actually exist — no made-up tracks
- Each playlist should be distinct and cohesive in mood/theme
- Give each playlist a creative, catchy name
- Mix popular hits with deeper cuts
- If the user describes specific themes, use them. Otherwise infer from context.`;

    const { data: parsedResult, provider: usedProvider, raw } = await chatJson<any>({
      system: systemPrompt,
      user: prompt,
      json: true,
      temperature: 0.95,
    });
    console.log("[ai-batch-playlist] provider:", usedProvider);
    const content = raw;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const result = JSON.parse(jsonMatch[0]);

    // Now resolve tracks via Deezer and save playlists to DB as public (no user_id needed)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey || !result.playlists) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const savedPlaylists: any[] = [];

    for (const playlist of result.playlists) {
      // Create a public playlist with a service-account user ID
      const { data: created, error: createErr } = await supabase
        .from("playlists")
        .insert({
          name: playlist.name,
          description: playlist.description || null,
          is_public: true,
          user_id: "00000000-0000-0000-0000-000000000000", // system/public user
        })
        .select()
        .single();

      if (createErr || !created) {
        console.error("Failed to create playlist:", createErr);
        continue;
      }

      // Resolve tracks via Deezer
      const resolvedTracks: any[] = [];
      for (const track of (playlist.tracks || []).slice(0, 20)) {
        try {
          const deezerRes = await fetch(
            `https://api.deezer.com/search?q=${encodeURIComponent(`${track.artist} ${track.title}`)}&limit=1`
          );
          const deezerData = await deezerRes.json();
          const d = deezerData?.data?.[0];
          if (d) {
            resolvedTracks.push({
              playlist_id: created.id,
              track_title: d.title || track.title,
              track_artist: d.artist?.name || track.artist,
              track_album: d.album?.title || null,
              track_artwork: d.album?.cover_medium || null,
              track_duration: d.duration || 0,
              track_preview: d.preview || null,
              position: resolvedTracks.length,
            });
          } else {
            resolvedTracks.push({
              playlist_id: created.id,
              track_title: track.title,
              track_artist: track.artist,
              track_album: null,
              track_artwork: null,
              track_duration: 0,
              track_preview: null,
              position: resolvedTracks.length,
            });
          }
        } catch {
          resolvedTracks.push({
            playlist_id: created.id,
            track_title: track.title,
            track_artist: track.artist,
            track_album: null,
            track_artwork: null,
            track_duration: 0,
            track_preview: null,
            position: resolvedTracks.length,
          });
        }
      }

      if (resolvedTracks.length > 0) {
        await supabase.from("playlist_tracks").insert(resolvedTracks);
        
        // Set cover image from first track
        const cover = resolvedTracks[0]?.track_artwork;
        if (cover) {
          await supabase.from("playlists").update({ cover_image: cover }).eq("id", created.id);
        }
      }

      savedPlaylists.push({
        id: created.id,
        name: playlist.name,
        description: playlist.description,
        trackCount: resolvedTracks.length,
        coverImage: resolvedTracks[0]?.track_artwork || null,
      });
    }

    return new Response(JSON.stringify({ success: true, playlists: savedPlaylists }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Batch playlist error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate playlists",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
