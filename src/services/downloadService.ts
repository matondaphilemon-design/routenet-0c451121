/**
 * Download service — all downloads go through the `public-download` proxy
 * (see `src/services/songs.ts`), which resolves a real MP4/M4A stream
 * server-side and streams it back with progress. The blob is cached in
 * IndexedDB for offline playback and optionally saved to the device.
 */
import { searchYouTubeForTrack } from "@/hooks/useYouTubePlayback";
import { getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";
import { Track } from "@/data/mockData";
import { saveSong, isSongDownloaded, getStorageUsage, type OfflineSong } from "./indexedDBService";
import {
  fetchMediaBlob, saveBlobToDevice, safeFileName, extensionForType,
  type DownloadProgress,
} from "./songs";

export type DownloadProgressCallback = (songId: string, percent: number) => void;

async function resolveVideoId(track: Track): Promise<string | undefined> {
  let videoId = track.youtubeId || getCachedYouTubeId(track.title, track.artist);
  if (!videoId) videoId = (await searchYouTubeForTrack(track)) || undefined;
  return videoId;
}

/** The reason the last download failed — surfaced by the UI. */
export let lastDownloadError = "";

async function grabAudio(
  track: Track,
  videoId: string,
  onProgress?: (percent: number) => void,
  onDetail?: (p: DownloadProgress) => void,
) {
  const attempt = () =>
    fetchMediaBlob(
      { videoId, name: safeFileName(`${track.artist} - ${track.title}`, "m4a"), audio: true },
      (p) => { onProgress?.(p.percent); onDetail?.(p); },
    );

  try {
    return await attempt();
  } catch (first) {
    console.warn("[Download] retrying:", first);
    await new Promise((r) => setTimeout(r, 1200));
    return await attempt();
  }
}

export async function downloadTrack(
  track: Track,
  onProgress?: (percent: number) => void,
  groupInfo?: { groupKey: string; groupName: string; groupType: "album" | "playlist" },
  onDetail?: (p: DownloadProgress) => void,
): Promise<boolean> {
  lastDownloadError = "";
  try {
    if (await isSongDownloaded(track.id)) {
      onProgress?.(100);
      return true;
    }

    const { used, quota } = await getStorageUsage();
    if (quota > 0 && quota - used < 10 * 1024 * 1024) throw new Error("not enough storage space");

    const videoId = await resolveVideoId(track);
    if (!videoId) throw new Error("could not find this song's audio source");

    const { blob } = await grabAudio(track, videoId, onProgress, onDetail);
    if (!blob || blob.size < 10000) throw new Error("downloaded file is empty");

    const offlineSong: OfflineSong = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      artwork: track.artwork || "",
      duration: track.duration,
      blob,
      downloadedAt: Date.now(),
      size: blob.size,
      youtubeId: videoId,
      ...(groupInfo || {}),
    };

    await saveSong(offlineSong);
    return true;
  } catch (error) {
    lastDownloadError = error instanceof Error ? error.message : String(error);
    // Warn (not error): download failures are recoverable and surfaced as a toast.
    console.warn("[Download] Failed:", lastDownloadError);
    return false;
  }

}

export async function downloadAlbumTracks(
  tracks: Track[],
  onTrackProgress?: (trackId: string, percent: number) => void,
  onOverallProgress?: (current: number, total: number) => void,
  groupInfo?: { groupKey: string; groupName: string; groupType: "album" | "playlist" },
): Promise<number> {
  let downloaded = 0;
  for (let i = 0; i < tracks.length; i++) {
    onOverallProgress?.(i + 1, tracks.length);
    try {
      const ok = await downloadTrack(tracks[i], (p) => onTrackProgress?.(tracks[i].id, p), groupInfo);
      if (ok) downloaded++;
      await new Promise((r) => setTimeout(r, 500));
    } catch { /* keep going */ }
  }
  return downloaded;
}

/**
 * Download a song and save it to the device as a real audio file, and cache it
 * offline so the in-app player can use it later.
 */
export async function saveTrackToDevice(
  track: Track,
  onProgress?: (percent: number) => void,
  onDetail?: (p: DownloadProgress) => void,
): Promise<boolean> {
  lastDownloadError = "";
  try {
    const videoId = await resolveVideoId(track);
    if (!videoId) throw new Error("could not find this song's audio source");

    const { blob, type } = await grabAudio(track, videoId, onProgress, onDetail);
    if (!blob || blob.size < 10000) throw new Error("downloaded file is empty");

    saveBlobToDevice(blob, safeFileName(`${track.artist} - ${track.title}`, extensionForType(type)));

    try {
      await saveSong({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || "",
        artwork: track.artwork || "",
        duration: track.duration,
        blob,
        downloadedAt: Date.now(),
        size: blob.size,
        youtubeId: videoId,
      } as OfflineSong);
    } catch { /* offline cache is best-effort */ }

    return true;
  } catch (e) {
    lastDownloadError = e instanceof Error ? e.message : String(e);
    console.error("[saveTrackToDevice] failed:", e);
    return false;
  }
}
