// deno-lint-ignore-file no-explicit-any
// Piped (YouTube) radio candidate source — the ONLY recommendation backend.
// POST { title, artist, videoId?, fanout? } -> { seed, candidates }
// No caching: every request performs a fresh Piped lookup.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.reallyaweso.me",
  "https://piped-api.lunar.icu",
];

const TIMEOUT = 7000;

function vid(url: string | undefined): string {
  if (!url) return "";
  if (/^[\w-]{11}$/.test(url)) return url;
  return url.split("v=")[1]?.split("&")[0] ?? "";
}

const cleanArtist = (s: string) =>
  (s || "").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();

async function anyInstance<T>(fn: (base: string) => Promise<T>): Promise<T | null> {
  try {
    return await Promise.any(PIPED_INSTANCES.map(fn));
  } catch {
    return null;
  }
}

async function get(base: string, path: string) {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

interface Candidate {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  views: number;
  verified: boolean;
  topic: boolean;
  depth: number;
}

function mapStream(s: any, depth: number): Candidate | null {
  const id = vid(s?.url);
  if (!id) return null;
  const uploader = String(s?.uploaderName || s?.uploader || "");
  return {
    videoId: id,
    title: String(s?.title || s?.name || ""),
    artist: cleanArtist(uploader),
    thumbnail: s?.thumbnail || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    duration: Number(s?.duration || 0),
    views: Number(s?.views || 0),
    verified: !!s?.uploaderVerified,
    topic: /-\s*Topic$/i.test(uploader),
    depth,
  };
}

/** Music-first Piped search. */
async function searchMusic(q: string, filter = "music_songs"): Promise<Candidate[]> {
  const items = await anyInstance(async (base) => {
    const j = await get(base, `/search?q=${encodeURIComponent(q)}&filter=${filter}`);
    const list = (j?.items || []).filter((i: any) => vid(i?.url));
    if (!list.length) throw new Error("empty");
    return list;
  });
  return (items || []).map((i: any) => mapStream(i, 0)).filter(Boolean) as Candidate[];
}

async function relatedFor(videoId: string, depth: number) {
  const j = await anyInstance((base) => get(base, `/streams/${videoId}`));
  const related = (j?.relatedStreams || []).filter((s: any) => s?.type !== "channel" && s?.type !== "playlist");
  return {
    info: j
      ? { title: String(j.title || ""), artist: cleanArtist(String(j.uploader || "")), duration: Number(j.duration || 0) }
      : null,
    candidates: related.map((s: any) => mapStream(s, depth)).filter(Boolean) as Candidate[],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const title = String(body.title ?? url.searchParams.get("title") ?? "").trim();
    const artist = String(body.artist ?? url.searchParams.get("artist") ?? "").trim();
    let videoId = String(body.videoId ?? url.searchParams.get("videoId") ?? "").trim();
    const fanout = Math.min(Math.max(Number(body.fanout ?? 3), 0), 5);

    if (!videoId && !title && !artist) return json({ error: "seed required" }, 400);

    // 1. Resolve the seed video from a fresh Piped search.
    let seedInfo: { title: string; artist: string; duration: number } | null = null;
    let searchHits: Candidate[] = [];
    if (!videoId) {
      const q = `${artist} ${title}`.trim();
      searchHits = await searchMusic(q);
      if (!searchHits.length) searchHits = await searchMusic(q, "videos");
      videoId = searchHits[0]?.videoId ?? "";
      if (searchHits[0]) {
        seedInfo = { title: searchHits[0].title, artist: searchHits[0].artist, duration: searchHits[0].duration };
      }
    }
    if (!videoId) return json({ seed: null, candidates: [] });

    // 2. Related music for the seed.
    const seedRelated = await relatedFor(videoId, 1);
    if (seedRelated.info) seedInfo = seedRelated.info;

    // 3. Expand the pool: related-of-related + an artist search, in parallel.
    const fanoutIds = seedRelated.candidates.slice(0, fanout).map((c) => c.videoId);
    const [deeper, artistHits] = await Promise.all([
      Promise.all(fanoutIds.map((id) => relatedFor(id, 2).catch(() => ({ info: null, candidates: [] })))),
      artist ? searchMusic(`${artist} songs`).catch(() => []) : Promise.resolve([]),
    ]);

    const pool = new Map<string, Candidate>();
    const add = (c: Candidate) => {
      if (!c.videoId || c.videoId === videoId) return;
      const existing = pool.get(c.videoId);
      if (!existing || existing.depth > c.depth) pool.set(c.videoId, c);
    };
    seedRelated.candidates.forEach(add);
    deeper.forEach((d) => d.candidates.forEach(add));
    artistHits.forEach((c) => add({ ...c, depth: 2 }));
    searchHits.slice(1).forEach((c) => add({ ...c, depth: 3 }));

    return json({
      seed: { videoId, title: seedInfo?.title || title, artist: seedInfo?.artist || artist },
      candidates: Array.from(pool.values()),
    });
  } catch (e) {
    return json({ error: String(e), seed: null, candidates: [] }, 200);
  }
});