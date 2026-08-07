import { Home, Search, Library, Compass, Radio, Heart, Clock3, Plus } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/brand/AppLogo";
import { Button } from "@/components/ui/button";
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

  return (
    <aside className="hidden h-full min-h-0 w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
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

      <div className="mx-4 border-t border-sidebar-border" />
      <div className="px-3 py-4">
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
      </div>
    </aside>
  );
}