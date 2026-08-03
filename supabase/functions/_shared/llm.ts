/**
 * Shared LLM helper with a 3-provider fallback chain:
 *   1. Lovable AI Gateway   (LOVABLE_API_KEY)
 *   2. Google Gemini direct (GEMINI_API_KEY)
 *   3. OpenRouter           (OPENROUTER_API_KEY)
 *
 * Every provider is tried in order until one returns text. This keeps the
 * app's AI engine (recommendations, playlists, DJ, sections) working even when
 * the Lovable gateway is rate-limited or out of credits.
 */

export interface ChatOptions {
  system: string;
  user: string;
  /** Ask providers for a strict JSON object response. Default true. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Preferred Lovable-gateway model. */
  gatewayModel?: string;
  /** Preferred Gemini model (direct API). */
  geminiModel?: string;
  /** Preferred OpenRouter model. */
  openRouterModel?: string;
}

export interface ChatResult {
  text: string;
  provider: "lovable" | "gemini" | "openrouter";
}

export class LlmUnavailableError extends Error {
  reason: string;
  details: string[];
  constructor(reason: string, details: string[]) {
    super(`llm_unavailable: ${reason}`);
    this.reason = reason;
    this.details = details;
  }
}

const DEFAULTS = {
  gatewayModel: "google/gemini-3.6-flash",
  geminiModel: "gemini-2.5-flash",
  openRouterModel: "google/gemini-2.5-flash",
};

async function callLovable(o: ChatOptions): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: o.gatewayModel || DEFAULTS.gatewayModel,
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.user },
      ],
      ...(o.json === false ? {} : { response_format: { type: "json_object" } }),
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`lovable ${r.status}: ${body.slice(0, 300)}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

async function callGemini(o: ChatOptions): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const model = o.geminiModel || DEFAULTS.geminiModel;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: o.system }] },
        contents: [{ role: "user", parts: [{ text: o.user }] }],
        generationConfig: {
          ...(o.temperature != null ? { temperature: o.temperature } : {}),
          ...(o.maxOutputTokens ? { maxOutputTokens: o.maxOutputTokens } : {}),
          ...(o.json === false ? {} : { responseMimeType: "application/json" }),
        },
      }),
    },
  );
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`gemini ${r.status}: ${body.slice(0, 300)}`);
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p: { text?: string }) => p?.text ?? "").join("");
  return text || null;
}

async function callOpenRouter(o: ChatOptions): Promise<string | null> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return null;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://routenet.lovable.app",
      "X-Title": "RouteNet Music",
    },
    body: JSON.stringify({
      model: o.openRouterModel || DEFAULTS.openRouterModel,
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.user },
      ],
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      ...(o.json === false ? {} : { response_format: { type: "json_object" } }),
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`openrouter ${r.status}: ${body.slice(0, 300)}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

/**
 * Runs the prompt through the provider chain and returns the first non-empty
 * completion. Throws `LlmUnavailableError` when every provider failed.
 */
export async function chatComplete(o: ChatOptions): Promise<ChatResult> {
  const providers: Array<[ChatResult["provider"], (x: ChatOptions) => Promise<string | null>]> = [
    ["lovable", callLovable],
    ["gemini", callGemini],
    ["openrouter", callOpenRouter],
  ];

  const errors: string[] = [];
  let sawQuota = false;

  for (const [name, fn] of providers) {
    try {
      const text = await fn(o);
      if (text && text.trim()) {
        if (name !== "lovable") console.log(`[llm] served by fallback provider: ${name}`);
        return { text, provider: name };
      }
      if (text === null) errors.push(`${name}: not configured`);
      else errors.push(`${name}: empty response`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/\b(402|429)\b|quota|rate limit|insufficient/i.test(msg)) sawQuota = true;
      console.error(`[llm] ${msg}`);
      errors.push(msg);
    }
  }

  throw new LlmUnavailableError(sawQuota ? "quota_exhausted" : "all_providers_failed", errors);
}

/** Parses a JSON object out of a model completion, tolerating prose wrappers. */
export function parseJsonLoose<T = Record<string, unknown>>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]) as T; } catch { /* ignore */ }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) as T; } catch { /* ignore */ }
  }
  const as = text.indexOf("[");
  const ae = text.lastIndexOf("]");
  if (as !== -1 && ae > as) {
    try { return JSON.parse(text.slice(as, ae + 1)) as T; } catch { /* ignore */ }
  }
  return null;
}

/** Convenience: prompt -> parsed JSON object (or null when unparseable). */
export async function chatJson<T = Record<string, unknown>>(
  o: ChatOptions,
): Promise<{ data: T | null; provider: ChatResult["provider"]; raw: string }> {
  const res = await chatComplete(o);
  return { data: parseJsonLoose<T>(res.text), provider: res.provider, raw: res.text };
}
