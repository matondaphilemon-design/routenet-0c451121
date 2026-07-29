import { useCallback, useEffect, useState } from "react";
import type { Track } from "@/data/mockData";

const KEY = "tunestream_listening_history_v1";
const CAP = 40;
const EVENT = "listening-history-updated";

function read(): Track[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch { return []; }
}

export function getListeningHistory(): Track[] { return read(); }


export function recordListen(track: Track) {
  if (!track?.id) return;
  const list = read().filter((t) => t.id !== track.id);
  list.unshift(track);
  const trimmed = list.slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

/** Live listening-history hook — reflects updates across the app. */
export function useListeningHistory() {
  const [history, setHistory] = useState<Track[]>(() => read());

  useEffect(() => {
    const refresh = () => setHistory(read());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { history, clear, recordListen };
}
