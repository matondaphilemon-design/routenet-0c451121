import { chatJson } from "../_shared/llm.ts";
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

const TIMEOUT = 8000;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
  /** Upload time in ms epoch (0 when unknown) — used for era bucketing. */
  uploaded: number;
  /** Where the candidate came from: related graph, trending, new or classic. */
  bucket: "related" | "trending" | "recent" | "classic";
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
    uploaded: Number(s?.uploaded || 0),
    bucket: "related",
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

/**
 * The seed's musical neighbourhood: artists in the same genre / subgenre /
 * scene. Derived live by the AI model — no hardcoded lists, and the set
 * varies between requests so sessions stay fresh.
 */
async function neighbourArtists(
  title: string,
  artist: string,
): Promise<{ genre: string; artists: string[] }> {
  if (!artist) return { genre: "", artists: [] };
  try {
    const { data } = await chatJson<any>({
      system:
        "You are a music curator. Given a seed song, return the artists that belong to the same musical world (same genre, subgenre, scene and mood). Deliberately mix established names, mid-career artists, rising artists, independent artists and regional artists from that same scene. Never repeat the same handful of superstars. Reply with JSON only.",
      user: `Seed song: "${title}" by ${artist}.\nReturn JSON: {"genre":"<genre/subgenre>","artists":["<24 DISTINCT artist names in that scene: roughly 8 established, 8 rising/independent, 8 regional or lesser-known. Do not repeat the seed artist.>"]}`,
      json: true,
      temperature: 1,
    });
    const parsed = data ?? {};
    const list = Array.isArray(parsed?.artists) ? parsed.artists : [];
    return {
      genre: String(parsed?.genre ?? "").trim(),
      artists: list.map((a: any) => String(a).trim()).filter(Boolean).slice(0, 24),
    };
  } catch {
    return { genre: "", artists: [] };
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    // 2. Related music straight from the seed's YouTube graph.
    const seedRelated = videoId
      ? await relatedFor(videoId, 1).catch(() => ({ info: null, candidates: [] as Candidate[] }))
      : { info: null, candidates: [] as Candidate[] };
    if (seedRelated.info) seedInfo = seedRelated.info;

    const seedTitle = seedInfo?.title || title;
    const seedArtist = seedInfo?.artist || artist;

    // 3. Expand the pool in parallel and as widely as possible:
    //    a) related-of-related (when the instance serves it),
    //    b) the seed artist's own catalogue,
    //    c) live-derived neighbouring artists in the same musical world,
    //    d) genre-level trending, brand-new and classic queries so the queue
    //       can be balanced across eras instead of only "related videos".
    const fanoutIds = seedRelated.candidates.slice(0, fanout).map((c) => c.videoId);
    const { genre, artists: neighbours } = await neighbourArtists(seedTitle, seedArtist);
    const g = genre || seedArtist;
    const YEAR = new Date().getFullYear();

    const [deeper, artistHits, neighbourHits, trendingHits, recentHits, classicHits] =
      await Promise.all([
        Promise.all(
          fanoutIds.map((id) =>
            relatedFor(id, 2).catch(() => ({ info: null, candidates: [] as Candidate[] })),
          ),
        ),
        seedArtist ? searchMusic(`${seedArtist} songs`).catch(() => []) : Promise.resolve([]),
        Promise.all(
          shuffle(neighbours).slice(0, 16).map((name) =>
            searchMusic(`${name} songs`).catch(() => []).then((hits) => hits.slice(0, 6)),
          ),
        ),
        Promise.all(
          [`${g} trending songs ${YEAR}`, `${g} viral songs`, `${g} chart hits ${YEAR}`].map((q) =>
            searchMusic(q).catch(() => []).then((h) => h.slice(0, 14)),
          ),
        ),
        Promise.all(
          [`new ${g} songs ${YEAR}`, `${g} new release ${YEAR}`, `${g} new single`].map((q) =>
            searchMusic(q).catch(() => []).then((h) => h.slice(0, 14)),
          ),
        ),
        Promise.all(
          [`best ${g} songs of all time`, `classic ${g} hits`, `${g} throwback hits`].map((q) =>
            searchMusic(q).catch(() => []).then((h) => h.slice(0, 12)),
          ),
        ),
      ]);

    const pool = new Map<string, Candidate>();
    const add = (c: Candidate) => {
      if (!c.videoId || c.videoId === videoId) return;
      const existing = pool.get(c.videoId);
      if (!existing || existing.depth > c.depth) pool.set(c.videoId, c);
    };
    seedRelated.candidates.forEach(add);
    deeper.forEach((d) => d.candidates.forEach(add));
    neighbourHits.flat().forEach((c) => add({ ...c, depth: 2 }));
    trendingHits.flat().forEach((c) => add({ ...c, depth: 2, bucket: "trending" }));
    recentHits.flat().forEach((c) => add({ ...c, depth: 3, bucket: "recent" }));
    classicHits.flat().forEach((c) => add({ ...c, depth: 3, bucket: "classic" }));
    artistHits.slice(0, 8).forEach((c) => add({ ...c, depth: 3 }));
    searchHits.slice(1, 6).forEach((c) => add({ ...c, depth: 3 }));

    return json({
      seed: { videoId, title: seedTitle, artist: seedArtist, genre },
      candidates: Array.from(pool.values()),
    });

  } catch (e) {
    return json({ error: String(e), seed: null, candidates: [] }, 200);
  }
});