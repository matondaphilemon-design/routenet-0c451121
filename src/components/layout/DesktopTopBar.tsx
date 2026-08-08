import { ArrowLeft, ArrowRight, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function DesktopTopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="hidden h-16 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-5 backdrop-blur-xl lg:flex">
      <Button
        variant="secondary"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => navigate(1)}
        aria-label="Go forward"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

      <Button variant="secondary" size="sm" className="ml-auto rounded-full" onClick={() => navigate(user ? "/profile" : "/auth")}>
        <UserRound className="h-4 w-4" />
        {user ? "Profile" : "Sign in"}
      </Button>
    </header>
  );
}
