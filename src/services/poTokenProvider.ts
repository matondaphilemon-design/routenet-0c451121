/**
 * Browser-side BotGuard PO token provider.
 *
 * YouTube blocks datacenter IPs, so the token is minted here — in the user's
 * real browser, with a real DOM and the user's own IP. The BotGuard VM runs
 * locally; only the two HTTP hops that lack CORS headers are relayed through
 * our edge function.
 *
 * Exposes `getPoToken()` which returns `{ poToken, visitorData }`, cached in
 * memory + localStorage with a TTL and refreshed automatically on expiry.
 */
import { BotGuardClient, getChallenge } from "bgutils-js/botguard";
import { WebPoMinter } from "bgutils-js/webpo";
import { buildURL, getHeaders } from "bgutils-js/utils";

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
const CACHE_KEY = "routenet_po_token_v4";
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h — YouTube's estimate is ~12h
const ENDPOINT = `${SUPABASE_URL}/functions/v1/public-download`;

export interface PoTokenBundle {
  /** Player token, content-bound to the requested video id. */
  poToken: string;
  /** Media token, content-bound to visitorData and added to GVS URLs. */
  gvsPoToken: string;
  visitorData: string;
  videoId: string;
  expiresAt: number;
}

let memory: PoTokenBundle | null = null;
let inFlight: Promise<PoTokenBundle | null> | null = null;

function readCache(videoId: string): PoTokenBundle | null {
  if (memory && memory.videoId === videoId && memory.expiresAt > Date.now()) return memory;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PoTokenBundle;
    if (parsed?.poToken && parsed?.gvsPoToken && parsed?.visitorData && parsed.videoId === videoId && parsed.expiresAt > Date.now()) {
      memory = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(bundle: PoTokenBundle) {
  memory = bundle;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(bundle)); } catch { /* quota */ }
}

/** Clear the cached token — call when YouTube rejects it. */
export function invalidatePoToken() {
  memory = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

async function edgeCall(path: string, body: unknown): Promise<Response> {
  return fetch(`${ENDPOINT}?mode=${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Fetch that tries the real endpoint first (some builds do send CORS headers)
 * and transparently relays through the edge function when the browser blocks
 * it. The BotGuard VM itself always runs locally.
 */
async function relayFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  try {
    const direct = await fetch(url, { ...init, mode: "cors" });
    if (direct.ok) return direct;
  } catch { /* CORS / network — fall through to the relay */ }

  const res = await edgeCall("bgrelay", {
    url,
    method: init?.method || "POST",
    headers: init?.headers || {},
    body: typeof init?.body === "string" ? init.body : undefined,
  });
  if (!res.ok) throw new Error(`bgrelay HTTP ${res.status}`);
  const payload = await res.json();
  return new Response(JSON.stringify(payload.body), {
    status: payload.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

/** Mint a visitor id. YouTube does not expose this endpoint with browser CORS. */
async function fetchVisitorData(): Promise<string | null> {
  // Prefer the listener's own network. This keeps visitorData and the
  // browser-minted proof bound to the same network identity when CORS allows.
  try {
    const direct = await fetch("https://www.youtube.com/sw.js_data", {
      mode: "cors",
      credentials: "include",
    });
    if (direct.ok) {
      const text = (await direct.text()).replace(/^\)\]\}'/, "");
      const match = text.match(/"(Cgt[A-Za-z0-9_\-%]{10,})"/);
      if (match?.[1]) return match[1];
    }
  } catch { /* YouTube may not advertise CORS; use the relay below. */ }

  try {
    const res = await edgeCall("visitor", {});
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.visitorData === "string" ? data.visitorData : null;
  } catch {
    return null;
  }
}

async function mint(videoId: string): Promise<PoTokenBundle | null> {
  if (typeof window === "undefined") return null;

  const visitorData = await fetchVisitorData();
  if (!visitorData) throw new Error("could not mint a YouTube visitor id");

  const challenge = await getChallenge({ requestKey: REQUEST_KEY, fetchFunction: relayFetch as any });
  const script = challenge?.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!script) throw new Error("BotGuard interpreter missing");

  // Evaluate the interpreter so its global (challenge.globalName) exists.
  // eslint-disable-next-line no-new-func
  new Function(script)();

  const webPoSignalOutput: any[] = [];
  const botguard = await BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObject: window,
  });

  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

  const itRes = await relayFetch(buildURL("GenerateIT", true), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });
  if (!itRes.ok) throw new Error(`integrity token HTTP ${itRes.status}`);
  const itJson = await itRes.json();

  const integrityTokenData = {
    integrityToken: itJson[0] as string,
    estimatedTtlSecs: itJson[1] as number,
    mintRefreshThreshold: itJson[2] as number,
    websafeFallbackToken: itJson[3] as string,
  };
  if (!integrityTokenData.integrityToken) throw new Error("no integrity token returned");

  const minter = await WebPoMinter.create(integrityTokenData, webPoSignalOutput as any);
  // Current WebPO tokens are content-bound to the requested video. The same
  // binding is required by both the player request and the `pot` parameter on
  // the resulting Google Video URL. A visitor-bound media token is treated as
  // invalid and eventually produces LOGIN_REQUIRED / bot-check responses.
  const [poToken, gvsPoToken] = await Promise.all([
    minter.mintAsWebsafeString(videoId),
    minter.mintAsWebsafeString(videoId),
  ]);
  if (!poToken || !gvsPoToken) throw new Error("PO token minting returned nothing");

  const ttl = integrityTokenData.estimatedTtlSecs
    ? integrityTokenData.estimatedTtlSecs * 1000
    : DEFAULT_TTL_MS;

  const bundle: PoTokenBundle = {
    poToken,
    gvsPoToken,
    visitorData,
    videoId,
    expiresAt: Date.now() + Math.min(ttl, DEFAULT_TTL_MS),
  };
  writeCache(bundle);
  return bundle;
}

/**
 * Returns a valid PO token bundle, minting one if needed.
 * Never throws — resolves to `null` when minting isn't possible so callers
 * can fall back to the server-side resolver.
 */
export async function getPoToken(videoId: string): Promise<PoTokenBundle | null> {
  const cached = readCache(videoId);
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = mint(videoId)
    .catch((e) => {
      console.warn("[poToken] mint failed:", e instanceof Error ? e.message : e);
      return null;
    })
    .finally(() => { inFlight = null; });

  return inFlight;
}
