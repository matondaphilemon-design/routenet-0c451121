import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Large pool of Piped instances to try (CDN-enabled first, then others)
const PIPED_INSTANCES: string[] = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.tokhmi.xyz",
  "https://pipedapi.syncpundit.io",
  "https://api-piped.mha.fi",
  "https://piped-api.garudalinux.org",
  "https://pipedapi.rivo.lol",
  "https://pipedapi.leptons.xyz",
  "https://piped-api.lunar.icu",
  "https://pipedapi.colinslegacy.com",
  "https://pipedapi.r4fo.com",
  "https://api.piped.yt",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.qdi.fi",
  "https://piped-api.hostux.net",
  "https://pipedapi.pfcd.me",
  "https://pipedapi.frontendfriendly.xyz",
  "https://piapi.ggtyler.dev",
  "https://api.watch.pluto.lat",
  "https://pipedapi.drgns.space",
  "https://pipedapi.coldforge.xyz",
  "https://api.piped.private.coffee",
];

const INVIDIOUS_INSTANCES: string[] = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://vid.puffyan.us",
];

const INNERTUBE_ENDPOINT = "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const INNERTUBE_CLIENTS = [
  {
    name: "WEB_EMBEDDED_PLAYER",
    version: "1.20250306.01.00",
    userAgent: "Mozilla/5.0",
    thirdParty: { embedUrl: "https://www.youtube.com" },
  },
  {
    name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    version: "2.0",
    userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
    thirdParty: { embedUrl: "https://www.youtube.com" },
  },
  {
    name: "WEB",
    version: "2.20250306.01.00",
    userAgent: "Mozilla/5.0",
  },
  {
    name: "IOS",
    version: "20.10.4",
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)",
  },
] as const;

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function checkCache(supabase: any, title: string, artist: string): Promise<any | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("youtube_cache")
      .select("*")
      .ilike("title", `%${title}%`)
      .ilike("artist", `%${artist}%`)
      .limit(1)
      .single();
    
    if (error || !data) return null;
    console.log(`Cache hit for: ${title} - ${artist}`);
    return data;
  } catch {
    return null;
  }
}

async function storeInCache(supabase: any, video: any, title: string, artist: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("youtube_cache").upsert({
      video_id: video.id,
      title: title,
      artist: artist,
      video_title: video.title,
      thumbnail: video.thumbnail,
      channel_title: video.channelTitle,
      duration: video.duration || null,
    }, { onConflict: "video_id" });
    console.log(`Cached: ${title} - ${artist}`);
  } catch (e) {
    console.error("Cache store error:", e);
  }
}

async function searchWithPiped(query: string, maxResults: number): Promise<any[] | null> {
  // Race all Piped instances in parallel; first valid result wins.
  // Hard 5s cap per instance so the worker never blows its CPU/wall budget.
  const tryOne = async (instance: string) => {
    const response = await fetch(
      `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) throw new Error(`${instance} ${response.status}`);
    const data = await response.json();
    if (!data?.items?.length) throw new Error(`${instance} empty`);
    console.log(`Piped success: ${instance}, found ${data.items.length} results`);
    return data.items.slice(0, maxResults).map((item: any) => ({
      id: item.url?.split("v=")[1] || item.url?.replace("/watch?v=", ""),
      title: item.title,
      description: item.shortDescription || "",
      thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.url?.split("v=")[1]}/mqdefault.jpg`,
      channelTitle: item.uploaderName || item.uploader,
      duration: item.duration,
    }));
  };
  try {
    return await Promise.any(PIPED_INSTANCES.map(tryOne));
  } catch {
    return null;
  }
}

