import { Layers, AudioWaveform } from "lucide-react";

/** Bottom-left rounded pill with layered-squares icon + number. */
export function CountBadge({ count }: { count: number | string }) {
  return (
    <span className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
      <Layers className="h-2.5 w-2.5" strokeWidth={2.5} />
      {count}
    </span>
  );
}

/** Bottom-right dark circle with audio-wave icon. */
export function WaveBadge() {
  return (
    <span className="absolute bottom-1.5 right-1.5 z-10 h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-md">
      <AudioWaveform className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
    </span>
  );
}

/** Black vinyl disc peeking out from behind the card to the right. */
export function VinylPeek() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 z-0 h-[78%] w-[78%] rounded-full bg-gradient-to-br from-zinc-800 to-black ring-1 ring-white/5"
    >
      <span className="absolute inset-[28%] rounded-full bg-zinc-700/80" />
      <span className="absolute inset-[44%] rounded-full bg-zinc-900" />
    </span>
  );
}