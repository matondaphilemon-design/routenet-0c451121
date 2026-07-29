/**
 * Circular SVG download progress indicator component.
 */
import React from "react";
import { Download, Check, Loader2 } from "lucide-react";

interface DownloadProgressCircleProps {
  status: "idle" | "pending" | "downloading" | "done" | "failed";
  percent?: number;
  size?: number;
  onClick?: () => void;
}

export function DownloadProgressCircle({
  status,
  percent = 0,
  size = 28,
  onClick,
}: DownloadProgressCircleProps) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  if (status === "done") {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Check className="text-green-500" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <button onClick={onClick} className="flex items-center justify-center text-destructive" style={{ width: size, height: size }}>
        <span className="text-[10px] font-bold">!</span>
      </button>
    );
  }

  if (status === "downloading") {
    return (
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted-foreground/20" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-primary transition-all duration-300" />
        </svg>
        <span className="absolute text-[8px] font-bold text-primary">{percent}%</span>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="rounded-full border-2 border-muted-foreground/30" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }

  // idle
  return (
    <button onClick={onClick} className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" style={{ width: size, height: size }}>
      <Download style={{ width: size * 0.6, height: size * 0.6 }} />
    </button>
  );
}
