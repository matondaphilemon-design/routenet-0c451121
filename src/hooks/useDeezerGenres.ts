import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeezerGenre {
  id: number;
  name: string;
  picture: string;
  picture_medium: string;
  picture_big: string;
}

// Fetch all Deezer genres
export function useDeezerGenres() {
  return useQuery<DeezerGenre[]>({
    queryKey: ['deezer-genres'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('deezer', {
        body: { action: 'getGenres', params: {} },
      });
      return data?.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000,
  });
}

// Search tracks by genre/mood query (e.g. "pop hits 2026", "chill vibes")
export function useDeezerSearchTracks(query: string, limit = 10) {
  return useQuery({
    queryKey: ['deezer-search-tracks', query, limit],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('deezer', {
        body: { action: 'searchTrack', params: { query, limit } },
      });
      return data?.data || [];
    },
    enabled: !!query,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Fetch radio stations from Deezer
export function useDeezerRadio() {
  return useQuery({
    queryKey: ['deezer-radio'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('deezer', {
        body: { action: 'getRadio', params: {} },
      });
      return data?.data || [];
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}

// Fetch genre-specific artists
export function useDeezerGenreArtists(genreId: number, limit = 15) {
  return useQuery({
    queryKey: ['deezer-genre-artists', genreId, limit],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('deezer', {
        body: { action: 'getGenreArtists', params: { genreId, limit } },
      });
      return data?.data || [];
    },
    enabled: genreId > 0,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Multiple genre-based track searches for variety
const GENRE_QUERIES = [
  'pop hits 2025', 'hip hop trending', 'r&b new releases', 'afrobeats hot',
  'latin reggaeton', 'indie rock new', 'electronic dance', 'chill lofi',
  'country top', 'k-pop trending', 'jazz smooth', 'gospel worship',
  'rock alternative', 'soul funk', 'classical popular',
];

export function useDiverseTracks() {
  // Pick 6 random genre queries per session to avoid over-fetching
  const selectedQueries = useQuery({
    queryKey: ['diverse-track-queries'],
    queryFn: () => {
      const shuffled = [...GENRE_QUERIES].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 6);
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const queries = selectedQueries.data || GENRE_QUERIES.slice(0, 6);

  const results = queries.map((q) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['deezer-genre-tracks', q],
      queryFn: async () => {
        const { data } = await supabase.functions.invoke('deezer', {
          body: { action: 'searchTrack', params: { query: q, limit: 8 } },
        });
        return { query: q, tracks: data?.data || [] };
      },
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    })
  );

  return results;
}
