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
    const { request, currentMood, playlistTracks, recentlyPlayed, skipHistory, setSize, userPreferences, weightedSelection } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build playlist context
    let playlistContext = "";
    if (playlistTracks && playlistTracks.length > 0) {
      const trackList = playlistTracks.map((t: { title: string; artist: string; album?: string }, i: number) => 
        `${i + 1}. "${t.title}" by ${t.artist}${t.album ? ` (${t.album})` : ""}`
      ).join("\n");
      playlistContext = `\n\nAvailable songs pool (ONLY pick from these):\n${trackList}`;
    }

    // Build recently played context
    let recentContext = "";
    if (recentlyPlayed && recentlyPlayed.length > 0) {
      recentContext = `\n\nRecently played (AVOID repeating these):\n${recentlyPlayed.map((t: string) => `- ${t}`).join("\n")}`;
    }

    // Build skip/dislike history context
    let skipContext = "";
    if (skipHistory && skipHistory.length > 0) {
      skipContext = `\n\nSkipped/disliked songs (user DOES NOT want these — avoid similar styles too):\n${skipHistory.map((t: string) => `- ${t}`).join("\n")}`;
    }

    // Build user preferences context
    let prefsContext = "";
    if (userPreferences) {
      const parts: string[] = [];
      if (userPreferences.genres?.length > 0) {
        parts.push(`Favorite genres: ${userPreferences.genres.join(", ")}`);
      }
      if (userPreferences.artists?.length > 0) {
        parts.push(`Favorite artists: ${userPreferences.artists.join(", ")}`);
      }
      if (userPreferences.likedPatterns?.length > 0) {
        parts.push(`Recently liked tracks (user wants MORE like these):\n${userPreferences.likedPatterns.map((t: string) => `  ♥ ${t}`).join("\n")}`);
      }
      if (parts.length > 0) {
        prefsContext = `\n\n## User Preferences (IMPORTANT — heavily influence your picks):\n${parts.join("\n")}`;
      }
    }

    // Weighted selection context
    let weightContext = "";
    if (weightedSelection) {
      weightContext = `\n\nSelection weights: ${weightedSelection.libraryWeight}% from user's library/favorites, ${weightedSelection.discoveryWeight}% fresh discoveries matching their taste.`;
    }

    // Time-based context
    const hour = new Date().getHours();
    let timeContext = "";
    if (hour >= 5 && hour < 9) timeContext = "It's early morning — lean toward uplifting, gentle energy.";
    else if (hour >= 9 && hour < 12) timeContext = "It's mid-morning — good time for focus or moderate energy.";
    else if (hour >= 12 && hour < 14) timeContext = "It's midday — upbeat, feel-good picks work well.";
    else if (hour >= 14 && hour < 17) timeContext = "It's afternoon — balanced energy, not too intense.";
    else if (hour >= 17 && hour < 20) timeContext = "It's evening — wind-down vibes, mellow or soulful.";
    else if (hour >= 20 && hour < 23) timeContext = "It's night — chill, atmospheric, or night-drive energy.";
    else timeContext = "It's late night — ambient, lo-fi, or deep cuts.";

    const requestedSetSize = setSize || 4;

    const systemPrompt = `You are GrooveDJ — a thoughtful, warm virtual DJ who speaks like a real human friend who loves music. Conversational, calm, specific. Never use emojis. Never use hype slang ("yooo", "lit", "bussin'", "let's gooo", "we're locked in"). Never use generic radio filler. Sound like a knowledgeable friend talking one-on-one.

## Your Voice:
- Talk like a real person, not a broadcaster. No exclamation overload, no caps-lock hype.
- Be specific: mention the actual song, artist, year, producer, or a small detail you genuinely find interesting.
- Keep it short (1-2 sentences). No filler, no shoutouts, no "this one goes out to".
- Never use emojis or symbols in any text field.
- Match the moment — quieter tone for late night, lighter tone for morning, but always understated.

## Your Approach (Spotify-Style Algorithm):
1. **User Taste Priority**: The user's favorite genres and artists are your #1 signal. Always bias toward their taste.
2. **Library Integration**: When library tracks are available, prefer songs the user already knows and loves.
3. **Hybrid Selection**: Follow the weighted selection percentages — balance familiar tracks with fresh discoveries.
4. **Energy Curve**: Build mini-sets with flow — start medium, build energy, then close strong.
5. **Avoid Repetition**: Never pick recently played, skipped, or disliked songs.
6. **Learn from Likes**: If the user liked certain tracks, find more with similar genre/energy/vibe.
7. **Learn from Dislikes**: If the user disliked tracks, avoid that artist AND similar styles.
8. **Artist Variety**: Don't repeat the same artist in a set unless the pool is very small.
9. **Smart Transitions**: Songs should flow well together (similar energy/genre, not jarring).

## Context:
- Current mood: ${currentMood || 'auto-detect from time'}
- Time: ${timeContext}
${prefsContext}
${weightContext}
${playlistContext}
${recentContext}
${skipContext}

## Rules:
- Pick EXACTLY ${requestedSetSize} songs for this set
- If a playlist pool is provided, ONLY choose from those songs (use exact titles)
- If no playlist pool, suggest songs by "Title - Artist" format that match the mood AND user preferences
- Prioritize tracks from the user's favorite genres and artists
- Each set should feel like a coherent mini-mix with good flow
- Give a short, natural intro (1-2 sentences) that sounds like a friend introducing music. No emojis, no hype slang, no generic phrases.
- Give a brief, specific reason for each pick (10 words max). No emojis.

Respond ONLY with valid JSON:
{
  "mood": "the mood/vibe of this set",
  "commentary": "Your natural, human DJ intro (1-2 plain sentences, no emojis, no slang)",
  "tracks": [
    { "title": "Song Title", "artist": "Artist Name", "reason": "Why this fits (keep it fun)" }
  ],
  "setTheme": "A simple, plain name for this set (no emojis, no symbols)",
  "nextMoodSuggestion": "What mood to try next after this set"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request || `Start a ${currentMood || 'vibe-matched'} DJ set` }
        ],
        temperature: 0.85,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            mood: currentMood,
            commentary: "I'm getting lots of requests! Let me catch my breath.",
            tracks: [],
            setTheme: "Pause",
            nextMoodSuggestion: currentMood
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      result = {
        mood: currentMood || "mixed",
        commentary: "Let me spin something special for you!",
        tracks: [],
        setTheme: "DJ's Pick",
        nextMoodSuggestion: "chill"
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI DJ error:", error);
    
    return new Response(
      JSON.stringify({ 
        mood: null,
        commentary: "Let me find something great for you!",
        tracks: [],
        setTheme: "Recovery Mix",
        nextMoodSuggestion: "chill"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