async function searchWithInvidious(query: string, maxResults: number): Promise<any[] | null> {
  const searchParams = new URLSearchParams({ q: query, type: "video", sort_by: "relevance" });
  const tryOne = async (instance: string) => {
    const response = await fetch(
      `${instance}/api/v1/search?${searchParams}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) throw new Error(`${instance} ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error(`${instance} empty`);
    console.log(`Invidious success: ${instance}, found ${data.length} results`);
    return data
      .filter((item: any) => item.type === "video")
      .slice(0, maxResults)
      .map((item: any) => ({
        id: item.videoId,
        title: item.title,
        description: item.description || "",
        thumbnail: item.videoThumbnails?.[3]?.url || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
        channelTitle: item.author,
        duration: item.lengthSeconds,
      }));
  };
  try {
    return await Promise.any(INVIDIOUS_INSTANCES.map(tryOne));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// YouTube Data API v3 — playlist discovery
// ---------------------------------------------------------------------------
const YT_API = "https://www.googleapis.com/youtube/v3";

function ytKey(): string | null {
  return Deno.env.get("YOUTUBE_API_KEY") || null;
}

/** Search YouTube for playlists matching a query (Data API v3). */
async function searchYouTubePlaylists(query: string, maxResults = 15) {
  const key = ytKey();
  if (!key) return { data: [], unavailable: true, reason: "missing_api_key" };
  const url = `${YT_API}/search?part=snippet&type=playlist&order=relevance&maxResults=${Math.min(
    maxResults,
    25,
  )}&q=${encodeURIComponent(query)}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const body = await res.text();
    console.warn("[yt] playlist search failed", res.status, body.slice(0, 200));
    return { data: [], unavailable: true, reason: `http_${res.status}` };
  }
  const json = await res.json();
  const data = (json.items || [])
    .filter((i: any) => i?.id?.playlistId)
    .map((i: any) => ({
      id: i.id.playlistId,
      title: i.snippet?.title || "Playlist",
      description: i.snippet?.description || "",
      channelTitle: i.snippet?.channelTitle || "",
      image:
        i.snippet?.thumbnails?.high?.url ||
        i.snippet?.thumbnails?.medium?.url ||
        i.snippet?.thumbnails?.default?.url ||
        "",
    }));
  return { data };
}

/** Fetch the video items inside a YouTube playlist. */
async function getYouTubePlaylistItems(playlistId: string, maxResults = 40) {
  const key = ytKey();
  if (!key) return { data: [], unavailable: true, reason: "missing_api_key" };
  const url = `${YT_API}/playlistItems?part=snippet,contentDetails&maxResults=${Math.min(
    maxResults,
    50,
  )}&playlistId=${encodeURIComponent(playlistId)}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const body = await res.text();
    console.warn("[yt] playlistItems failed", res.status, body.slice(0, 200));
    return { data: [], unavailable: true, reason: `http_${res.status}` };
  }
  const json = await res.json();
  const data = (json.items || [])
    .map((i: any) => ({
      videoId: i?.contentDetails?.videoId || i?.snippet?.resourceId?.videoId,
      title: i?.snippet?.title || "",
      channelTitle: i?.snippet?.videoOwnerChannelTitle || i?.snippet?.channelTitle || "",
      thumbnail:
        i?.snippet?.thumbnails?.high?.url ||
        i?.snippet?.thumbnails?.medium?.url ||
        i?.snippet?.thumbnails?.default?.url ||
        "",
    }))
    .filter(
      (v: any) =>
        v.videoId &&
        v.title &&
        !/^(deleted|private) video$/i.test(v.title),
    );
  return { data };
}

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`YouTube action: ${action}`, params);

    const supabase = getSupabaseClient();
    let result;

    switch (action) {
      case "search":
        result = await searchVideos(params, supabase);
        break;
      case "getVideo":
        result = await getVideoDetails(params);
        break;
      case "getTrending":
        result = await getTrendingMusic(params?.maxResults || 10);
        break;
      case "searchPlaylists":
        result = await searchYouTubePlaylists(params?.query || "", params?.limit || 15);
        break;
      case "getPlaylistItems":
        result = await getYouTubePlaylistItems(params?.playlistId, params?.limit || 40);
        break;
      case "getAudioStream":
        result = await getAudioStreamUrl(params?.videoId);
        break;

      case "downloadAudio": {
        // Proxy the audio stream through this edge function to bypass CORS
        const videoId = params?.videoId;
        let upstreamUrl: string | null = null;
        let mimeType = "audio/mp4";
        let quality = "unknown";

        // 0) The client can hand us a stream URL it already resolved through
        //    the Piped instance pool (the same source playback uses). This is
        //    by far the most reliable path.
        if (typeof params?.streamUrl === "string" && params.streamUrl.startsWith("http")) {
          upstreamUrl = params.streamUrl;
          quality = "client-resolved";
        }

        // 1) Try Piped/Invidious/Innertube via existing helper
        if (!upstreamUrl) {
          try {
            const streamInfo = await getAudioStreamUrl(videoId);
            if (streamInfo?.url) {
              upstreamUrl = streamInfo.url;
              mimeType = streamInfo.mimeType || mimeType;
              quality = streamInfo.quality || quality;
            }
          } catch (e) {
            console.warn("[downloadAudio] primary stream failed:", e);
          }
        }


        // 2) Fallback to Cobalt (yt-dlp-style server) for real audio
        if (!upstreamUrl) {
          const cobaltHosts = [
            "https://api.cobalt.tools/api/json",
            "https://co.wuk.sh/api/json",
            "https://cobalt-api.kwiatekmiki.com/api/json",
          ];
          for (const host of cobaltHosts) {
            try {
              const r = await fetch(host, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  isAudioOnly: true,
                  aFormat: "mp3",
                  filenamePattern: "basic",
                }),
                signal: AbortSignal.timeout(20000),
              });
              if (!r.ok) continue;
              const j = await r.json();
              if (j?.url && (j.status === "stream" || j.status === "redirect" || j.status === "tunnel")) {
                upstreamUrl = j.url;
                mimeType = "audio/mpeg";
                quality = "cobalt-mp3";
                console.log(`[downloadAudio] cobalt fallback via ${host}`);
                break;
              }
            } catch (e) {
              console.warn(`[downloadAudio] cobalt ${host} failed`, e);
            }
          }
        }

        if (!upstreamUrl) {
          return new Response(
            JSON.stringify({ success: false, error: "No audio stream found" }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "X-Stream-Error": "NO_AUDIO_STREAM",
              },
            }
          );
        }

        console.log(`Proxying audio download for ${videoId} (${quality})`);

        const openStream = async (u: string) =>
          await fetch(u, {
            headers: { "Range": "bytes=0-", "User-Agent": "Mozilla/5.0" },
            redirect: "follow",
            signal: AbortSignal.timeout(180000),
          });

        let audioResponse: Response | null = null;
        try {
          audioResponse = await openStream(upstreamUrl);
        } catch (e) {
          console.warn("[downloadAudio] stream open failed:", e);
        }

        // A client-resolved URL can expire or be IP-bound — re-resolve here.
        if ((!audioResponse || !audioResponse.ok || !audioResponse.body) && quality === "client-resolved") {
          try {
            const streamInfo = await getAudioStreamUrl(videoId);
            if (streamInfo?.url) {
              mimeType = streamInfo.mimeType || mimeType;
              quality = streamInfo.quality || "server-resolved";
              audioResponse = await openStream(streamInfo.url);
            }
          } catch (e) {
            console.warn("[downloadAudio] re-resolve failed:", e);
          }
        }

        if (!audioResponse || !audioResponse.ok || !audioResponse.body) {
          return new Response(
            JSON.stringify({ success: false, error: `Upstream audio fetch failed: ${audioResponse?.status ?? "network"}` }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "X-Stream-Error": "UPSTREAM_FAILED",
              },
            }
          );
        }

        const outHeaders: Record<string, string> = {
          ...corsHeaders,
          "Content-Type": audioResponse.headers.get("Content-Type") || mimeType,
          "X-Audio-Quality": quality,
          "Access-Control-Expose-Headers": "Content-Length, X-Audio-Quality, X-Stream-Error",
        };
        const len = audioResponse.headers.get("Content-Length");
        if (len) outHeaders["Content-Length"] = len;

        return new Response(audioResponse.body, { headers: outHeaders });

      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("YouTube API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function searchVideos(params: any, supabase: any) {
  const { query, maxResults = 10 } = params;
  
  const parts = query.split(" ");
  const artist = parts.slice(0, Math.ceil(parts.length / 2)).join(" ");
  const title = parts.slice(Math.ceil(parts.length / 2)).join(" ") || query;

  // Check cache first
  const cached = await checkCache(supabase, title, artist);
  if (cached) {
    return {
      items: [{
        id: cached.video_id,
        title: cached.video_title,
        thumbnail: cached.thumbnail,
        channelTitle: cached.channel_title,
        description: "",
        publishedAt: cached.created_at,
        fromCache: true,
      }],
      totalResults: 1,
    };
  }

  const searchQuery = `${query} official audio`;
  
  // Try Piped first
  let items = await searchWithPiped(searchQuery, maxResults);
  
  // Fallback to Invidious
  if (!items || items.length === 0) {
    items = await searchWithInvidious(searchQuery, maxResults);
  }
  
  if (items && items.length > 0) {
    if (supabase) {
      await storeInCache(supabase, items[0], title, artist);
    }
    return { items, totalResults: items.length };
  }

  // Return empty instead of wrong songs
  console.log("All APIs failed, no results");
  return { items: [], totalResults: 0 };
}

