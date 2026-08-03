// AI recommendation engine — returns ~50 song suggestions given a seed track
// and recent user taste signals. Model output is title/artist pairs that the
// client resolves via the existing `deezer` edge function.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chatJson, LlmUnavailableError } from "../_shared/llm.ts";


interface Signal { type: string; title?: string; artist?: string; genre?: string; weight?: number }
interface Body {
  seed?: { title: string; artist: string; genre?: string } | null;
  signals?: Signal[];
  followedArtists?: string[];
  excludeTitles?: string[];
  distribution?: Record<string, number>;
  count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const count = Math.max(10, Math.min(60, body.count ?? 50));
    const seed = body.seed;
    const signals = (body.signals ?? []).slice(0, 40);
    const followed = (body.followedArtists ?? []).slice(0, 30);
    const exclude = (body.excludeTitles ?? []).slice(0, 60);

    const signalSummary = signals
      .map((s) => `- ${s.type}: ${s.artist ?? ""}${s.title ? ` — ${s.title}` : ""}${s.genre ? ` [${s.genre}]` : ""}${s.weight ? ` (w=${s.weight})` : ""}`)
      .join("\n");

    const system = `You are a world-class music curator building a continuous listening session (like a great radio DJ).

Return exactly ${count} real, existing songs as JSON. Each item MUST have:
  "title"  – the exact released song title
  "artist" – the exact primary artist name
  "role"   – one of: related | trending | recent | fanfav | classic | hidden
  "reason" – max 12 words

Role distribution (approximate, across the whole list):
  related 30% (same sound / mood / BPM / production as the seed and taste)
  trending 20% (popular right now)
  recent 15% (released in the last 18 months)
  fanfav 15% (signature, most-loved songs of related artists)
  classic 10% (older essentials that still fit)
  hidden 10% (lesser-known gems that fit the taste)

Hard rules:
- Never repeat the seed or any excluded title.
- Maximum 2 songs per artist, and at least 12 DIFFERENT artists overall.
- Only real songs that exist on streaming services. No mixes, edits, karaoke, covers, sped-up or AI versions.
- Return ONLY valid JSON, no prose.`;

    const user = `SEED: ${seed ? `${seed.title} — ${seed.artist}${seed.genre ? ` (${seed.genre})` : ""}` : "(none — use signals)"}

FOLLOWED ARTISTS:
${followed.map((a) => `- ${a}`).join("\n") || "(none)"}

RECENT SIGNALS:
${signalSummary || "(none)"}

EXCLUDE (already known):
${exclude.map((t) => `- ${t}`).join("\n") || "(none)"}

Return a JSON object: { "tracks": [{ "title": string, "artist": string, "role": string, "reason": string }] } with exactly ${count} items.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("gateway error", r.status, text);
      // Soft-fail on quota/rate-limit so the app degrades gracefully
      // instead of surfacing a runtime error / blank screen.
      if (r.status === 402 || r.status === 429) {
        return json({ tracks: [], unavailable: true, reason: r.status === 402 ? "insufficient_credits" : "rate_limited" });
      }
      return json({ tracks: [], error: "gateway_error", status: r.status, details: text });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = extractJson(content) ?? {}; }
    const tracks = Array.isArray(parsed?.tracks) ? parsed.tracks : [];
    const cleaned = tracks
      .map((t: any) => ({
        title: String(t?.title ?? "").trim(),
        artist: String(t?.artist ?? "").trim(),
        role: String(t?.role ?? "related").trim().toLowerCase().slice(0, 20),
        reason: String(t?.reason ?? "").trim().slice(0, 140),
      }))
      .filter((t: any) => t.title && t.artist);

    return json({ tracks: cleaned });
  } catch (e) {
    console.error(e);
    return json({ error: "internal", message: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}
