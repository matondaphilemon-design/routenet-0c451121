import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, provider } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert music curator. Given a user's request, generate a playlist of songs. The user may specify the number of songs they want - follow their instructions. If no count is specified, generate between 5 and 30 songs (pick a random appropriate number for the vibe).

Respond ONLY with valid JSON in this exact format:
{
  "name": "Playlist name (creative, catchy)",
  "description": "One short sentence",
  "tracks": [
    { "title": "Song Title", "artist": "Artist Name" },
    ...
  ]
}

Rules:
- Use real, well-known songs that actually exist
- Match the mood/genre/era the user describes
- Mix popular hits with deeper cuts for variety
- Keep the playlist cohesive in mood
- The playlist name should be creative, not just repeat the prompt
- There is NO limit on how many songs you can include`;

    const { data: result, provider: usedProvider } = await chatJson<any>({
      system: systemPrompt,
      user: prompt,
      json: true,
      temperature: 0.9,
    });
    if (!result) throw new Error("No parseable response from AI");
    console.log("[ai-playlist] provider:", usedProvider);


    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI Playlist error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate playlist",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
