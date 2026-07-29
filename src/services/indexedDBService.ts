/**
 * IndexedDB service for offline song storage.
 * Stores audio blobs + metadata for offline playback.
 */

const DB_NAME = "tunestream_db";
const DB_VERSION = 1;
const STORE_NAME = "songs";

export interface OfflineSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  blob: Blob;
  downloadedAt: number;
  size: number;
  youtubeId?: string;
  /** Album or playlist grouping key */
  groupKey?: string;
  groupType?: "album" | "playlist";
  groupName?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("artist", "artist", { unique: false });
        store.createIndex("album", "album", { unique: false });
        store.createIndex("groupKey", "groupKey", { unique: false });
        store.createIndex("downloadedAt", "downloadedAt", { unique: false });
      }
    };
  });
}

export async function saveSong(song: OfflineSong): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSong(id: string): Promise<OfflineSong | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSongs(): Promise<OfflineSong[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isSongDownloaded(id: string): Promise<boolean> {
  const song = await getSong(id);
  return !!song;
}

export async function getStorageUsage(): Promise<{ used: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    return { used: est.usage || 0, quota: est.quota || 0 };
  }
  return { used: 0, quota: Infinity };
}

/** Play a downloaded song by creating an object URL from its blob */
export function createPlaybackUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Get songs grouped by album/playlist */
export async function getSongsByGroup(groupKey: string): Promise<OfflineSong[]> {
  const all = await getAllSongs();
  return all.filter(s => s.groupKey === groupKey);
}

/** Get all unique groups (albums/playlists that have been downloaded) */
export async function getDownloadedGroups(): Promise<Array<{ key: string; name: string; type: string; artwork: string; count: number }>> {
  const all = await getAllSongs();
  const groups = new Map<string, { name: string; type: string; artwork: string; count: number }>();
  for (const song of all) {
    if (song.groupKey && song.groupName) {
      const existing = groups.get(song.groupKey);
      if (existing) {
        existing.count++;
      } else {
        groups.set(song.groupKey, { name: song.groupName, type: song.groupType || "album", artwork: song.artwork, count: 1 });
      }
    }
  }
  return Array.from(groups.entries()).map(([key, v]) => ({ key, ...v }));
}