async function getVideoDetails(params: any) {
  const { videoId } = params;
  
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const video = await response.json();
        return {
          id: videoId,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          channelTitle: video.uploader,
          duration: video.duration,
        };
      }
    } catch (e) {
      console.log(`Piped video error: ${e}`);
    }
  }
  
  return {
    id: videoId,
    title: "Video",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

async function getTrendingMusic(maxResults: number) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/trending?region=US`, {
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const data = await response.json();
        const items = data.slice(0, maxResults).map((item: any) => ({
          id: item.url?.split("v=")[1] || item.url?.replace("/watch?v=", ""),
          title: item.title,
          thumbnail: item.thumbnail,
          channelTitle: item.uploaderName,
          duration: item.duration,
        }));
        return { items };
      }
    } catch (e) {
      console.log(`Piped trending error: ${e}`);
    }
  }

  return { items: [], totalResults: 0 };
}

async function tryPipedInstance(instance: string, videoId: string) {
  const response = await fetch(`${instance}/streams/${videoId}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${text.slice(0, 80)}`);
  }
  const data = await response.json();
  const audioStreams = data.audioStreams || [];
  if (audioStreams.length === 0) throw new Error("No audio streams");
  const best = audioStreams.reduce((a: any, b: any) =>
    (b.bitrate || 0) > (a.bitrate || 0) ? b : a
  , audioStreams[0]);
  console.log(`Audio stream found via ${instance}: ${best.mimeType}, bitrate: ${best.bitrate}`);
  return {
    url: best.url,
    mimeType: best.mimeType,
    bitrate: best.bitrate,
    quality: best.quality || `${Math.round((best.bitrate || 0) / 1000)}kbps`,
  };
}

// Try multiple free cobalt-like services
async function tryCobaltAudio(videoId: string) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Try cobalt.tools v10 API format
  const cobaltEndpoints = [
    "https://api.cobalt.tools",
    "https://cobalt-api.hyper.lol",
    "https://cobalt.api.timelessnesses.me",
  ];
  
  for (const endpoint of cobaltEndpoints) {
    try {
      console.log(`Trying Cobalt endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: youtubeUrl,
          downloadMode: "audio",
          audioFormat: "mp3",
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const streamUrl = data.url || data.audio;
        if (streamUrl) {
          console.log(`Cobalt success via ${endpoint} for ${videoId}`);
          return {
            url: streamUrl,
            mimeType: "audio/mpeg",
            bitrate: 128000,
            quality: "128kbps",
          };
        }
      } else {
        const text = await response.text().catch(() => "");
        console.log(`Cobalt ${endpoint} returned ${response.status}: ${text.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`Cobalt ${endpoint} error: ${e}`);
    }
  }

  // Try yt-dlp based services
  try {
    console.log(`Trying savetube fallback for: ${videoId}`);
    const response = await fetch(`https://api.savetube.me/info?url=${encodeURIComponent(youtubeUrl)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.data?.audio) {
        console.log(`Savetube success for ${videoId}`);
        return {
          url: data.data.audio,
          mimeType: "audio/mpeg",
          bitrate: 128000,
          quality: "128kbps",
        };
      }
    } else {
      await response.text(); // consume body
    }
  } catch (e) {
    console.log(`Savetube error: ${e}`);
  }

  return null;
}

