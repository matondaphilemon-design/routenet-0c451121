import { supabase } from "@/integrations/supabase/client";

// Types for API responses
export interface MusicBrainzArtist {
  id: string;
  name: string;
  "sort-name": string;
  country?: string;
  disambiguation?: string;
  score?: number;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  "artist-credit"?: Array<{ name: string; artist: MusicBrainzArtist }>;
  date?: string;
  country?: string;
  score?: number;
}

export interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number;
  "artist-credit"?: Array<{ name: string; artist: MusicBrainzArtist }>;
  score?: number;
}

export interface AudioDBArtist {
  idArtist: string;
  strArtist: string;
  strArtistThumb?: string;
  strArtistFanart?: string;
  strArtistBanner?: string;
  strBiographyEN?: string;
  strCountry?: string;
  strGenre?: string;
  intFormedYear?: string;
}

export interface AudioDBAlbum {
  idAlbum: string;
  strAlbum: string;
  strArtist: string;
  strAlbumThumb?: string;
  intYearReleased?: string;
  strDescriptionEN?: string;
  strGenre?: string;
}

export interface AudioDBTrack {
  idTrack: string;
  strTrack: string;
  strArtist: string;
  strAlbum?: string;
  intDuration?: string;
  strTrackThumb?: string;
}

export interface LastFmArtist {
  name: string;
  mbid?: string;
  url: string;
  image?: Array<{ "#text": string; size: string }>;
  listeners?: string;
  playcount?: string;
  bio?: { summary: string; content: string };
}

export interface LastFmTrack {
  name: string;
  artist: { name: string; mbid?: string } | string;
  mbid?: string;
  url: string;
  duration?: string;
  listeners?: string;
  playcount?: string;
  image?: Array<{ "#text": string; size: string }>;
}

export interface LastFmAlbum {
  name: string;
  artist: string;
  mbid?: string;
  url: string;
  image?: Array<{ "#text": string; size: string }>;
  playcount?: string;
}

// Deezer types
export interface DeezerArtist {
  id: number;
  name: string;
  picture: string;
  picture_small: string;
  picture_medium: string;
  picture_big: string;
  picture_xl: string;
  nb_album?: number;
  nb_fan?: number;
  tracklist: string;
}

export interface DeezerTrack {
  id: number;
  title: string;
  title_short: string;
  duration: number;
  rank: number;
  preview: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  cover: string;
  cover_small: string;
  cover_medium: string;
  cover_big: string;
  cover_xl: string;
  genre_id?: number;
  nb_tracks?: number;
  release_date?: string;
  artist?: DeezerArtist;
}

// Podcast types
export interface PodcastFeed {
  id: number;
  title: string;
  author: string;
  image: string;
  description?: string;
  categories?: Record<string, string>;
  episodeCount?: number;
}

export interface PodcastEpisode {
  id: number;
  title: string;
  feedTitle: string;
  feedImage: string;
  duration: number;
  datePublished: number;
  description?: string;
  enclosureUrl?: string;
}

// Unified types for the app
export interface UnifiedArtist {
  id: string;
  mbid?: string;
  deezerId?: number;
  name: string;
  avatar: string;
  banner?: string;
  bio?: string;
  country?: string;
  genre?: string;
  monthlyListeners: number;
}

export interface UnifiedTrack {
  id: string;
  mbid?: string;
  deezerId?: number;
  title: string;
  artist: string;
  album?: string;
  artwork: string;
  duration: number;
  preview?: string;
  youtubeId?: string;
  source?: "deezer" | "youtube" | "lastfm";
}

export interface UnifiedAlbum {
  id: string;
  mbid?: string;
  deezerId?: number;
  name: string;
  artist: string;
  artwork: string;
  year?: string;
  description?: string;
  genre?: string;
  trackCount?: number;
}

// Helper to get best image from Last.fm
function getLastFmImage(images?: Array<{ "#text": string; size: string }>): string {
  if (!images || images.length === 0) return "";
  const large = images.find(i => i.size === "extralarge" || i.size === "large");
  return large?.["#text"] || images[images.length - 1]?.["#text"] || "";
}

