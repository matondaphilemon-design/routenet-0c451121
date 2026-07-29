/**
 * IndexedDB cache for tracks, playlists, and the assembled home feed.
 * Ensures the app renders instantly on cold reload with real metadata,
 * even before the network round-trip to the deezer edge function.
 */
const DB_NAME = "tunestream_reco_cache";
const DB_VERSION = 1;
const TRACK_STORE = "tracks";
const PLAYLIST_STORE = "playlists";
const FEED_STORE = "feeds";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) db.createObjectStore(TRACK_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PLAYLIST_STORE)) db.createObjectStore(PLAYLIST_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FEED_STORE)) db.createObjectStore(FEED_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const s = tx.objectStore(store);
      Promise.resolve(fn(s)).then(resolve, reject);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function saveTracks(tracks: any[]) {
  await withStore(TRACK_STORE, "readwrite", (s) => {
    for (const t of tracks) if (t?.id) s.put({ ...t, cachedAt: Date.now() });
  });
}

export async function savePlaylists(playlists: any[]) {
  await withStore(PLAYLIST_STORE, "readwrite", (s) => {
    for (const p of playlists) if (p?.id) s.put({ ...p, cachedAt: Date.now() });
  });
}

export async function saveFeed(key: string, feed: any) {
  await withStore(FEED_STORE, "readwrite", (s) => {
    s.put({ key, feed, cachedAt: Date.now() });
  });
}

export async function loadFeed(key: string): Promise<{ feed: any; cachedAt: number } | null> {
  const res = await withStore<any>(FEED_STORE, "readonly", (s) => req(s.get(key)));
  if (!res) return null;
  return { feed: res.feed, cachedAt: res.cachedAt };
}

export async function loadAllTracks(): Promise<any[]> {
  return (await withStore<any[]>(TRACK_STORE, "readonly", (s) => req(s.getAll() as IDBRequest<any[]>))) || [];
}
