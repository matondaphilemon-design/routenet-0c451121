import { useEffect, useState } from "react";
import { Home, Search, Library, Compass, Radio, Heart, Clock3, Plus, Music2 } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/brand/AppLogo";
import { Button } from "@/components/ui/button";
import { getUserPlaylists, type PlaylistRow } from "@/services/playlistService";
import { getLikedSongs } from "@/pages/Library";
import type { Track } from "@/data/mockData";
import { cn } from "@/lib/utils";

const primary = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/search", label: "Search", icon: Search },
  { path: "/discover", label: "Discover", icon: Compass },
  { path: "/radio", label: "Radio", icon: Radio },
];

export function DesktopSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [liked, setLiked] = useState<Track[]>([]);

  useEffect(() => {
    const syncLiked = () => setLiked(getLikedSongs());
    syncLiked();
    window.addEventListener("liked-updated", syncLiked);
    getUserPlaylists().then(setPlaylists).catch(() => undefined);
    return () => window.removeEventListener("liked-updated", syncLiked);
  }, [location.pathname]);

  return (
    <aside className="hidden h-full min-h-0 w-[248px] shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-3 px-5">
        <AppLogo className="h-8 w-8 rounded-md" />
        <span className="text-lg font-black text-sidebar-foreground">routenet</span>
      </div>

      <nav className="space-y-1 px-3 py-3" aria-label="Main navigation">
        {primary.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
              location.pathname === path
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-6 pt-2">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="text-[11px] font-bold uppercase text-muted-foreground">Your library</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/create-playlist")} aria-label="Create playlist">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {[
          { path: "/library", label: "Library", icon: Library },
          { path: "/liked", label: "Liked Songs", icon: Heart },
          { path: "/recently-played", label: "Recently Played", icon: Clock3 },
        ].map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        {playlists.length > 0 && (
          <div className="mt-4">
            <span className="mb-1 block px-3 text-[11px] font-bold uppercase text-muted-foreground">Playlists</span>
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/user-playlist/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
              >
                {p.cover_image
                  ? <img src={p.cover_image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />

                  : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-secondary"><Music2 className="h-4 w-4 text-muted-foreground" /></span>}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-sidebar-foreground">{p.name}</span>
                  <span className="block text-[11px] text-muted-foreground">Playlist</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {liked.length > 0 && (
          <div className="mt-4">
            <span className="mb-1 block px-3 text-[11px] font-bold uppercase text-muted-foreground">Saved songs</span>
            {liked.slice(0, 20).map((track) => (
              <button
                key={`${track.title}-${track.artist}`}
                onClick={() => navigate("/liked")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
              >
                <img src={track.artwork || "/placeholder.svg"} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-sidebar-foreground">{track.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{track.artist}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
