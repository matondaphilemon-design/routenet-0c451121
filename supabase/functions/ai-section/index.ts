import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract JSON {tracks:[{title,artist,reason?}]} from free-form text. */
function extractTracks(content: string): { title: string; artist: string; reason?: string }[] {
  if (!content) return [];
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  // Try whole-string parse first
  try {
    const obj = JSON.parse(cleaned);
    if (Array.isArray(obj?.tracks)) return obj.tracks;
    if (Array.isArray(obj)) return obj;
  } catch {}
  // Try to find an object with tracks array
  const objMatch = cleaned.match(/\{[\s\S]*"tracks"[\s\S]*\}/);
  if (objMatch) {
    try { const p = JSON.parse(objMatch[0]); if (Array.isArray(p?.tracks)) return p.tracks; } catch {}
  }
  // Try to find a bare array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { const p = JSON.parse(arrMatch[0]); if (Array.isArray(p)) return p; } catch {}
  }
  return [];
}

async function callViaGeminiDirect(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const KEY = Deno.env.get("GEMINI_API_KEY");
  if (!KEY) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!r.ok) { console.warn("gemini direct ai-section failed", r.status); return null; }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) { console.warn("gemini direct ai-section error", e); return null; }
}

async function callViaXai(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const KEY = Deno.env.get("XAI_API_KEY");
  if (!KEY) return null;
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) { console.warn("xai ai-section failed", r.status); return null; }
    const d = await r.json();
    return d.choices?.[0]?.message?.content || null;
  } catch (e) { console.warn("xai ai-section error", e); return null; }
}

/**
 * Generate 15 song suggestions for a homepage section.
 * Body: { section: { id, title, aiRule, contentType }, user: { artists, genres, location, ageRange, name } }
 * Returns: { tracks: [{ title, artist, reason }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { section, user, excludeIds } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    const artists = (user?.artists || []).map((a: any) => a?.name || a).filter(Boolean).join(", ") || "popular artists";
    const genres = (user?.genres || []).map((g: any) => g?.name || g).filter(Boolean).join(", ") || "top genres";
    const location = user?.location || "global";
    const ageRange = user?.ageRange || "any";

    const exclusionHint = Array.isArray(excludeIds) && excludeIds.length > 0
      ? `\nDo NOT suggest these songs (already shown elsewhere): ${excludeIds.slice(0, 50).join(", ")}.`
      : "";
    const isAlbum = section.contentType === "album";
    const count = section.id === "dailyMix" ? "between 25 and 50" : (isAlbum ? "exactly 12" : "exactly 15");
    const itemKind = isAlbum ? "real existing albums (return album title as title and main artist as artist)" : "real existing songs";
    const prompt = `You are a music curator. Curate the section "${section.title}" with this rule: "${section.aiRule}".
User profile: artists=[${artists}], genres=[${genres}], location=${location}, ageRange=${ageRange}.
Return ${count} ${itemKind}. Mix popular hits with some discoveries. If the rule says "new", prefer 2024-2025 releases. Do not repeat the same artist more than twice.${exclusionHint}`;

    const systemPrompt = "You return structured music curation data as JSON: { \"tracks\": [{ \"title\": string, \"artist\": string, \"reason\"?: string }] }. Return ONLY valid JSON, no markdown.";

    let tracks: { title: string; artist: string; reason?: string }[] = [];
    let provider = "none";

    // 1) Lovable AI Gateway (tool calling)
    if (apiKey) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You return structured music curation data via the suggest_tracks tool." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_tracks",
              description: "Return 15 song suggestions matching the section rule and user profile.",
              parameters: {
                type: "object",
                properties: {
                  tracks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        artist: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["title", "artist"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tracks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_tracks" } },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const call = data.choices?.[0]?.message?.tool_calls?.[0];
          if (call?.function?.arguments) {
            try { tracks = JSON.parse(call.function.arguments).tracks || []; } catch { tracks = []; }
          }
          if (tracks.length > 0) provider = "lovable";
        } else {
          console.warn("lovable ai-section non-ok", response.status);
        }
      } catch (e) { console.warn("lovable ai-section error", e); }
    }

    // 2) Gemini direct
    if (tracks.length === 0) {
      const text = await callViaGeminiDirect(systemPrompt, prompt);
      if (text) { tracks = extractTracks(text); if (tracks.length > 0) provider = "gemini"; }
    }

    // 3) xAI grok
    if (tracks.length === 0) {
      const text = await callViaXai(systemPrompt, prompt);
      if (text) { tracks = extractTracks(text); if (tracks.length > 0) provider = "xai"; }
    }

    return new Response(JSON.stringify({ tracks, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-section error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown", tracks: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});