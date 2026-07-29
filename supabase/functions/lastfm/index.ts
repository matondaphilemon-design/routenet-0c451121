import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';

// Mock data fallback when API key is not available or invalid
function getMockData(action: string, params: any) {
  console.log(`Using mock data for action: ${action}`);
  
  switch (action) {
    case 'getArtistInfo':
      return {
        artist: {
          name: params.name || 'Unknown Artist',
          bio: { summary: 'Artist information not available.' },
          stats: { listeners: '0', playcount: '0' },
          similar: { artist: [] },
          tags: { tag: [] },
          image: [],
        }
      };
    case 'getTopTracks':
      return { toptracks: { track: [] } };
    case 'getTopAlbums':
      return { topalbums: { album: [] } };
    case 'getSimilarArtists':
      return { similarartists: { artist: [] } };
    case 'getTopArtists':
      return { artists: { artist: [] } };
    case 'searchArtist':
      return { results: { artistmatches: { artist: [] } } };
    case 'searchTrack':
      return { results: { trackmatches: { track: [] } } };
    default:
      return {};
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LASTFM_API_KEY');
    const { action, params } = await req.json();
    console.log(`Last.fm API: action=${action}`, params);

    // If no API key, return mock data gracefully
    if (!apiKey) {
      console.log('LASTFM_API_KEY not configured, using mock data');
      return new Response(JSON.stringify(getMockData(action, params)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let method: string;
    let queryParams = new URLSearchParams();
    
    switch (action) {
      case 'searchArtist':
        method = 'artist.search';
        queryParams.set('artist', params.name);
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      case 'getArtistInfo':
        method = 'artist.getinfo';
        if (params.mbid) {
          queryParams.set('mbid', params.mbid);
        } else {
          queryParams.set('artist', params.name);
        }
        break;
      case 'getSimilarArtists':
        method = 'artist.getsimilar';
        if (params.mbid) {
          queryParams.set('mbid', params.mbid);
        } else {
          queryParams.set('artist', params.name);
        }
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      case 'getTopTracks':
        method = 'artist.gettoptracks';
        if (params.mbid) {
          queryParams.set('mbid', params.mbid);
        } else {
          queryParams.set('artist', params.name);
        }
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      case 'getTopAlbums':
        method = 'artist.gettopalbums';
        if (params.mbid) {
          queryParams.set('mbid', params.mbid);
        } else {
          queryParams.set('artist', params.name);
        }
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      case 'getAlbumInfo':
        method = 'album.getinfo';
        if (params.mbid) {
          queryParams.set('mbid', params.mbid);
        } else {
          queryParams.set('artist', params.artist);
          queryParams.set('album', params.album);
        }
        break;
      case 'searchTrack':
        method = 'track.search';
        queryParams.set('track', params.track);
        if (params.artist) queryParams.set('artist', params.artist);
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      case 'getTrackInfo':
        method = 'track.getinfo';
        if (params.mbid) {
          queryParams.set('mbid', params.mbid);
        } else {
          queryParams.set('artist', params.artist);
          queryParams.set('track', params.track);
        }
        break;
      case 'getTopArtists':
        method = 'chart.gettopartists';
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      case 'getTopTags':
        method = 'chart.gettoptags';
        if (params.limit) queryParams.set('limit', params.limit.toString());
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    queryParams.set('method', method);
    queryParams.set('api_key', apiKey);
    queryParams.set('format', 'json');

    const url = `${LASTFM_API}?${queryParams.toString()}`;
    console.log(`Fetching: ${LASTFM_API}?method=${method}&...`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    // Handle API key errors gracefully
    if (response.status === 403) {
      console.error('Last.fm API key is invalid, returning mock data');
      return new Response(JSON.stringify(getMockData(action, params)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Last.fm API error: ${response.status}`, errorText);
      // Return mock data instead of error for better UX
      return new Response(JSON.stringify(getMockData(action, params)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    
    // Check for Last.fm API errors in response
    if (data.error) {
      console.error(`Last.fm API error:`, data.message);
      // Return mock data for better UX
      return new Response(JSON.stringify(getMockData(action, params)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Last.fm response received`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Last.fm function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
