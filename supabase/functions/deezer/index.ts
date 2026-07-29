import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const DEEZER_PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
];

const PREVIEW_HEADERS = {
  "Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
  "User-Agent": "Mozilla/5.0",
  "Referer": "https://www.deezer.com/",
  "Origin": "https://www.deezer.com",
};

async function fetchDeezerJson(url: string) {
  // Race direct + all proxies in parallel; first valid JSON wins.
  // Hard cap 6s per attempt so the function never blows the worker budget.
  const attempts: string[] = [url, ...DEEZER_PROXIES.map((p) => `${p}${encodeURIComponent(url)}`)];
  const tryOne = async (attemptUrl: string) => {
    const response = await fetch(attemptUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    if (data?.error) throw new Error(data.error.message || "deezer payload error");
    return data;
  };
  try {
    return await Promise.any(attempts.map(tryOne));
  } catch (e) {
    const errs = (e as AggregateError)?.errors?.map((x) => (x instanceof Error ? x.message : String(x))).join("; ") || "all sources failed";
    console.log(`Deezer all attempts failed: ${errs.slice(0, 200)}`);
    throw new Error(`Deezer API error: ${errs.slice(0, 160)}`);
  }
}

async function fetchPreviewStream(previewUrl: string): Promise<Response> {
  return await fetch(previewUrl, {
    headers: PREVIEW_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
}

function getPreviewFromTrackPayload(payload: any): string | null {
  if (typeof payload?.preview === "string" && payload.preview.startsWith("http")) return payload.preview;
  return null;
}

async function resolveFreshPreviewUrl(trackId?: string | number, query?: string): Promise<string | null> {
  if (trackId) {
    try {
      const trackData = await fetchDeezerJson(`${DEEZER_API}/track/${trackId}`);
      const preview = getPreviewFromTrackPayload(trackData);
      if (preview) return preview;
    } catch (e) {
      console.log(`Failed to refresh preview via trackId (${trackId}): ${e}`);
    }
  }

  if (query) {
    try {
      const searchData = await fetchDeezerJson(`${DEEZER_API}/search/track?q=${encodeURIComponent(query)}&limit=5`);
      if (Array.isArray(searchData?.data)) {
        const preview = searchData.data
          .map((item: any) => getPreviewFromTrackPayload(item))
          .find((url: string | null) => !!url);
        if (preview) return preview;
      }
    } catch (e) {
      console.log(`Failed to refresh preview via query (${query}): ${e}`);
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`Deezer API: action=${action}`, params);

    let url: string;

    switch (action) {
      case "searchArtist":
        url = `${DEEZER_API}/search/artist?q=${encodeURIComponent(params.name)}&limit=${params.limit || 10}`;
        break;
      case "searchTrack":
        url = `${DEEZER_API}/search/track?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}`;
        break;
      case "searchAlbum":
        url = `${DEEZER_API}/search/album?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}`;
        break;
      case "getArtist":
        url = `${DEEZER_API}/artist/${params.artistId}`;
        break;
      case "getArtistTopTracks":
        url = `${DEEZER_API}/artist/${params.artistId}/top?limit=${params.limit || 10}`;
        break;
      case "getArtistAlbums":
        url = `${DEEZER_API}/artist/${params.artistId}/albums?limit=${params.limit || 20}`;
        break;
      case "getAlbum":
        url = `${DEEZER_API}/album/${params.albumId}`;
        break;
      case "getTrack":
        url = `${DEEZER_API}/track/${params.trackId}`;
        break;
      case "getChart": {
        const chartType = params.type || "tracks";
        url = `${DEEZER_API}/chart/0/${chartType}?limit=${params.limit || 20}`;
        break;
      }
      case "getLocalChart": {
        const country = params.country || "";
        url = country
          ? `${DEEZER_API}/search/track?q=${encodeURIComponent(country + " top hits")}&limit=${params.limit || 20}&order=RANKING`
          : `${DEEZER_API}/chart/0/tracks?limit=${params.limit || 20}`;
        break;
      }
      case "getGenreTracks":
        url = `${DEEZER_API}/chart/${params.genreId}/tracks?limit=${params.limit || 20}`;
        break;
      case "getPlaylistTracks":
        url = `${DEEZER_API}/playlist/${params.playlistId}/tracks?limit=${params.limit || 25}`;
        break;
      case "getPlaylist":
        url = `${DEEZER_API}/playlist/${params.playlistId}`;
        break;
      case "searchPlaylist":
        url = `${DEEZER_API}/search/playlist?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}`;
        break;
      case "getGenres":
        url = `${DEEZER_API}/genre`;
        break;
      case "getGenreArtists":
        url = `${DEEZER_API}/genre/${params.genreId}/artists?limit=${params.limit || 20}`;
        break;
      case "getGenreChartArtists":
        url = `${DEEZER_API}/chart/${params.genreId}/artists?limit=${params.limit || 20}`;
        break;
      case "getRadio":
        url = `${DEEZER_API}/radio`;
        break;
      case "getTrackRadio":
        url = `${DEEZER_API}/track/${params.trackId}/radio?limit=${params.limit || 25}`;
        break;
      case "getEditorialReleases":
        url = `${DEEZER_API}/editorial/0/releases?limit=${params.limit || 20}`;
        break;
      case "getEditorialPlaylists":
        url = `${DEEZER_API}/editorial/0/charts?limit=${params.limit || 10}`;
        break;
      case "getArtistRelated":
        url = `${DEEZER_API}/artist/${params.artistId}/related?limit=${params.limit || 10}`;
        break;
      case "getArtistRadio":
        url = `${DEEZER_API}/artist/${params.artistId}/radio?limit=${params.limit || 25}`;
        break;
      case "getGenreRadios":
        url = `${DEEZER_API}/genre/${params.genreId}/radios`;
        break;
      case "proxyPreview": {
        const initialPreviewUrl = params?.url;
        const trackId = params?.trackId;
        const query = params?.query;

        if (!initialPreviewUrl) {
          return new Response(JSON.stringify({ success: false, error: "Missing preview URL" }), {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-Stream-Error": "PREVIEW_UNAVAILABLE",
            },
          });
        }

        const attemptUrls: string[] = [initialPreviewUrl];

        let audioRes = await fetchPreviewStream(initialPreviewUrl);
        if (!audioRes.ok || !audioRes.body) {
          console.log(`Initial preview fetch failed: ${audioRes.status}`);
          if ([401, 403, 410].includes(audioRes.status)) {
            const freshPreviewUrl = await resolveFreshPreviewUrl(trackId, query);
            if (freshPreviewUrl && freshPreviewUrl !== initialPreviewUrl) {
              attemptUrls.push(freshPreviewUrl);
              audioRes = await fetchPreviewStream(freshPreviewUrl);
              console.log(`Retried preview with refreshed URL, status=${audioRes.status}`);
            }
          }
        }

        if (!audioRes.ok || !audioRes.body) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Preview unavailable after retry: ${audioRes.status}`,
              attempted: attemptUrls.length,
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "X-Stream-Error": "PREVIEW_UNAVAILABLE",
              },
            },
          );
        }

        return new Response(audioRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Content-Length": audioRes.headers.get("Content-Length") || "",
          },
        });
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Fetching: ${url}`);
    const data = await fetchDeezerJson(url);
    console.log("Deezer response received");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Deezer function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Return 200 with fallback flag so the client can degrade gracefully
    // instead of throwing a runtime error on 500s (e.g. Deezer 403 on /radio).
    return new Response(
      JSON.stringify({ error: errorMessage, fallback: true, data: [] }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Deezer-Error": "UPSTREAM_FAILED",
        },
      },
    );
  }
});
