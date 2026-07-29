import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Track } from "@/data/mockData";
import { downloadTrack } from "@/services/downloadService";
import { isSongDownloaded } from "@/services/indexedDBService";
import { toast } from "sonner";

export type DownloadStatus = "idle" | "downloading" | "done" | "failed";

interface DownloadEntry {
  status: DownloadStatus;
  percent: number;
}

interface DownloadModeContextValue {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
  statusOf: (trackId: string) => DownloadEntry;
  startDownload: (track: Track) => Promise<void>;
  refreshDownloaded: () => Promise<void>;
}

const Ctx = createContext<DownloadModeContextValue | undefined>(undefined);

export function DownloadModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, DownloadEntry>>({});
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  const refreshDownloaded = useCallback(async () => {
    try {
      const { getAllSongs } = await import("@/services/indexedDBService");
      const all = await getAllSongs();
      setDownloadedIds(new Set(all.map(s => s.id)));
    } catch {}
  }, []);

  useEffect(() => {
    refreshDownloaded();
  }, [refreshDownloaded]);

  const toggle = useCallback(() => {
    setEnabled(v => {
      const next = !v;
      if (next) toast.info("Download mode on — tap any song to save it");
      return next;
    });
  }, []);

  const statusOf = useCallback((trackId: string): DownloadEntry => {
    if (downloadedIds.has(trackId)) return { status: "done", percent: 100 };
    return statuses[trackId] || { status: "idle", percent: 0 };
  }, [statuses, downloadedIds]);

  const startDownload = useCallback(async (track: Track) => {
    const already = await isSongDownloaded(track.id);
    if (already) {
      setDownloadedIds(prev => new Set(prev).add(track.id));
      return;
    }
    setStatuses(prev => ({ ...prev, [track.id]: { status: "downloading", percent: 0 } }));
    try {
      const ok = await downloadTrack(track, (percent) => {
        setStatuses(prev => ({ ...prev, [track.id]: { status: "downloading", percent } }));
      });
      if (ok) {
        setStatuses(prev => ({ ...prev, [track.id]: { status: "done", percent: 100 } }));
        setDownloadedIds(prev => new Set(prev).add(track.id));
        toast.success(`Downloaded "${track.title}"`);
      } else {
        setStatuses(prev => ({ ...prev, [track.id]: { status: "failed", percent: 0 } }));
        toast.error(`Couldn't download "${track.title}"`);
      }
    } catch (e) {
      setStatuses(prev => ({ ...prev, [track.id]: { status: "failed", percent: 0 } }));
      toast.error(`Download failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }, []);

  return (
    <Ctx.Provider value={{ enabled, toggle, setEnabled, statusOf, startDownload, refreshDownloaded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDownloadMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDownloadMode must be used within DownloadModeProvider");
  return ctx;
}