import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { MiniPlayer } from "./MiniPlayer";
import { GlobalAudioPlayer } from "@/components/player/GlobalAudioPlayer";

import { usePlayer } from "@/context/PlayerContext";
import { useDJBridge } from "@/hooks/useDJBridge";
import { useMediaSession } from "@/hooks/useMediaSession";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { currentTrack } = usePlayer();
  const location = useLocation();
  
  useDJBridge();
  useMediaSession();

  const hideChrome = location.pathname === "/lyrics";
  const hideMiniplayer = hideChrome || location.pathname === "/now-playing" || location.pathname === "/ai-dj" || location.pathname === "/radio";
  
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div
        className="pointer-events-none fixed top-0 right-0 h-[50vh] w-[50vw] rounded-full blur-[120px] opacity-[0.05]"
        style={{ background: "hsl(141 73% 42%)" }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-0 h-[40vh] w-[40vw] rounded-full blur-[100px] opacity-[0.03]"
        style={{ background: "hsl(141 73% 42%)" }}
      />
      <GlobalAudioPlayer />
      <main className={`relative z-10 flex-1 ${currentTrack && !hideMiniplayer ? "pb-36" : "pb-20"}`}>
        {children}
      </main>
      
      {!hideMiniplayer && <MiniPlayer />}
      {!hideChrome && <BottomNav />}
    </div>
  );
}
