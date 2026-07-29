import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Try Lovable AI Gateway first, then direct Gemini, then xAI grok.
 * Returns the raw text content of the assistant message, or null if all failed.
 */
async function callAIWithFallback(systemPrompt: string, userPrompt: string): Promise<{ content: string; provider: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const XAI_API_KEY = Deno.env.get("XAI_API_KEY");

  // 1) Lovable AI Gateway
  if (LOVABLE_API_KEY) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.choices?.[0]?.message?.content;
        if (c) return { content: c, provider: "lovable" };
      } else {
        console.warn("lovable ai failed", r.status);
      }
    } catch (e) { console.warn("lovable ai error", e); }
  }

  // 2) Gemini direct
  if (GEMINI_API_KEY) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          }),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const c = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (c) return { content: c, provider: "gemini" };
      } else {
        console.warn("gemini direct failed", r.status);
      }
    } catch (e) { console.warn("gemini direct error", e); }
  }

  // 3) xAI grok
  if (XAI_API_KEY) {
    try {
      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${XAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "grok-2-latest",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.choices?.[0]?.message?.content;
        if (c) return { content: c, provider: "xai" };
      } else {
        console.warn("xai failed", r.status);
      }
    } catch (e) { console.warn("xai error", e); }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { artists, genres } = await req.json();
    if (!artists?.length && !genres?.length) {
      return new Response(JSON.stringify({ error: "artists or genres required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const topArtist = artists?.[0] || "popular artist";
    const artistList = (artists || []).join(", ");
    const genreList = (genres || []).join(", ");

    const prompt = `you are a music curation ai. given these user preferences:
favorite artists: ${artistList}
favorite genres: ${genreList}

generate exactly 15 personalized homepage sections. each section must be deeply personalized to these specific artists and genres. no generic content like "global top 50" or "billboard". do not mention "ai" or "experimental" in titles. write titles in natural human language, not robotic phrasing.

for each section return a json object with:
- id: unique string id
- title: section display name (lowercase, no emojis, sounds human)
- subtitle: short description
- layout: one of "hero_large", "horizontal_medium", "circular_artists", "wide_landscape", "grid_small"
- searchQueries: array of 1-3 deezer search queries that will find the right tracks/artists for this section
- contentType: "tracks" | "artists" | "albums"
- category: one of "new" | "hits" | "made_for_you" | "playlists" (used for the homepage 40/25/15/20 mix)

section distribution must be exactly: 6 "new" + 4 "hits" + 2 "made_for_you" + 3 "playlists" = 15 sections.
at least 50% of sections must have searchQueries that include one of the user's genres.

the 15 sections must be in this order, each tagged with the matching category:
1. [new] hero section featuring "${topArtist}"'s newest tracks
2. [new] brand new releases from user's artists (last 90 days)
3. [new] fresh drops in user's favorite genres
4. [hits] essential albums from user's artists
5. [hits] all-time hits from user's artists
6. [made_for_you] "because you like ${topArtist}" recommendations
7. [new] fresh collaborations and features
8. [hits] timeless classics in user's genres
9. [playlists] mood playlist: late night drive (in user's genres)
10. [playlists] mood playlist: gym energy (in user's genres)
11. [new] hidden new gems from user's artists
12. [hits] throwback hits in user's genres
13. [made_for_you] similar artists the user might not know
14. [playlists] curated mix matching user's vibe
15. [new] personalized radio of newest tracks

return ONLY valid json array. no markdown, no explanation.`;

    const ai = await callAIWithFallback(
      "you are a music curation ai. return only valid json. no markdown fences. no explanation text. lowercase text only. no emojis.",
      prompt
    );

    if (!ai) {
      return new Response(JSON.stringify({ error: "all_providers_failed", fallback: true, sections: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let content = ai.content || "";
    
    // Strip markdown fences if present
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    
    let sections;
    try {
      sections = JSON.parse(content);
    } catch {
      // Try to extract JSON array
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        sections = JSON.parse(match[0]);
      } else {
        throw new Error("failed to parse ai response as json");
      }
    }

    return new Response(JSON.stringify({ sections, provider: ai.provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("personalized-homepage error:", e);
    const message = e instanceof Error ? e.message : "unknown error";
    const normalizedError = message.toLowerCase().includes("rate limited") ? "rate_limited" : message;
    return new Response(JSON.stringify({ error: normalizedError, fallback: true, sections: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
