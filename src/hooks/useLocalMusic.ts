/**
 * Hook to access local music files from device storage.
 * Uses the File System Access API where available, falls back to input[type=file].
 */
import { useState, useCallback } from "react";
import { Track } from "@/data/mockData";

const LOCAL_SONGS_KEY = "tunestream_local_songs";

export interface LocalSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork: string;
  blobUrl: string;
  fileName: string;
  size: number;
}

function getStoredLocalSongs(): LocalSong[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SONGS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalSongs(songs: LocalSong[]) {
  localStorage.setItem(LOCAL_SONGS_KEY, JSON.stringify(songs.map(s => ({
    ...s,
    blobUrl: "", // Don't persist blob URLs
  }))));
}

// Parse basic metadata from filename
function parseFileName(name: string): { title: string; artist: string } {
  const cleaned = name.replace(/\.(mp3|m4a|wav|ogg|flac|aac|wma|opus)$/i, "");
  
  // Try "Artist - Title" format
  const dashSplit = cleaned.split(" - ");
  if (dashSplit.length >= 2) {
    return { artist: dashSplit[0].trim(), title: dashSplit.slice(1).join(" - ").trim() };
  }
  
  return { title: cleaned.trim(), artist: "Unknown Artist" };
}

export function useLocalMusic() {
  const [localSongs, setLocalSongs] = useState<LocalSong[]>(getStoredLocalSongs);
  const [isLoading, setIsLoading] = useState(false);

  const importFiles = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac,.wma,.opus";
      
      const files = await new Promise<FileList | null>((resolve) => {
        input.onchange = () => resolve(input.files);
        input.click();
      });
      
      if (!files || files.length === 0) {
        setIsLoading(false);
        return;
      }
      
      const newSongs: LocalSong[] = [];
      
      for (const file of Array.from(files)) {
        const { title, artist } = parseFileName(file.name);
        const blobUrl = URL.createObjectURL(file);
        
        // Get duration
        const audio = new Audio(blobUrl);
        const duration = await new Promise<number>((resolve) => {
          audio.addEventListener("loadedmetadata", () => resolve(audio.duration || 0));
          audio.addEventListener("error", () => resolve(0));
        });
        
        newSongs.push({
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title,
          artist,
          album: "Local Music",
          duration: Math.round(duration),
          artwork: "",
          blobUrl,
          fileName: file.name,
          size: file.size,
        });
      }
      
      const updated = [...localSongs, ...newSongs];
      setLocalSongs(updated);
      saveLocalSongs(updated);
      
      return newSongs.length;
    } catch (error) {
      console.error("[LocalMusic] Import failed:", error);
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [localSongs]);

  const removeLocalSong = useCallback((songId: string) => {
    const song = localSongs.find(s => s.id === songId);
    if (song?.blobUrl) URL.revokeObjectURL(song.blobUrl);
    const updated = localSongs.filter(s => s.id !== songId);
    setLocalSongs(updated);
    saveLocalSongs(updated);
  }, [localSongs]);

  const localSongsAsTracks = useCallback((): Track[] => {
    return localSongs.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      album: s.album,
      artwork: s.artwork || "/placeholder.svg",
      duration: s.duration,
      preview: s.blobUrl,
      isLocal: true,
    } as Track & { isLocal: boolean }));
  }, [localSongs]);

  return {
    localSongs,
    isLoading,
    importFiles,
    removeLocalSong,
    localSongsAsTracks,
  };
}
