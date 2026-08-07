import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { MiniPlayer } from "./MiniPlayer";
import { GlobalAudioPlayer } from "@/components/player/GlobalAudioPlayer";
import { DesktopSidebar } from "./DesktopSidebar";
import { DesktopTopBar } from "./DesktopTopBar";
import { DesktopNowPlayingPanel } from "./DesktopNowPlayingPanel";
import { DesktopPlayerBar } from "./DesktopPlayerBar";

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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden lg:h-screen lg:overflow-hidden">
      <GlobalAudioPlayer />
      <div className="flex min-h-0 flex-1">
        {!hideChrome && <DesktopSidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          {!hideChrome && <DesktopTopBar />}
          <main className={`relative min-h-0 flex-1 lg:overflow-y-auto ${currentTrack && !hideMiniplayer ? "pb-28 lg:pb-0" : "pb-14 lg:pb-0"}`}>
            {children}
          </main>
        </div>
        {!hideChrome && <DesktopNowPlayingPanel />}
      </div>
      
      {!hideMiniplayer && <div className="lg:hidden"><MiniPlayer /></div>}
      {!hideChrome && <div className="lg:hidden"><BottomNav /></div>}
      {!hideChrome && <DesktopPlayerBar />}
    </div>
  );
}