async function tryGetVideoInfoAudio(videoId: string) {
  try {
    console.log(`Trying get_video_info fallback for: ${videoId}`);
    const response = await fetch(
      `https://www.youtube.com/get_video_info?video_id=${encodeURIComponent(videoId)}&el=detailpage&hl=en`,
      { signal: AbortSignal.timeout(12000) },
    );

    if (!response.ok) {
      console.log(`get_video_info returned ${response.status}`);
      return null;
    }

    const text = await response.text();
    const qs = new URLSearchParams(text);
    const playerResponseRaw = qs.get("player_response");
    if (!playerResponseRaw) return null;

    const playerResponse = JSON.parse(playerResponseRaw);
    const adaptive = Array.isArray(playerResponse?.streamingData?.adaptiveFormats)
      ? playerResponse.streamingData.adaptiveFormats
      : [];

    const candidates = adaptive
      .filter((f: any) => String(f?.mimeType || "").startsWith("audio/"))
      .map((f: any) => {
        const directUrl = typeof f?.url === "string" ? f.url : extractUrlFromSignatureCipher(f?.signatureCipher);
        return {
          url: directUrl,
          mimeType: parseMimeType(f?.mimeType),
          bitrate: Number(f?.bitrate || 0),
          qualityLabel: f?.audioQuality || f?.qualityLabel,
        };
      })
      .filter((f: any) => typeof f.url === "string" && f.url.length > 0);

    if (candidates.length === 0) {
      console.log("get_video_info returned no usable audio formats");
      return null;
    }

    const best = candidates.reduce((a: any, b: any) => (b.bitrate || 0) > (a.bitrate || 0) ? b : a, candidates[0]);
    console.log(`get_video_info success for ${videoId}`);
    return {
      url: best.url,
      mimeType: best.mimeType,
      bitrate: best.bitrate,
      quality: best.qualityLabel || `${Math.round((best.bitrate || 128000) / 1000)}kbps`,
    };
  } catch (e) {
    console.log(`get_video_info fallback error: ${e}`);
    return null;
  }
}

