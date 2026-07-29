import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTracksUnified, type SearchTrack } from '@/services/searchEngine';
import {
  searchAll,
  getArtistDetails,
  getChartTopArtists,
  getTrendingAudioDB,
  getDeezerChart,
  getTrendingPodcasts,
  getRecentEpisodes,
  getRandomEpisodes,
  searchYouTubeVideos,
  getTrendingYouTubeMusic,
  UnifiedArtist,
  UnifiedTrack,
  UnifiedAlbum,
  DeezerTrack,
  DeezerArtist,
  DeezerAlbum,
  PodcastFeed,
  PodcastEpisode,
  YouTubeVideo,
} from '@/services/musicApi';

export function useSearchMusic(query: string) {
  return useQuery({
    queryKey: ['music-search', query],
    queryFn: () => searchAll(query),
    enabled: query.length >= 2,
    staleTime: 30 * 60 * 1000, // 30 minutes - keep cached results fresh
    gcTime: 60 * 60 * 1000, // 1 hour - retain in memory for instant re-search
  });
}

/**
 * Piped-first song search enriched with Deezer metadata.
 * Playback source: YouTube/Piped. Metadata: Deezer, falling back to Piped.
 */
export function useUnifiedTrackSearch(query: string) {
  return useQuery<SearchTrack[]>({
    queryKey: ['unified-search', query],
    queryFn: () => searchTracksUnified(query, 24),
    enabled: query.length >= 2,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useArtistDetails(artistName: string) {
  return useQuery({
    queryKey: ['artist-details', artistName],
    queryFn: () => getArtistDetails(artistName),
    enabled: !!artistName,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// New: Fetch artist from Deezer by searching name
export function useDeezerArtist(artistName: string) {
  return useQuery({
    queryKey: ['deezer-artist', artistName],
    queryFn: async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // First search for artist by name
      const { data: searchData } = await supabase.functions.invoke('deezer', {
        body: { action: 'searchArtist', params: { name: artistName, limit: 1 } },
      });
      
      if (!searchData?.data?.[0]) return null;
      
      const artist = searchData.data[0];
      
      // Then get their top tracks
      const { data: tracksData } = await supabase.functions.invoke('deezer', {
        body: { action: 'getArtistTopTracks', params: { artistId: artist.id, limit: 15 } },
      });
      
      // Get albums
      const { data: albumsData } = await supabase.functions.invoke('deezer', {
        body: { action: 'getArtistAlbums', params: { artistId: artist.id, limit: 10 } },
      });
      
      return {
        artist: {
          id: artist.id,
          name: artist.name,
          picture: artist.picture_xl || artist.picture_big || artist.picture_medium,
          nb_fan: artist.nb_fan,
        },
        tracks: tracksData?.data || [],
        albums: albumsData?.data || [],
      };
    },
    enabled: !!artistName,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// New: Fetch album details from Deezer by album ID
export function useDeezerAlbum(albumId: string) {
  return useQuery({
    queryKey: ['deezer-album', albumId],
    queryFn: async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data } = await supabase.functions.invoke('deezer', {
        body: { action: 'getAlbum', params: { albumId } },
      });
      
      return data;
    },
    enabled: !!albumId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useTopArtists(limit = 20) {
  return useQuery({
    queryKey: ['top-artists', limit],
    queryFn: () => getChartTopArtists(limit),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,
  });
}

export function useTrendingAlbums(country = 'us') {
  return useQuery({
    queryKey: ['trending-albums', country],
    queryFn: () => getTrendingAudioDB(country, 'itunes', 'albums'),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useDeezerChartTracks(limit = 20) {
  return useQuery<DeezerTrack[]>({
    queryKey: ['deezer-chart-tracks', limit],
    queryFn: () => getDeezerChart('tracks', limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useDeezerChartArtists(limit = 20) {
  return useQuery<DeezerArtist[]>({
    queryKey: ['deezer-chart-artists', limit],
    queryFn: () => getDeezerChart('artists', limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useDeezerChartAlbums(limit = 20) {
  return useQuery<DeezerAlbum[]>({
    queryKey: ['deezer-chart-albums', limit],
    queryFn: () => getDeezerChart('albums', limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Podcast/Episodes from YouTube hooks
export function useYouTubePodcasts(limit = 6) {
  return useQuery<YouTubeVideo[]>({
    queryKey: ['youtube-podcasts', limit],
    queryFn: () => searchYouTubeVideos('podcast interview 2024', limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useYouTubeEpisodes(limit = 6) {
  return useQuery<YouTubeVideo[]>({
    queryKey: ['youtube-episodes', limit],
    queryFn: () => searchYouTubeVideos('podcast episode trending', limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Keep legacy hooks for backwards compatibility (now deprecated)
export function useTrendingPodcasts(limit = 6) {
  return useYouTubePodcasts(limit);
}

export function useRecentEpisodes(limit = 6) {
  return useYouTubeEpisodes(limit);
}

export function useRandomEpisodes(limit = 6) {
  return useYouTubeEpisodes(limit);
}

// YouTube hooks
export function useYouTubeSearch(query: string) {
  return useQuery<YouTubeVideo[]>({
    queryKey: ['youtube-search', query],
    queryFn: () => searchYouTubeVideos(query, 8),
    enabled: query.length >= 2,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useTrendingYouTubeMusic(limit = 10) {
  return useQuery<YouTubeVideo[]>({
    queryKey: ['youtube-trending', limit],
    queryFn: () => getTrendingYouTubeMusic(limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Debounced search hook
export function useDebouncedSearch(delay = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [query, setQuery] = useState('');
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const id = setTimeout(() => {
      setDebouncedQuery(newQuery);
    }, delay);
    
    setTimeoutId(id);
  }, [delay, timeoutId]);

  return {
    query,
    debouncedQuery,
    setQuery: updateQuery,
    clearQuery: () => {
      setQuery('');
      setDebouncedQuery('');
    },
  };
}
