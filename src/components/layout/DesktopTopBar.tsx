import { ArrowLeft, ArrowRight, Search, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export function DesktopTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isSearch = location.pathname === "/search";

  return (
    <header className="hidden h-16 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-5 backdrop-blur-xl lg:flex">
      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate(-1)} aria-label="Go back">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate(1)} aria-label="Go forward">
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="relative ml-3 w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search music"
          readOnly={!isSearch}
          onClick={() => !isSearch && navigate("/search")}
          placeholder="Search artists, albums and songs"
          className="h-9 rounded-full bg-secondary pl-9"
        />
      </div>

      <Button variant="secondary" size="sm" className="ml-auto rounded-full" onClick={() => navigate(user ? "/profile" : "/auth")}>
        <UserRound className="h-4 w-4" />
        {user ? "Profile" : "Sign in"}
      </Button>
    </header>
  );
}