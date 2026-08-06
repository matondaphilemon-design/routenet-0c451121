import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

/**
 * songs.ts — service layer for song media (mirrors the piped.ts shape).
 * Everything media-related goes through the `public-download` proxy so the
 * browser never touches an IP-bound googlevideo URL directly.
 */

export const DOWNLOAD_PROXY = `${SUPABASE_URL}/functions/v1/public-download`;

export interface DownloadProgress {
  stage: "connecting" | "downloading" | "finalizing" | "done" | "error";
  received: number;
  total: number;
  speed: number;
  percent: number;
  message?: string;
}

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function safeFileName(name: string, ext: string): string {
  const safe = name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "song";
  return `${safe}.${ext}`;
}

export interface ResolvedStreamInfo {
  url: string;
  mimeType: string;
  source: string;
  alternatives: Array<{ url: string; mimeType: string; bitrate: number }>;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };
}

/**
 * Ask the edge function to resolve a video id into direct stream URLs.
 * A browser-minted PO token is passed along when available.
 */
export async function resolveStreamUrls(
  videoId: string,
  audio: boolean,
  token?: { poToken: string; visitorData: string } | null,
): Promise<ResolvedStreamInfo> {
  const res = await fetch(`${DOWNLOAD_PROXY}?mode=resolve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      videoId,
      audio,
      poToken: token?.poToken,
      visitorData: token?.visitorData,
    }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json())?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const data = await res.json();
  if (!data?.url) throw new Error("no playable stream found");
  return {
    url: data.url,
    mimeType: data.mimeType || (audio ? "audio/mp4" : "video/mp4"),
    source: data.source || "edge",
    alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
  };
}

/**
 * Fetch media bytes straight from googlevideo in the browser (the user's own
 * IP is not blocked), with byte-accurate progress.
 */
export async function fetchDirectBlob(
  url: string,
  mimeType: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<{ blob: Blob; type: string }> {
  onProgress?.({ stage: "connecting", received: 0, total: 0, speed: 0, percent: 0 });

  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok && res.status !== 206) throw new Error(`direct fetch HTTP ${res.status}`);

  const type = res.headers.get("content-type") || mimeType;
  const total = Number(res.headers.get("content-length") || 0);

  if (!res.body) {
    const blob = await res.blob();
    onProgress?.({ stage: "done", received: blob.size, total: blob.size, speed: 0, percent: 100 });
    return { blob, type };
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  let lastTick = performance.now();
  let lastReceived = 0;
  let speed = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const now = performance.now();
    if (now - lastTick > 250) {
      speed = ((received - lastReceived) / (now - lastTick)) * 1000;
      lastTick = now;
      lastReceived = received;
    }
    const percent = total > 0
      ? Math.min(99, Math.round((received / total) * 100))
      : Math.min(95, Math.round((received / (4 * 1024 * 1024)) * 100));
    onProgress?.({ stage: "downloading", received, total, speed, percent: Math.max(1, percent) });
  }

  onProgress?.({ stage: "finalizing", received, total: total || received, speed, percent: 99 });
  const blob = new Blob(chunks, { type });
  onProgress?.({ stage: "done", received, total: total || received, speed: 0, percent: 100 });
  return { blob, type };
}


/** Stream a media file through the proxy with byte-accurate progress. */
export async function fetchMediaBlob(
  opts: { videoId?: string; url?: string; name: string; audio?: boolean },
  onProgress?: (p: DownloadProgress) => void,
): Promise<{ blob: Blob; filename: string; type: string }> {
  onProgress?.({ stage: "connecting", received: 0, total: 0, speed: 0, percent: 0 });

  const res = await fetch(DOWNLOAD_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      videoId: opts.videoId,
      url: opts.url,
      name: opts.name,
      audio: opts.audio ?? true,
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        try { msg = JSON.parse(text)?.error || text; } catch { msg = text; }
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const type = res.headers.get("content-type") || "audio/mp4";
  const total = Number(res.headers.get("content-length") || 0);
  const ESTIMATE = 4 * 1024 * 1024;

  if (!res.body) {
    const blob = await res.blob();
    onProgress?.({ stage: "done", received: blob.size, total: blob.size, speed: 0, percent: 100 });
    return { blob, filename: opts.name, type };
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  const started = performance.now();
  let lastTick = started;
  let lastReceived = 0;
  let speed = 0;

  onProgress?.({ stage: "downloading", received: 0, total, speed: 0, percent: 0 });
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const now = performance.now();
    if (now - lastTick > 250) {
      speed = ((received - lastReceived) / (now - lastTick)) * 1000;
      lastTick = now;
      lastReceived = received;
    }
    const percent = total > 0
      ? Math.min(99, Math.round((received / total) * 100))
      : Math.min(95, Math.round((received / ESTIMATE) * 100));
    onProgress?.({ stage: "downloading", received, total, speed, percent: Math.max(1, percent) });
  }

  onProgress?.({ stage: "finalizing", received, total: total || received, speed, percent: 99 });
  const blob = new Blob(chunks, { type });
  onProgress?.({ stage: "done", received, total: total || received, speed: 0, percent: 100 });
  return { blob, filename: opts.name, type };
}

/** Save a blob to the device's Downloads folder. */
export function saveBlobToDevice(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}

export function extensionForType(type: string): string {
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("webm") || type.includes("opus")) return "webm";
  return "m4a";
}