function parseMimeType(input?: string | null): string {
  if (!input) return "audio/mp4";
  return input.split(";")[0]?.trim() || "audio/mp4";
}

function extractUrlFromSignatureCipher(signatureCipher?: string): string | null {
  if (!signatureCipher) return null;
  const params = new URLSearchParams(signatureCipher);
  const baseUrl = params.get("url");
  if (!baseUrl) return null;

  const sig = params.get("sig") || params.get("signature");
  const sp = params.get("sp") || "signature";

  // If cipher uses encrypted "s", we cannot decipher it in edge runtime.
  if (!sig && params.get("s")) return null;
  if (!sig) return baseUrl;

  const url = new URL(baseUrl);
  url.searchParams.set(sp, sig);
  return url.toString();
}

async function tryInnertubeAudio(videoId: string) {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      console.log(`Trying Innertube fallback (${client.name}) for: ${videoId}`);
      const response = await fetch(INNERTUBE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
        },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              hl: "en",
              gl: "US",
            },
            ...(client.thirdParty ? { thirdParty: client.thirdParty } : {}),
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        console.log(`Innertube (${client.name}) returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const playability = data?.playabilityStatus?.status;
      if (playability && playability !== "OK") {
        console.log(`Innertube (${client.name}) playability: ${playability}`);
        continue;
      }

      const adaptive = Array.isArray(data?.streamingData?.adaptiveFormats)
        ? data.streamingData.adaptiveFormats
        : [];
      const regular = Array.isArray(data?.streamingData?.formats)
        ? data.streamingData.formats
        : [];

      const candidates = [...adaptive, ...regular]
        .filter((f: any) => String(f?.mimeType || "").startsWith("audio/"))
        .map((f: any) => {
          const directUrl = typeof f?.url === "string" ? f.url : extractUrlFromSignatureCipher(f?.signatureCipher);
          return {
            url: directUrl,
            mimeType: parseMimeType(f?.mimeType),
            bitrate: Number(f?.bitrate || 0),
            qualityLabel: f?.audioQuality || f?.qualityLabel,
          };
        })
        .filter((f: any) => typeof f.url === "string" && f.url.length > 0);

      if (candidates.length === 0) {
        console.log(`Innertube (${client.name}) returned no usable audio formats`);
        continue;
      }

      const best = candidates.reduce((a: any, b: any) => (b.bitrate || 0) > (a.bitrate || 0) ? b : a, candidates[0]);
      console.log(`Innertube success (${client.name}) for ${videoId}`);
      return {
        url: best.url,
        mimeType: best.mimeType,
        bitrate: best.bitrate,
        quality: best.qualityLabel || `${Math.round((best.bitrate || 128000) / 1000)}kbps`,
      };
    } catch (e) {
      console.log(`Innertube fallback (${client.name}) error: ${e}`);
    }
  }

  return null;
}

async function getAudioStreamUrl(videoId: string) {
  // Try Piped instances in batches of 5 concurrently for speed
  for (let i = 0; i < PIPED_INSTANCES.length; i += 5) {
    const batch = PIPED_INSTANCES.slice(i, i + 5);
    console.log(`Trying Piped batch ${i / 5 + 1}: ${batch.map(u => new URL(u).hostname).join(", ")}`);

    const results = await Promise.allSettled(
      batch.map(inst => tryPipedInstance(inst, videoId))
    );

    for (const r of results) {
      if (r.status === "fulfilled") return r.value;
    }

    // Log failures
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.log(`  ${batch[idx]}: ${r.reason?.message?.slice(0, 80)}`);
      }
    });
  }

  // Fallback: Invidious
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious audio: ${instance}`);
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        const audioStreams = data.adaptiveFormats?.filter((f: any) => f.type?.startsWith("audio/")) || [];
        if (audioStreams.length === 0) continue;
        const best = audioStreams.reduce((a: any, b: any) =>
          (parseInt(b.bitrate || "0") > parseInt(a.bitrate || "0")) ? b : a
          , audioStreams[0]);
        console.log(`Audio via Invidious ${instance}: ${best.type}`);
        return {
          url: best.url, mimeType: best.type,
          bitrate: parseInt(best.bitrate || "0"),
          quality: `${Math.round(parseInt(best.bitrate || "0") / 1000)}kbps`,
        };
      } else {
        console.log(`Invidious ${instance} returned ${response.status}`);
      }
    } catch (e) {
      console.log(`Invidious audio error (${instance}): ${e}`);
    }
  }

  // Fallback: Cobalt API
  const cobaltStream = await tryCobaltAudio(videoId);
  if (cobaltStream) {
    console.log(`Audio via Cobalt for ${videoId}`);
    return cobaltStream;
  }

  // Fallback: legacy YouTube get_video_info extraction
  const videoInfoStream = await tryGetVideoInfoAudio(videoId);
  if (videoInfoStream) {
    console.log(`Audio via get_video_info fallback for ${videoId}`);
    return videoInfoStream;
  }

  // Final fallback: direct extraction using YouTube Innertube API
  const innertubeStream = await tryInnertubeAudio(videoId);
  if (innertubeStream) {
    console.log(`Audio via Innertube fallback for ${videoId}`);
    return innertubeStream;
  }

  console.log(`No audio stream found for ${videoId}`);
  return null;
}
