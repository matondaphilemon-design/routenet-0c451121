import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TheAudioDB free API key (public, for testing)
const AUDIODB_API = 'https://theaudiodb.com/api/v1/json/2';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`TheAudioDB API: action=${action}`, params);

    let url: string;
    
    switch (action) {
      case 'searchArtist':
        url = `${AUDIODB_API}/search.php?s=${encodeURIComponent(params.name)}`;
        break;
      case 'getArtist':
        url = `${AUDIODB_API}/artist.php?i=${params.artistId}`;
        break;
      case 'getArtistByMBID':
        url = `${AUDIODB_API}/artist-mb.php?i=${params.mbid}`;
        break;
      case 'getAlbumsByArtist':
        url = `${AUDIODB_API}/album.php?i=${params.artistId}`;
        break;
      case 'getAlbum':
        url = `${AUDIODB_API}/album.php?m=${params.albumId}`;
        break;
      case 'getAlbumByMBID':
        url = `${AUDIODB_API}/album-mb.php?i=${params.mbid}`;
        break;
      case 'getTracksFromAlbum':
        url = `${AUDIODB_API}/track.php?m=${params.albumId}`;
        break;
      case 'searchAlbum':
        url = `${AUDIODB_API}/searchalbum.php?s=${encodeURIComponent(params.artist)}&a=${encodeURIComponent(params.album)}`;
        break;
      case 'getTrending':
        url = `${AUDIODB_API}/trending.php?country=${params.country || 'us'}&type=${params.type || 'itunes'}&format=${params.format || 'albums'}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TheAudioDB API error: ${response.status}`, errorText);
      throw new Error(`TheAudioDB API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`TheAudioDB response received`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TheAudioDB function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
