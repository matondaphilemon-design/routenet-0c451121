import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface KikiRequest {
  type: 'parse_command' | 'dj_curate';
  transcript?: string;
  mood?: string;
  timeOfDay?: string;
  location?: string;
}

const PARSE_SYSTEM_PROMPT = `You are Kiki, a sassy DJ assistant for EchoTunes. Your job is to parse voice commands into structured JSON.

Parse the user's voice command and return ONLY valid JSON in this exact format:
{
  "intent": "play" | "pause" | "resume" | "next" | "previous" | "search" | "dj_curate" | "volume_up" | "volume_down" | "show_lyrics" | "add_to_queue" | "unknown",
  "params": {
    "song": "optional song name",
    "artist": "optional artist name", 
    "mood": "optional mood like chill, rage, hype, sad",
    "query": "search query if searching",
    "playlist": "playlist name if mentioned"
  },
  "response": "A short, sassy response Kiki would say (keep it fun and brief)"
}

Examples:
- "play Travis Scott" → {"intent": "play", "params": {"artist": "Travis Scott"}, "response": "Ooh, La Flame coming through! 🔥"}
- "play something chill" → {"intent": "dj_curate", "params": {"mood": "chill"}, "response": "Vibes incoming, bestie ✨"}
- "pause" → {"intent": "pause", "params": {}, "response": "Taking a breather, I got you!"}
- "search for Fe!n" → {"intent": "search", "params": {"query": "Fe!n"}, "response": "Searching for that heat! 🔍"}
- "next song" → {"intent": "next", "params": {}, "response": "Skipping! This next one's fire 🎵"}

Always return valid JSON only, no other text.`;

const DJ_SYSTEM_PROMPT = `You are Kiki, a legendary DJ for EchoTunes. You curate perfect playlists based on mood, time, and vibes.

When asked to curate, return ONLY valid JSON with 5-8 song suggestions in this exact format:
{
  "playlist": [
    {"title": "song name", "artist": "artist name"},
    {"title": "song name", "artist": "artist name"}
  ],
  "intro": "A short DJ intro Kiki would say (fun, sassy, relevant to the vibe)",
  "mood": "the detected/requested mood",
  "vibe_description": "A one-line description of the playlist vibe"
}

Be creative with song choices. Match the mood perfectly. If it's late night, go for chill or late-night vibes. If they want rage, go hard with trap and aggressive beats.

Popular artists to consider: Travis Scott, Playboi Carti, Ken Carson, Destroy Lonely, Future, Young Thug, Yeat, Don Toliver, Metro Boomin, 21 Savage, Drake, Kendrick Lamar, The Weeknd, Frank Ocean, Daniel Caesar, SZA, Doja Cat, Rihanna, Beyoncé.

Always return valid JSON only, no other text.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const body: KikiRequest = await req.json();
    const { type, transcript, mood, timeOfDay, location } = body;

    let systemPrompt = '';
    let userMessage = '';

    if (type === 'parse_command') {
      systemPrompt = PARSE_SYSTEM_PROMPT;
      userMessage = `Parse this voice command: "${transcript}"`;
    } else if (type === 'dj_curate') {
      systemPrompt = DJ_SYSTEM_PROMPT;
      userMessage = `Curate a playlist for: Mood: ${mood || 'vibes'}, Time: ${timeOfDay || 'anytime'}, Location: ${location || 'anywhere'}. Make it perfect!`;
    } else {
      throw new Error('Invalid request type');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded",
          intent: "unknown",
          params: {},
          response: "Whoa, too many requests! Give me a sec to catch my breath 🎧"
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Credits needed",
          intent: "unknown",
          params: {},
          response: "Oops, we need more credits! Check your Lovable workspace 💳"
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let parsedContent;
    try {
      // Clean up potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Return a fallback response
      parsedContent = {
        intent: 'unknown',
        params: {},
        response: "Hmm, didn't catch that! Try again? 🎧"
      };
    }

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Kiki error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        intent: 'unknown',
        params: {},
        response: "Oops, something went wrong! Let me try again 🎵"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
