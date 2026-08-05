import { Check, Download, Loader2, AlertCircle } from "lucide-react";
import { formatBytes } from "@/services/songs";

export type CardDownloadStatus = "idle" | "pending" | "downloading" | "done" | "failed";

/**
 * Card-based download UI — the whole song row becomes the download surface:
 * a progress bar fills across the bottom of the card and the trailing badge
 * shows the live percent / bytes. Replaces the old circular indicator.
 */
export function CardDownloadBar({
  status,
  percent,
  received = 0,
  total = 0,
}: {
  status: CardDownloadStatus;
  percent: number;
  received?: number;
  total?: number;
}) {
  if (status === "idle") return null;
  const width = status === "done" ? 100 : status === "failed" ? 100 : Math.max(4, percent);
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-full bg-foreground/10">
        <div
          className={`h-full transition-all duration-200 ${
            status === "done" ? "bg-emerald-500" : status === "failed" ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      {status === "downloading" && (received > 0 || total > 0) && (
        <span className="pointer-events-none absolute bottom-[5px] right-2 text-[9px] font-bold tabular-nums text-muted-foreground">
          {formatBytes(received)}{total ? ` / ${formatBytes(total)}` : ""}
        </span>
      )}
    </>
  );
}

/** Compact trailing state badge for the row. */
export function CardDownloadBadge({ status, percent }: { status: CardDownloadStatus; percent: number }) {
  if (status === "done") return <Check className="h-4 w-4 text-emerald-500" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (status === "downloading" || status === "pending") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {percent}%
      </span>
    );
  }
  return <Download className="h-4 w-4 text-muted-foreground" />;
}
