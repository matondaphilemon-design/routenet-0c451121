import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";
/**
 * Download service — fetches real audio via the `download-audio` edge function
 * (server-side proxy that bypasses CORS) and saves the blob to IndexedDB.
 * Supports progress tracking via fetch ReadableStream.
 */
import { searchYouTubeForTrack } from "@/hooks/useYouTubePlayback";
import { getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";
import { Track } from "@/data/mockData";
import { saveSong, isSongDownloaded, getStorageUsage, type OfflineSong } from "./indexedDBService";
import { supabase } from "@/integrations/supabase/client";

export type DownloadProgressCallback = (songId: string, percent: number) => void;

async function resolveVideoId(track: Track): Promise<string | undefined> {
  let videoId = track.youtubeId || getCachedYouTubeId(track.title, track.artist);
  if (!videoId) {
    videoId = await searchYouTubeForTrack(track) || undefined;
  }
  return videoId;
}

async function fetchWithProgress(url: string, onProgress?: (percent: number) => void): Promise<Blob> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: url.includes("?body=") ? undefined : undefined,
  });
  if (!response.ok) throw new Error(`failed to fetch audio (${response.status})`);

  const contentLength = response.headers.get("content-length");
  if (!contentLength || !response.body) {
    // No content-length, can't track progress
    const blob = await response.blob();
    onProgress?.(100);
    return blob;
  }

  const total = parseInt(contentLength, 10);
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.round((received / total) * 100));
  }

  return new Blob(chunks);
}

/** Stream audio from the `youtube` edge function with progress tracking. */
async function downloadViaEdge(
  videoId: string,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const ANON = SUPABASE_PUBLISHABLE_KEY;
  const url = `${SUPABASE_URL}/functions/v1/youtube`;

  onProgress?.(1);

  // The edge function resolves the stream server-side. Client-resolved Piped
  // URLs are IP-bound and were the main cause of failed downloads, so they are
  // no longer sent.
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify({ action: "downloadAudio", params: { videoId } }),
  });

  // The function answers 200 even on stream failure — check the marker header
  // and the content type before treating the body as audio.
  const streamErr = response.headers.get("x-stream-error");
  if (streamErr) throw new Error(`no audio stream available (${streamErr})`);

  if (!response.ok) {
    let msg = `download failed (${response.status})`;
    try {
      const j = await response.json();
      if (j?.error) msg = j.error;
    } catch { /* not json */ }
    throw new Error(msg);
  }

  const ct = response.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    let msg = "no audio stream";
    try {
      const j = await response.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  if (!response.body) {
    const blob = await response.blob();
    onProgress?.(100);
    return blob;
  }

  // Content-Length is often stripped by the proxy — fall back to a smooth
  // byte-based estimate so the UI still shows real movement.
  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const ESTIMATE = 4 * 1024 * 1024;

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const pct = total > 0
      ? Math.round((received / total) * 100)
      : Math.min(95, Math.round((received / ESTIMATE) * 100));
    onProgress?.(Math.max(1, Math.min(99, pct)));
  }
  onProgress?.(100);

  return new Blob(chunks, { type: ct || "audio/mp4" });
}


/** The reason the last download failed — surfaced by the UI. */
export let lastDownloadError = "";

export async function downloadTrack(
  track: Track,
  onProgress?: (percent: number) => void,
  groupInfo?: { groupKey: string; groupName: string; groupType: "album" | "playlist" }
): Promise<boolean> {
  lastDownloadError = "";
  try {
    const already = await isSongDownloaded(track.id);
    if (already) {
      onProgress?.(100);
      return true;
    }

    const { used, quota } = await getStorageUsage();
    if (quota > 0 && quota - used < 10 * 1024 * 1024) {
      throw new Error("not enough storage space");
    }

    const videoId = await resolveVideoId(track);
    if (!videoId) {
      throw new Error("could not find this song's audio source");
    }

    // Download via edge function (server-side proxy, no CORS issues).
    // One retry — transient upstream failures are common.
    let blob: Blob;
    try {
      blob = await downloadViaEdge(videoId, onProgress);
    } catch (first) {
      console.warn("[Download] retrying:", first);
      await new Promise((r) => setTimeout(r, 1200));
      blob = await downloadViaEdge(videoId, onProgress);
    }
    if (!blob || blob.size < 10000) {
      throw new Error("downloaded file is empty");
    }

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
    console.error("[Download] Failed:", error);
    return false;
  }
}

export async function downloadAlbumTracks(
  tracks: Track[],
  onTrackProgress?: (trackId: string, percent: number) => void,
  onOverallProgress?: (current: number, total: number) => void,
  groupInfo?: { groupKey: string; groupName: string; groupType: "album" | "playlist" }
): Promise<number> {
  let downloaded = 0;
  for (let i = 0; i < tracks.length; i++) {
    onOverallProgress?.(i + 1, tracks.length);
    try {
      const ok = await downloadTrack(
        tracks[i],
        (percent) => onTrackProgress?.(tracks[i].id, percent),
        groupInfo
      );
      if (ok) downloaded++;
      await new Promise(r => setTimeout(r, 800));
    } catch {
      // Continue with next track
    }
  }
  return downloaded;
}

/**
 * Download a track and save it to the user's device as a real audio file.
 * Triggers the browser's native file-save (Downloads folder).
 * Also caches the blob in IndexedDB so it's available offline.
 */
export async function saveTrackToDevice(
  track: Track,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  try {
    const videoId = await resolveVideoId(track);
    if (!videoId) throw new Error("could not find track on youtube");

    const blob = await downloadViaEdge(videoId, onProgress);
    if (!blob || blob.size < 10000) throw new Error("downloaded file is empty");

    // Pick a sensible extension based on MIME type
    const ct = blob.type || "";
    const ext = ct.includes("mpeg") ? "mp3"
      : ct.includes("mp4") || ct.includes("m4a") ? "m4a"
      : ct.includes("webm") ? "webm"
      : "mp3";

    const safeName = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
    const filename = `${safeName}.${ext}`;

    // Trigger the native browser download via blob URL + <a download>
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a tick so the browser has time to start the download
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);

    // Best-effort: also cache offline so the in-app player can use it later
    try {
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
      };
      await saveSong(offlineSong);
    } catch {}

    return true;
  } catch (e) {
    console.error("[saveTrackToDevice] failed:", e);
    return false;
  }
}
