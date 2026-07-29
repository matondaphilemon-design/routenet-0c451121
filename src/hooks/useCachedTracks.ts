import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheYouTubeId } from '@/components/player/GlobalAudioPlayer';

interface CachedTrack {
  title: string;
  artist: string;
  video_id: string;
}

// In-memory cache for quick lookups
const cachedTrackSet = new Set<string>();

function generateCacheKey(title: string, artist: string): string {
  return `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;
}

export function useCachedTracks() {
  return useQuery({
    queryKey: ['youtube-cached-tracks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_cache')
        .select('title, artist, video_id');
      
      if (error) {
        console.error('Error fetching cached tracks:', error);
        return [];
      }
      
      // Populate the in-memory set AND the GlobalAudioPlayer cache for quick lookups
      cachedTrackSet.clear();
      data?.forEach((track) => {
        const key = generateCacheKey(track.title, track.artist);
        cachedTrackSet.add(key);
        // Populate the central in-memory cache so playback doesn't need DB lookup
        cacheYouTubeId(track.title, track.artist, track.video_id);
      });
      
      console.log(`[CachedTracks] Loaded ${data?.length || 0} cached YouTube IDs into memory`);
      return data as CachedTrack[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Quick check function that doesn't need React hooks
export function isTrackCached(title: string, artist: string): boolean {
  const key = generateCacheKey(title, artist);
  return cachedTrackSet.has(key);
}

// Add a track to the cache set (called when a new track is cached)
export function addToCacheSet(title: string, artist: string): void {
  const key = generateCacheKey(title, artist);
  cachedTrackSet.add(key);
}
