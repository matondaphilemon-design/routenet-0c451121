import { useNavigate } from "react-router-dom";
import { Heart, Clock, ListMusic, Radio, Sparkles, Download, Music2, Mic2 } from "lucide-react";

interface Tile {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}

const TILES: Tile[] = [
  { label: "Liked Songs", to: "/liked", icon: Heart, accent: true },
  { label: "Recently Played", to: "/recently-played", icon: Clock },
  { label: "Discover", to: "/discover", icon: Sparkles },
  { label: "Your Library", to: "/library", icon: ListMusic },
  { label: "Radio", to: "/radio", icon: Radio },
  { label: "AI DJ", to: "/ai-dj", icon: Mic2 },
  { label: "Downloads", to: "/library?tab=downloads", icon: Download },
  { label: "Browse", to: "/browse", icon: Music2 },
];

export function QuickAccessGrid() {
  const navigate = useNavigate();
  return (
    <section className="mb-6 grid grid-cols-2 gap-2">
      {TILES.map(({ label, to, icon: Icon, accent }) => (
        <button
          key={label}
          onClick={() => navigate(to)}
          className="group flex h-14 items-center gap-3 overflow-hidden rounded-md bg-secondary/60 pr-3 text-left transition-colors hover:bg-secondary active:scale-[0.98]"
        >
          <div
            className={`flex h-full w-14 shrink-0 items-center justify-center ${
              accent ? "bg-primary/85 text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">
            {label}
          </span>
        </button>
      ))}
    </section>
  );
}
