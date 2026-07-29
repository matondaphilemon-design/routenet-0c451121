import { useEffect, useRef, useCallback } from "react";
import { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { cacheYouTubeId, getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";

// Store for preloaded YouTube IDs (shared across components)
const preloadedCache = new Map<string, string>();
const pendingRequests = new Set<string>();

// Get a unique key for a track
function getTrackKey(track: Track): string {
  return `${track.artist}-${track.title}`.toLowerCase();
}

// Check if track is already preloaded
export function getPreloadedYouTubeId(track: Track): string | undefined {
  return preloadedCache.get(getTrackKey(track));
}

// Hook to preload YouTube links for visible tracks
export function usePreloadYouTube(tracks: Track[], enabled: boolean = true) {
  const preloadedRef = useRef<Set<string>>(new Set());

  const preloadTracks = useCallback(async (tracksToPreload: Track[]) => {
    if (tracksToPreload.length === 0) return;

    // Filter out already preloaded or pending tracks
    const newTracks = tracksToPreload.filter(track => {
      const key = getTrackKey(track);
      return !preloadedCache.has(key) && 
             !pendingRequests.has(key) && 
             !preloadedRef.current.has(key) &&
             !track.youtubeId &&
             !getCachedYouTubeId(track.title, track.artist);
    });

    if (newTracks.length === 0) return;

    // Mark as pending
    newTracks.forEach(track => pendingRequests.add(getTrackKey(track)));

    console.log(`[Preload] Starting preload for ${newTracks.length} tracks`);

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-youtube", {
        body: {
          action: "searchMultiple",
          params: {
            tracks: newTracks.slice(0, 10).map(t => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
            })),
          },
        },
      });

      if (!error && data?.success && data?.results) {
        for (const result of data.results) {
          if (result.videoId) {
            const track = newTracks.find(t => t.id === result.trackId);
            if (track) {
              const key = getTrackKey(track);
              preloadedCache.set(key, result.videoId);
              preloadedRef.current.add(key);
              track.youtubeId = result.videoId;
              // Also populate in-memory cache in GlobalAudioPlayer
              cacheYouTubeId(track.title, track.artist, result.videoId);
              console.log(`[Preload] Cached: ${track.artist} - ${track.title} (${result.fromCache ? 'from cache' : 'new'})`);
            }
          }
        }
      }
    } catch (e) {
      console.error("[Preload] Error:", e);
    } finally {
      newTracks.forEach(track => pendingRequests.delete(getTrackKey(track)));
    }
  }, []);

  useEffect(() => {
    if (!enabled || tracks.length === 0) return;

    const timer = setTimeout(() => {
      preloadTracks(tracks);
    }, 100);

    return () => clearTimeout(timer);
  }, [tracks, enabled, preloadTracks]);

  return {
    getPreloadedId: (track: Track) => getPreloadedYouTubeId(track),
    isPreloaded: (track: Track) => preloadedCache.has(getTrackKey(track)) || !!track.youtubeId,
    preloadCount: preloadedRef.current.size,
  };
}
