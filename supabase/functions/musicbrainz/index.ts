import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'EchoTunes/1.0.0 (contact@echotunes.app)';

interface SearchParams {
  type: 'artist' | 'release' | 'recording' | 'release-group';
  query: string;
  limit?: number;
}

interface LookupParams {
  type: 'artist' | 'release' | 'recording' | 'release-group';
  mbid: string;
  inc?: string[];
}

interface AlbumTracklistParams {
  albumName: string;
  artistName?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`MusicBrainz API: action=${action}`, params);

    let result: any;
    
    if (action === 'search') {
      const { type, query, limit = 10 } = params as SearchParams;
      const url = `${MUSICBRAINZ_API}/${type}?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`;
      result = await fetchMusicBrainz(url);
    } else if (action === 'lookup') {
      const { type, mbid, inc = [] } = params as LookupParams;
      const incParam = inc.length > 0 ? `&inc=${inc.join('+')}` : '';
      const url = `${MUSICBRAINZ_API}/${type}/${mbid}?fmt=json${incParam}`;
      result = await fetchMusicBrainz(url);
    } else if (action === 'getAlbumTracklist') {
      // NEW: Fetch album tracklist for batch YouTube searching
      const { albumName, artistName } = params as AlbumTracklistParams;
      result = await getAlbumTracklist(albumName, artistName);
    } else if (action === 'getArtistDiscography') {
      // NEW: Get artist's discography with albums and tracks
      const { artistName, limit = 10 } = params;
      result = await getArtistDiscography(artistName, limit);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('MusicBrainz function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchMusicBrainz(url: string) {
  console.log(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`MusicBrainz API error: ${response.status}`, errorText);
    throw new Error(`MusicBrainz API error: ${response.status}`);
  }

  return await response.json();
}

async function getAlbumTracklist(albumName: string, artistName?: string): Promise<{
  album: { title: string; artist: string; mbid: string } | null;
  tracks: Array<{ title: string; artist: string; album: string; position: number; duration?: number }>;
}> {
  try {
    // Search for the album (release)
    const query = artistName 
      ? `release:${albumName} AND artist:${artistName}` 
      : `release:${albumName}`;
    
    const searchUrl = `${MUSICBRAINZ_API}/release?query=${encodeURIComponent(query)}&limit=1&fmt=json`;
    const searchResult = await fetchMusicBrainz(searchUrl);
    
    if (!searchResult.releases || searchResult.releases.length === 0) {
      console.log(`Album not found: ${albumName}`);
      return { album: null, tracks: [] };
    }

    const release = searchResult.releases[0];
    const releaseId = release.id;
    const albumTitle = release.title;
    const albumArtist = release['artist-credit']?.[0]?.name || artistName || 'Unknown Artist';

    console.log(`Found album: ${albumTitle} by ${albumArtist} (${releaseId})`);

    // Fetch release with recordings (tracks)
    const lookupUrl = `${MUSICBRAINZ_API}/release/${releaseId}?inc=recordings+artist-credits&fmt=json`;
    const releaseDetails = await fetchMusicBrainz(lookupUrl);

    const tracks: Array<{ title: string; artist: string; album: string; position: number; duration?: number }> = [];

    // Extract tracks from all media (discs)
    if (releaseDetails.media) {
      for (const medium of releaseDetails.media) {
        if (medium.tracks) {
          for (const track of medium.tracks) {
            const recording = track.recording;
            tracks.push({
              title: recording?.title || track.title,
              artist: recording?.['artist-credit']?.[0]?.name || albumArtist,
              album: albumTitle,
              position: track.position,
              duration: recording?.length ? Math.floor(recording.length / 1000) : undefined,
            });
          }
        }
      }
    }

    console.log(`Found ${tracks.length} tracks for album: ${albumTitle}`);

    return {
      album: {
        title: albumTitle,
        artist: albumArtist,
        mbid: releaseId,
      },
      tracks: tracks.sort((a, b) => a.position - b.position),
    };
  } catch (error) {
    console.error('Error fetching album tracklist:', error);
    return { album: null, tracks: [] };
  }
}

async function getArtistDiscography(artistName: string, limit: number): Promise<{
  artist: { name: string; mbid: string } | null;
  albums: Array<{ title: string; year?: string; mbid: string; type?: string }>;
}> {
  try {
    // Search for the artist
    const searchUrl = `${MUSICBRAINZ_API}/artist?query=artist:${encodeURIComponent(artistName)}&limit=1&fmt=json`;
    const searchResult = await fetchMusicBrainz(searchUrl);

    if (!searchResult.artists || searchResult.artists.length === 0) {
      console.log(`Artist not found: ${artistName}`);
      return { artist: null, albums: [] };
    }

    const artist = searchResult.artists[0];
    const artistId = artist.id;

    console.log(`Found artist: ${artist.name} (${artistId})`);

    // Fetch artist's release-groups (albums)
    const releaseGroupsUrl = `${MUSICBRAINZ_API}/release-group?artist=${artistId}&type=album&limit=${limit}&fmt=json`;
    const releaseGroupsResult = await fetchMusicBrainz(releaseGroupsUrl);

    const albums = (releaseGroupsResult['release-groups'] || []).map((rg: any) => ({
      title: rg.title,
      year: rg['first-release-date']?.substring(0, 4),
      mbid: rg.id,
      type: rg['primary-type'],
    }));

    console.log(`Found ${albums.length} albums for artist: ${artist.name}`);

    return {
      artist: {
        name: artist.name,
        mbid: artistId,
      },
      albums,
    };
  } catch (error) {
    console.error('Error fetching artist discography:', error);
    return { artist: null, albums: [] };
  }
}
