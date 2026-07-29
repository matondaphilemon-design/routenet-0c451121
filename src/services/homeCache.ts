// Simple in-memory + IndexedDB (via localStorage fallback) cache for home
// feed section results. Coalesces concurrent requests by key so we never
// double-fetch the same section.

type CacheEntry<T> = { value: T; expiresAt: number };

const memory = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

const LS_PREFIX = "routenet.homeCache.v1:";

function readLS<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch { return null; }
}

function writeLS<T>(key: string, entry: CacheEntry<T>) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry)); } catch {}
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.expiresAt > now) return mem.value as T;
  const ls = readLS<T>(key);
  if (ls) { memory.set(key, ls); return ls.value; }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = (async () => {
    try {
      const value = await fn();
      const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
      memory.set(key, entry);
      writeLS(key, entry);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function invalidateHomeCache(prefix?: string) {
  if (!prefix) { memory.clear(); return; }
  for (const k of Array.from(memory.keys())) if (k.startsWith(prefix)) memory.delete(k);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX + (prefix || ""))) localStorage.removeItem(k);
    }
  } catch {}
}