// MusicBrainz API calls
export async function searchMusicBrainz(type: 'artist' | 'release' | 'recording', query: string, limit = 10) {
  const { data, error } = await supabase.functions.invoke('musicbrainz', {
    body: { action: 'search', params: { type, query, limit } }
  });
  if (error) throw error;
  return data;
}

export async function lookupMusicBrainz(type: 'artist' | 'release' | 'recording', mbid: string, inc: string[] = []) {
  const { data, error } = await supabase.functions.invoke('musicbrainz', {
    body: { action: 'lookup', params: { type, mbid, inc } }
  });
  if (error) throw error;
  return data;
}

// TheAudioDB API calls
export async function searchAudioDBArtist(name: string): Promise<AudioDBArtist | null> {
  const { data, error } = await supabase.functions.invoke('theaudiodb', {
    body: { action: 'searchArtist', params: { name } }
  });
  if (error) throw error;
  return data?.artists?.[0] || null;
}

export async function getAudioDBAlbumsByArtist(artistId: string): Promise<AudioDBAlbum[]> {
  const { data, error } = await supabase.functions.invoke('theaudiodb', {
    body: { action: 'getAlbumsByArtist', params: { artistId } }
  });
  if (error) throw error;
  return data?.album || [];
}

export async function getAudioDBTracksFromAlbum(albumId: string): Promise<AudioDBTrack[]> {
  const { data, error } = await supabase.functions.invoke('theaudiodb', {
    body: { action: 'getTracksFromAlbum', params: { albumId } }
  });
  if (error) throw error;
  return data?.track || [];
}

export async function getTrendingAudioDB(country = 'us', type = 'itunes', format = 'albums') {
  const { data, error } = await supabase.functions.invoke('theaudiodb', {
    body: { action: 'getTrending', params: { country, type, format } }
  });
  if (error) throw error;
  return data?.trending || [];
}

// Last.fm API calls
export async function searchLastFmArtist(name: string, limit = 10): Promise<LastFmArtist[]> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'searchArtist', params: { name, limit } }
  });
  if (error) throw error;
  return data?.results?.artistmatches?.artist || [];
}

export async function getLastFmArtistInfo(name: string): Promise<LastFmArtist | null> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'getArtistInfo', params: { name } }
  });
  if (error) throw error;
  return data?.artist || null;
}

export async function getLastFmTopTracks(name: string, limit = 10): Promise<LastFmTrack[]> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'getTopTracks', params: { name, limit } }
  });
  if (error) throw error;
  return data?.toptracks?.track || [];
}

export async function getLastFmTopAlbums(name: string, limit = 10): Promise<LastFmAlbum[]> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'getTopAlbums', params: { name, limit } }
  });
  if (error) throw error;
  return data?.topalbums?.album || [];
}

export async function getSimilarArtists(name: string, limit = 10): Promise<LastFmArtist[]> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'getSimilarArtists', params: { name, limit } }
  });
  if (error) throw error;
  return data?.similarartists?.artist || [];
}

export async function searchLastFmTrack(track: string, artist?: string, limit = 10): Promise<LastFmTrack[]> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'searchTrack', params: { track, artist, limit } }
  });
  if (error) throw error;
  return data?.results?.trackmatches?.track || [];
}

export async function getChartTopArtists(limit = 20): Promise<LastFmArtist[]> {
  const { data, error } = await supabase.functions.invoke('lastfm', {
    body: { action: 'getTopArtists', params: { limit } }
  });
  if (error) throw error;
  return data?.artists?.artist || [];
}

// Cover Art Archive
export async function getCoverArt(mbid: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('coverart', {
    body: { action: 'getFront', params: { mbid } }
  });
  if (error) return null;
  return data?.thumbnails?.large || data?.imageUrl || null;
}

// Deezer API calls
export async function searchDeezerArtist(name: string, limit = 10): Promise<DeezerArtist[]> {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'searchArtist', params: { name, limit } }
  });
  if (error) throw error;
  return data?.data || [];
}

export async function searchDeezerTrack(query: string, limit = 10): Promise<DeezerTrack[]> {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'searchTrack', params: { query, limit } }
  });
  if (error) throw error;
  return data?.data || [];
}

export async function searchDeezerAlbum(query: string, limit = 10): Promise<DeezerAlbum[]> {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'searchAlbum', params: { query, limit } }
  });
  if (error) throw error;
  return data?.data || [];
}

