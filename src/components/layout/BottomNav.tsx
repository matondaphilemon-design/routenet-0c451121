import { Home, Search, Library, Mic, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/library", icon: Library, label: "Library" },
  { path: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const location = useLocation();

  if (location.pathname === "/now-playing" || location.pathname === "/lyrics" || location.pathname === "/ai-dj") return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "hsl(265 40% 5% / 0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid hsl(271 30% 25% / 0.4)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.path} to={item.path}
              className="flex flex-col items-center gap-0.5 relative min-w-[3rem] py-1">
              <motion.div whileTap={{ scale: 0.88 }} transition={{ duration: 0.1 }}>
                <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-white/50")} />
              </motion.div>
              <span className={cn("text-[9px] font-semibold tracking-wide", isActive ? "text-primary" : "text-white/50")}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
