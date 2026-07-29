import { useState, useCallback } from "react";
import { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { getCachedYouTubeId, cacheYouTubeId } from "@/components/player/GlobalAudioPlayer";

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: number;
}

// Search YouTube for a track — NO firecrawl, YouTube API only
export async function searchYouTubeForTrack(track: Track): Promise<string | null> {
  // Check in-memory cache first
  const memCached = getCachedYouTubeId(track.title, track.artist);
  if (memCached) {
    console.log(`[YT Search] Memory cache hit: ${memCached}`);
    return memCached;
  }

  try {
    console.log(`Searching YouTube for: ${track.artist} - ${track.title}`);

    // Prioritize official audio, then official music video
    const searchQueries = [
      `${track.artist} ${track.title} official audio`,
      `${track.artist} ${track.title} official music video`,
      `${track.artist} ${track.title}`,
    ];

    for (const searchQuery of searchQueries) {
      try {
        const { data: fallbackData } = await supabase.functions.invoke("youtube", {
          body: {
            action: "search",
            params: { query: searchQuery, maxResults: 3 },
          },
        });

        const items = fallbackData?.items || [];
        
        // Filter: prefer official channels, exclude live/remix/cover
        for (const item of items) {
          const videoId = typeof item?.id === "string" ? item.id : item?.id?.videoId;
          if (!videoId) continue;

          const title = (item?.snippet?.title || "").toLowerCase();
          const badKeywords = ["live", "remix", "cover", "slowed", "reverb", "speed up", "mashup", "karaoke", "instrumental"];
          const hasBadKeyword = badKeywords.some(kw => title.includes(kw));
          
          // Skip bad results unless it's our last resort
          if (hasBadKeyword && searchQueries.indexOf(searchQuery) < searchQueries.length - 1) continue;

          console.log(`Found via YouTube: ${videoId} (query: ${searchQuery})`);
          cacheYouTubeId(track.title, track.artist, videoId);
          return videoId;
        }
      } catch (e) {
        console.warn(`[YT Search] Query failed: ${searchQuery}`, e);
      }
    }

    return null;
  } catch (e) {
    console.error("YouTube search failed:", e);
    return null;
  }
}

// Batch search multiple tracks (for preloading)
export async function searchYouTubeForTracks(tracks: Track[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Simple sequential search — no firecrawl batch
  for (const track of tracks.slice(0, 5)) {
    try {
      const id = await searchYouTubeForTrack(track);
      if (id) results.set(track.id, id);
    } catch {}
  }

  return results;
}

// Hook to manage YouTube playback for tracks
export function useYouTubePlayback() {
  const [isSearching, setIsSearching] = useState(false);
  const [currentYouTubeId, setCurrentYouTubeId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const getYouTubeId = useCallback(async (track: Track): Promise<string | null> => {
    setSearchError(null);

    if (track.youtubeId) {
      setCurrentYouTubeId(track.youtubeId);
      return track.youtubeId;
    }

    const memCached = getCachedYouTubeId(track.title, track.artist);
    if (memCached) {
      setCurrentYouTubeId(memCached);
      track.youtubeId = memCached;
      return memCached;
    }

    setIsSearching(true);
    try {
      const videoId = await searchYouTubeForTrack(track);
      if (videoId) {
        setCurrentYouTubeId(videoId);
        track.youtubeId = videoId;
        return videoId;
      } else {
        setSearchError("Could not find video");
        return null;
      }
    } catch (e) {
      setSearchError("Search failed");
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearYouTubeId = useCallback(() => {
    setCurrentYouTubeId(null);
    setSearchError(null);
  }, []);

  return {
    isSearching,
    currentYouTubeId,
    searchError,
    getYouTubeId,
    clearYouTubeId,
  };
}
