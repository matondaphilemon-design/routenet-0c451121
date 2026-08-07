/**
 * Download service.
 *
 * Flow: mint a browser PO token → ask the edge function to resolve direct
 * stream URLs → fetch the bytes straight from googlevideo in the browser
 * (the user's IP isn't blocked) → on CORS/403 fall back to the edge proxy →
 * on failure try the next format. Blobs are cached in IndexedDB for offline
 * playback and optionally saved to the device.
 */
import { searchYouTubeForTrack } from "@/hooks/useYouTubePlayback";
import { getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";
import { Track } from "@/data/mockData";
import { saveSong, isSongDownloaded, getStorageUsage, type OfflineSong } from "./indexedDBService";
import { getPoToken, invalidatePoToken } from "./poTokenProvider";
import {
  fetchMediaBlob, fetchDirectBlob, resolveStreamUrls, saveBlobToDevice,
  safeFileName, extensionForType,
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

function isTooSmall(blob: Blob | undefined) {
  return !blob || blob.size < 10000;
}

/**
 * Get the audio bytes for a video id, trying every path in order.
 */
async function grabAudio(
  track: Track,
  videoId: string,
  onProgress?: (percent: number) => void,
  onDetail?: (p: DownloadProgress) => void,
): Promise<{ blob: Blob; type: string }> {
  const report = (p: DownloadProgress) => { onProgress?.(p.percent); onDetail?.(p); };
  const name = safeFileName(`${track.artist} - ${track.title}`, "m4a");
  let token = await getPoToken(videoId);
  const errors: string[] = [];

  // 1) Resolve direct URLs and fetch them from the browser.
  try {
    const resolved = await resolveStreamUrls(videoId, true, token);
    const candidates = [
      { url: resolved.url, mimeType: resolved.mimeType },
      ...resolved.alternatives.filter((a) => a.url !== resolved.url).slice(0, 3),
    ];

    for (const candidate of candidates) {
      try {
        const { blob, type } = await fetchDirectBlob(candidate.url, candidate.mimeType, report);
        if (!isTooSmall(blob)) return { blob, type };
        errors.push("empty stream");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        if (msg.includes("403")) invalidatePoToken();

        // 2) Same URL, but relayed through the edge proxy (fixes CORS/IP issues).
        try {
          const viaProxy = await fetchMediaBlob({ url: candidate.url, name, audio: true }, report);
          if (!isTooSmall(viaProxy.blob)) return { blob: viaProxy.blob, type: viaProxy.type };
        } catch (proxyError) {
          errors.push(proxyError instanceof Error ? proxyError.message : String(proxyError));
        }
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));

    // A cached integrity token may have been invalidated early by YouTube.
    // Mint once more before falling back to server-only resolution.
    if (token) {
      invalidatePoToken();
      token = await getPoToken(videoId);
      if (token) {
        try {
          const resolved = await resolveStreamUrls(videoId, true, token);
          const retry = await fetchDirectBlob(resolved.url, resolved.mimeType, report);
          if (!isTooSmall(retry.blob)) return retry;
        } catch (retryError) {
          errors.push(retryError instanceof Error ? retryError.message : String(retryError));
        }
      }
    }
  }

  // 3) Last resort: let the edge function resolve and stream everything.
  try {
    const res = await fetchMediaBlob(
      {
        videoId,
        name,
        audio: true,
        poToken: token?.poToken,
        gvsPoToken: token?.gvsPoToken,
        visitorData: token?.visitorData,
      },
      report,
    );
    if (!isTooSmall(res.blob)) return { blob: res.blob, type: res.type };
    errors.push("empty proxy stream");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  throw new Error(errors[errors.length - 1] || "could not download this song");
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
      await new Promise((r) => setTimeout(r, 400));
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
    console.warn("[saveTrackToDevice] failed:", lastDownloadError);
    return false;
  }
}
