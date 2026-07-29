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

    let apiUrl: string;
    let apiKey: string;
    let model: string;
    let headers: Record<string, string>;

    if (provider === "xai") {
      apiKey = Deno.env.get("XAI_API_KEY") || "";
      if (!apiKey) throw new Error("XAI_API_KEY not configured");
      apiUrl = "https://api.x.ai/v1/chat/completions";
      model = "grok-3-mini-fast";
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
    } else {
      // Default: Gemini via Lovable gateway
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = "google/gemini-3-flash-preview";
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI error (${provider}):`, response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No response from AI");

    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const result = JSON.parse(jsonMatch[0]);

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
