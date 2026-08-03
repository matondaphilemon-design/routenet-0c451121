import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "lazy-chunk-reloaded";

/**
 * Wraps React.lazy so a failed dynamic import (stale/expired chunk after a
 * deploy or dev-server restart) retries once, then hard-reloads the page.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // Retry once — usually resolves transient network/HMR races.
      try {
        return await factory();
      } catch {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Never resolves; page is reloading.
          return await new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    }
  });
}
