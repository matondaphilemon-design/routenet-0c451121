// Daily public playlist generator.
// Creates ONE playlist per UTC day under a fixed system user_id, populated
// with a mix of new releases + chart hits + suggestions from Deezer.
// Idempotent: if today's playlist exists, returns it as-is.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_USER_ID = "00000000-0000-0000-0000-00000000d417";
const DAILY_NAME_PREFIX = "Daily Mix";
const DEEZER = "https://api.deezer.com";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function safeJson(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildDailyTracks() {
  const [chart, releases] = await Promise.all([
    safeJson(`${DEEZER}/chart/0/tracks?limit=100`),
    safeJson(`${DEEZER}/editorial/0/releases?limit=50`),
  ]);
  const chartTracks: any[] = chart?.data || [];
  const newReleases: any[] = (releases?.data || [])
    .flatMap((a: any) => a?.tracks?.data || [a])
    .slice(0, 60);

  const newPick = shuffle(newReleases).slice(0, 20);
  const hitsPick = shuffle(chartTracks.slice(0, 50)).slice(0, 18);
  const suggPick = shuffle(chartTracks.slice(50)).slice(0, 15);

  const seen = new Set<string>();
  const merged: any[] = [];
  for (const t of [...newPick, ...hitsPick, ...suggPick]) {
    const id = t?.id ? `deezer-${t.id}` : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push({
      id,
      title: t.title || t.title_short || "Unknown",
      artist: t.artist?.name || "Unknown",
      album: t.album?.title || "",
      artwork: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "",
      duration: t.duration || 0,
      preview: t.preview || null,
    });
  }
  return shuffle(merged).slice(0, 50);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    const today = todayKey();
    const name = `${DAILY_NAME_PREFIX} - ${today}`;

    const { data: existing } = await admin
      .from("playlists")
      .select("*")
      .eq("user_id", SYSTEM_USER_ID)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ playlist: existing, created: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tracks = await buildDailyTracks();
    if (tracks.length === 0) {
      return new Response(JSON.stringify({ error: "no tracks available" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: playlist, error: pErr } = await admin
      .from("playlists")
      .insert({
        user_id: SYSTEM_USER_ID,
        name,
        description: "A fresh mix of new releases, hits, and discoveries - refreshed every day.",
        is_public: true,
        cover_image: tracks[0]?.artwork || null,
      })
      .select()
      .single();
    if (pErr || !playlist) throw pErr || new Error("playlist insert failed");

    const rows = tracks.map((t, i) => ({
      playlist_id: playlist.id,
      position: i,
      track_title: t.title,
      track_artist: t.artist,
      track_album: t.album,
      track_artwork: t.artwork,
      track_duration: t.duration,
      track_preview: t.preview,
    }));
    const { error: tErr } = await admin.from("playlist_tracks").insert(rows);
    if (tErr) throw tErr;

    return new Response(JSON.stringify({ playlist, created: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("daily-playlist error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
