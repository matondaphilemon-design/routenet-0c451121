import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COVERART_API = 'https://coverartarchive.org';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`Cover Art Archive API: action=${action}`, params);

    let url: string;
    
    switch (action) {
      case 'getReleaseCover':
        // Get cover art for a release by MusicBrainz release ID
        url = `${COVERART_API}/release/${params.mbid}`;
        break;
      case 'getReleaseGroupCover':
        // Get cover art for a release group by MusicBrainz release-group ID
        url = `${COVERART_API}/release-group/${params.mbid}`;
        break;
      case 'getFront':
        // Get just the front cover image URL
        url = `${COVERART_API}/release/${params.mbid}/front`;
        // This redirects to the actual image, so we return the URL
        return new Response(JSON.stringify({ 
          imageUrl: url,
          thumbnails: {
            small: `${COVERART_API}/release/${params.mbid}/front-250`,
            large: `${COVERART_API}/release/${params.mbid}/front-500`,
            xl: `${COVERART_API}/release/${params.mbid}/front-1200`,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 404) {
      // No cover art available
      return new Response(JSON.stringify({ images: [], exists: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cover Art Archive API error: ${response.status}`, errorText);
      throw new Error(`Cover Art Archive API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Cover Art Archive response received, images:`, data.images?.length || 0);

    return new Response(JSON.stringify({ ...data, exists: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cover Art Archive function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