export async function getDeezerArtist(artistId: number): Promise<DeezerArtist | null> {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'getArtist', params: { artistId } }
  });
  if (error) throw error;
  return data || null;
}

export async function getDeezerArtistTopTracks(artistId: number, limit = 10): Promise<DeezerTrack[]> {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'getArtistTopTracks', params: { artistId, limit } }
  });
  if (error) throw error;
  return data?.data || [];
}

export async function getDeezerArtistAlbums(artistId: number, limit = 20): Promise<DeezerAlbum[]> {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'getArtistAlbums', params: { artistId, limit } }
  });
  if (error) throw error;
  return data?.data || [];
}

export async function getDeezerChart(type: 'tracks' | 'albums' | 'artists' = 'tracks', limit = 20) {
  const { data, error } = await supabase.functions.invoke('deezer', {
    body: { action: 'getChart', params: { type, limit } }
  });
  if (error) throw error;
  return data?.data || [];
}

// Unified search function that combines multiple sources (Deezer + YouTube)
export async function searchAll(query: string): Promise<{
  artists: UnifiedArtist[];
  tracks: UnifiedTrack[];
  albums: UnifiedAlbum[];
}> {
  const [deezerArtists, deezerTracks, deezerAlbums, audioDbArtist, youtubeTracks] = await Promise.allSettled([
    searchDeezerArtist(query, 6),
    searchDeezerTrack(query, 10),
    searchDeezerAlbum(query, 6),
    searchAudioDBArtist(query),
    searchYouTubeVideos(`${query} official music`, 10),
  ]);

  const artists: UnifiedArtist[] = [];
  const tracks: UnifiedTrack[] = [];
  const albums: UnifiedAlbum[] = [];

  // Process Deezer artists
  if (deezerArtists.status === 'fulfilled') {
    for (const a of deezerArtists.value) {
      artists.push({
        id: `deezer-${a.id}`,
        deezerId: a.id,
        name: a.name,
        avatar: a.picture_medium || a.picture,
        monthlyListeners: a.nb_fan || 0,
      });
    }
  }

  // Enhance with AudioDB data if available
  if (audioDbArtist.status === 'fulfilled' && audioDbArtist.value && artists.length > 0) {
    const adb = audioDbArtist.value;
    const idx = artists.findIndex(a => a.name.toLowerCase() === adb.strArtist.toLowerCase());
    if (idx >= 0) {
      artists[idx] = {
        ...artists[idx],
        avatar: adb.strArtistThumb || artists[idx].avatar,
        banner: adb.strArtistBanner || adb.strArtistFanart,
        bio: adb.strBiographyEN,
        country: adb.strCountry,
        genre: adb.strGenre,
      };
    }
  }

  // Process Deezer tracks
  if (deezerTracks.status === 'fulfilled') {
    for (const t of deezerTracks.value) {
      tracks.push({
        id: `deezer-${t.id}`,
        deezerId: t.id,
        title: t.title,
        artist: t.artist?.name || 'Unknown',
        album: t.album?.title,
        artwork: t.album?.cover_medium || t.album?.cover || '',
        duration: t.duration,
        preview: t.preview,
        source: 'deezer',
      });
    }
  }

  // Process YouTube videos as playable tracks in the main Songs results.
  if (youtubeTracks.status === 'fulfilled') {
    const seen = new Set(tracks.map((t) => `${t.title}|${t.artist}`.toLowerCase()));
    for (const video of youtubeTracks.value) {
      const cleaned = (video.title || "")
        .replace(/\s*[\(\[](official|lyrics?|audio|video|visualizer|hd|4k)[^\)\]]*[\)\]]\s*/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!video.id || !cleaned) continue;
      const split = cleaned.split(/\s+[-–—]\s+/);
      const channel = (video.channelTitle || "YouTube").replace(/\s*-\s*Topic$/i, "").trim();
      const artist = split.length > 1 ? split[0].trim() : channel;
      const title = split.length > 1 ? split.slice(1).join(" - ").trim() : cleaned;
      const key = `${title}|${artist}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push({
        id: `youtube-${video.id}`,
        title,
        artist,
        album: "YouTube Music",
        artwork: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        duration: typeof video.duration === "number" ? video.duration : Number(video.duration) || 0,
        youtubeId: video.id,
        source: 'youtube',
      });
    }
  }

  // Process Deezer albums
  if (deezerAlbums.status === 'fulfilled') {
    for (const a of deezerAlbums.value) {
      albums.push({
        id: `deezer-${a.id}`,
        deezerId: a.id,
        name: a.title,
        artist: a.artist?.name || 'Unknown',
        artwork: a.cover_medium || a.cover || '',
        trackCount: a.nb_tracks,
      });
    }
  }

  return { artists, tracks, albums };
}

// Get full artist details
export async function getArtistDetails(name: string): Promise<{
  artist: UnifiedArtist | null;
  topTracks: UnifiedTrack[];
  albums: UnifiedAlbum[];
  similar: UnifiedArtist[];
}> {
  const [lastFmInfo, audioDbArtist, topTracks, topAlbums, similar] = await Promise.allSettled([
    getLastFmArtistInfo(name),
    searchAudioDBArtist(name),
    getLastFmTopTracks(name, 10),
    getLastFmTopAlbums(name, 10),
    getSimilarArtists(name, 6),
  ]);

  let artist: UnifiedArtist | null = null;

  // Build unified artist from Last.fm
  if (lastFmInfo.status === 'fulfilled' && lastFmInfo.value) {
    const lfm = lastFmInfo.value;
    artist = {
      id: lfm.mbid || lfm.name,
      mbid: lfm.mbid,
      name: lfm.name,
      avatar: getLastFmImage(lfm.image),
      bio: lfm.bio?.summary?.replace(/<[^>]*>/g, ''),
      monthlyListeners: parseInt(lfm.listeners || '0', 10),
    };
  }

  // Enhance with AudioDB
  if (audioDbArtist.status === 'fulfilled' && audioDbArtist.value) {
    const adb = audioDbArtist.value;
    if (artist) {
      artist.avatar = adb.strArtistThumb || artist.avatar;
      artist.banner = adb.strArtistBanner || adb.strArtistFanart;
      artist.bio = adb.strBiographyEN || artist.bio;
      artist.country = adb.strCountry;
      artist.genre = adb.strGenre;
    } else {
      artist = {
        id: adb.idArtist,
        name: adb.strArtist,
        avatar: adb.strArtistThumb || '',
        banner: adb.strArtistBanner || adb.strArtistFanart,
        bio: adb.strBiographyEN,
        country: adb.strCountry,
        genre: adb.strGenre,
        monthlyListeners: 0,
      };
    }
  }

  // Process top tracks
  const unifiedTracks: UnifiedTrack[] = [];
  if (topTracks.status === 'fulfilled') {
    for (const t of topTracks.value) {
      const artistName = typeof t.artist === 'string' ? t.artist : t.artist?.name || name;
      unifiedTracks.push({
        id: t.mbid || `${t.name}-${artistName}`,
        mbid: t.mbid,
        title: t.name,
        artist: artistName,
        artwork: getLastFmImage(t.image) || artist?.avatar || '',
        duration: parseInt(t.duration || '0', 10) || 180,
      });
    }
  }

  // Process albums
  const unifiedAlbums: UnifiedAlbum[] = [];
  if (topAlbums.status === 'fulfilled') {
    for (const a of topAlbums.value) {
      unifiedAlbums.push({
        id: a.mbid || `${a.name}-${a.artist}`,
        mbid: a.mbid,
        name: a.name,
        artist: a.artist,
        artwork: getLastFmImage(a.image),
      });
    }
  }

  // Process similar artists
  const unifiedSimilar: UnifiedArtist[] = [];
  if (similar.status === 'fulfilled') {
    for (const s of similar.value) {
      unifiedSimilar.push({
        id: s.mbid || s.name,
        mbid: s.mbid,
        name: s.name,
        avatar: getLastFmImage(s.image),
        monthlyListeners: 0,
      });
    }
  }

  return {
    artist,
    topTracks: unifiedTracks,
    albums: unifiedAlbums,
    similar: unifiedSimilar,
  };
}

// Podcast API calls
export async function getTrendingPodcasts(limit = 10): Promise<PodcastFeed[]> {
  const { data, error } = await supabase.functions.invoke('podcast', {
    body: { action: 'getTrendingPodcasts', params: { limit } }
  });
  if (error) throw error;
  return data?.feeds || [];
}

export async function getRecentEpisodes(limit = 10): Promise<PodcastEpisode[]> {
  const { data, error } = await supabase.functions.invoke('podcast', {
    body: { action: 'getRecentEpisodes', params: { limit } }
  });
  if (error) throw error;
  return data?.episodes || [];
}

export async function getRandomEpisodes(limit = 10): Promise<PodcastEpisode[]> {
  const { data, error } = await supabase.functions.invoke('podcast', {
    body: { action: 'getRandomEpisodes', params: { limit } }
  });
  if (error) throw error;
  return data?.episodes || [];
}

export async function searchPodcasts(query: string, limit = 10): Promise<PodcastFeed[]> {
  const { data, error } = await supabase.functions.invoke('podcast', {
    body: { action: 'searchPodcasts', params: { query, limit } }
  });
  if (error) throw error;
  return data?.feeds || [];
}

export async function getEpisodesByPodcast(feedId: number, limit = 20): Promise<PodcastEpisode[]> {
  const { data, error } = await supabase.functions.invoke('podcast', {
    body: { action: 'getEpisodesByPodcast', params: { feedId, limit } }
  });
  if (error) throw error;
  return data?.items || [];
}

// YouTube API types
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string | number;
  viewCount?: string;
}

// YouTube API calls
export async function searchYouTubeVideos(query: string, maxResults = 10): Promise<YouTubeVideo[]> {
  const { data, error } = await supabase.functions.invoke('youtube', {
    body: { action: 'search', params: { query, maxResults } }
  });
  if (error) throw error;
  return data?.items || data?.results || data?.videos || [];
}

export async function getYouTubeVideo(videoId: string): Promise<YouTubeVideo | null> {
  const { data, error } = await supabase.functions.invoke('youtube', {
    body: { action: 'getVideo', params: { videoId } }
  });
  if (error) throw error;
  return data || null;
}

export async function getTrendingYouTubeMusic(maxResults = 10): Promise<YouTubeVideo[]> {
  const { data, error } = await supabase.functions.invoke('youtube', {
    body: { action: 'getTrending', params: { maxResults } }
  });
  if (error) throw error;
  return data?.items || [];
}

// Album tracklist types
export interface AlbumTrack {
  title: string;
  artist: string;
  album: string;
  position: number;
  duration?: number;
  youtubeId?: string;
  youtubeThumbnail?: string;
}

export interface AlbumWithTracks {
  album: {
    title: string;
    artist: string;
    mbid: string;
  } | null;
  tracks: AlbumTrack[];
}

// Get album tracklist from MusicBrainz
export async function getAlbumTracklist(albumName: string, artistName?: string): Promise<AlbumWithTracks> {
  const { data, error } = await supabase.functions.invoke('musicbrainz', {
    body: { action: 'getAlbumTracklist', params: { albumName, artistName } }
  });
  if (error) throw error;
  return data || { album: null, tracks: [] };
}

// Get artist discography from MusicBrainz
export async function getArtistDiscography(artistName: string, limit = 10): Promise<{
  artist: { name: string; mbid: string } | null;
  albums: Array<{ title: string; year?: string; mbid: string; type?: string }>;
}> {
  const { data, error } = await supabase.functions.invoke('musicbrainz', {
    body: { action: 'getArtistDiscography', params: { artistName, limit } }
  });
  if (error) throw error;
  return data || { artist: null, albums: [] };
}

// Batch search YouTube for album tracks
export async function getAlbumWithYouTubeLinks(albumName: string, artistName?: string): Promise<AlbumWithTracks> {
  // First get the album tracklist from MusicBrainz
  const albumData = await getAlbumTracklist(albumName, artistName);
  
  if (!albumData.tracks.length) {
    return albumData;
  }

  // Then search YouTube for each track (batch with Promise.allSettled)
  const searchPromises = albumData.tracks.map(async (track) => {
    try {
      const results = await searchYouTubeVideos(`${track.title} ${track.artist}`, 1);
      if (results.length > 0) {
        return {
          ...track,
          youtubeId: results[0].id,
          youtubeThumbnail: results[0].thumbnail,
        };
      }
      return track;
    } catch {
      return track;
    }
  });

  const tracksWithYouTube = await Promise.allSettled(searchPromises);
  
  return {
    album: albumData.album,
    tracks: tracksWithYouTube.map((result, index) => 
      result.status === 'fulfilled' ? result.value : albumData.tracks[index]
    ),
  };
}

// Check YouTube cache first before searching
export async function getCachedYouTubeVideo(title: string, artist: string): Promise<YouTubeVideo | null> {
  try {
    const { data, error } = await supabase
      .from('youtube_cache')
      .select('*')
      .ilike('title', `%${title}%`)
      .ilike('artist', `%${artist}%`)
      .limit(1)
      .single();
    
    if (error || !data) return null;
    
    return {
      id: data.video_id,
      title: data.video_title,
      description: '',
      thumbnail: data.thumbnail || '',
      channelTitle: data.channel_title || '',
      publishedAt: data.created_at,
      duration: data.duration?.toString(),
    };
  } catch {
    return null;
  }
}

// Smart search: check cache first, then search
export async function smartYouTubeSearch(title: string, artist: string): Promise<YouTubeVideo | null> {
  // Check cache first
  const cached = await getCachedYouTubeVideo(title, artist);
  if (cached) {
    console.log(`Cache hit for: ${title} - ${artist}`);
    return cached;
  }
  
  // Search if not in cache
  const results = await searchYouTubeVideos(`${title} ${artist}`, 1);
  return results[0] || null;
}

// DJ-specific functions to get mood-based tracks from Deezer
export async function getDJTracks(mood: string, limit = 10): Promise<UnifiedTrack[]> {
  // Map moods to search queries that work well with Deezer
  const moodQueries: Record<string, string[]> = {
    "chill": ["chill", "relax", "ambient", "lo-fi"],
    "energy": ["workout", "electronic", "edm", "dance"],
    "focus": ["focus", "study", "instrumental", "piano"],
    "party": ["party", "dance", "club", "pop hits"],
    "sad": ["sad", "emotional", "acoustic", "ballad"],
    "happy": ["happy", "feel good", "upbeat", "summer"],
    "morning energy": ["morning", "wake up", "energetic pop"],
    "focus flow": ["focus", "concentration", "instrumental"],
    "midday vibes": ["pop hits", "trending", "radio"],
    "afternoon chill": ["chill", "afternoon", "easy listening"],
    "evening wind-down": ["evening", "sunset", "mellow"],
    "night drive": ["night drive", "synthwave", "late night"],
    "late night chill": ["late night", "ambient", "lo-fi beats"],
  };

  // Find matching queries or default
  const lowerMood = mood.toLowerCase();
  let queries = moodQueries[lowerMood];
  if (!queries) {
    const key = Object.keys(moodQueries).find(k => lowerMood.includes(k));
    queries = key ? moodQueries[key] : ["popular", "trending", "hits"];
  }

  // Pick a random query from the mood's options
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  try {
    const tracks = await searchDeezerTrack(query, limit);
    return tracks.map(t => ({
      id: `deezer-${t.id}`,
      deezerId: t.id,
      title: t.title,
      artist: t.artist?.name || 'Unknown',
      album: t.album?.title,
      artwork: t.album?.cover_medium || t.album?.cover || '',
      duration: t.duration,
      preview: t.preview,
    }));
  } catch (error) {
    console.error('Failed to fetch DJ tracks from Deezer:', error);
    return [];
  }
}

// Get chart tracks for DJ fallback
export async function getDJChartTracks(limit = 20): Promise<UnifiedTrack[]> {
  try {
    const tracks = await getDeezerChart('tracks', limit);
    return tracks.map((t: DeezerTrack) => ({
      id: `deezer-${t.id}`,
      deezerId: t.id,
      title: t.title,
      artist: t.artist?.name || 'Unknown',
      album: t.album?.title,
      artwork: t.album?.cover_medium || t.album?.cover || '',
      duration: t.duration,
      preview: t.preview,
    }));
  } catch (error) {
    console.error('Failed to fetch chart tracks:', error);
    return [];
  }
}
