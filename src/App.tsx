import { Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { configureNativeAudio } from "@/services/nativeAudioPlayer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/context/PlayerContext";
import { DJProvider } from "@/context/DJContext";
import { DownloadModeProvider } from "@/context/DownloadModeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCachedTracks } from "@/hooks/useCachedTracks";

// Lazy-loaded pages for code splitting
const Splash = lazyWithRetry(() => import("./pages/Splash"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const Home = lazyWithRetry(() => import("./pages/Home"));
const Search = lazyWithRetry(() => import("./pages/Search"));
const Library = lazyWithRetry(() => import("./pages/Library"));
const NowPlaying = lazyWithRetry(() => import("./pages/NowPlaying"));
const VideoPlayer = lazyWithRetry(() => import("./pages/VideoPlayer"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ArtistDetail = lazyWithRetry(() => import("./pages/ArtistDetail"));
const Browse = lazyWithRetry(() => import("./pages/Browse"));
const Radio = lazyWithRetry(() => import("./pages/Radio"));
const Discover = lazyWithRetry(() => import("./pages/Discover"));
const PlaylistDetail = lazyWithRetry(() => import("./pages/PlaylistDetail"));
const AlbumDetail = lazyWithRetry(() => import("./pages/AlbumDetail"));
const Queue = lazyWithRetry(() => import("./pages/Queue"));
const Premium = lazyWithRetry(() => import("./pages/Premium"));
const RecentlyPlayed = lazyWithRetry(() => import("./pages/RecentlyPlayed"));
const CreatePlaylist = lazyWithRetry(() => import("./pages/CreatePlaylist"));
const UserPlaylistDetail = lazyWithRetry(() => import("./pages/UserPlaylistDetail"));
const AIDJ = lazyWithRetry(() => import("./pages/AIDJ"));
const BatchPlaylistCreator = lazyWithRetry(() => import("./pages/BatchPlaylistCreator"));
const SleepTimerPage = lazyWithRetry(() => import("./pages/SleepTimerPage"));
const EqualizerPage = lazyWithRetry(() => import("./pages/EqualizerPage"));
const FullLyrics = lazyWithRetry(() => import("./pages/FullLyrics"));
const LikedSongs = lazyWithRetry(() => import("./pages/LikedSongs"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2 min default stale time
      gcTime: 10 * 60 * 1000,       // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading fallback
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function AppBootstrap({ children }: { children: React.ReactNode }) {
  useCachedTracks();

  useEffect(() => {
    // Defer non-critical bootstrap so the UI paints & becomes interactive fast.
    const ric = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 400));
    const handle = ric(() => {
      configureNativeAudio().catch(() => {});
    });
    return () => {
      const cic = (window as any).cancelIdleCallback;
      if (cic) cic(handle);
    };
  }, []);

  return <>{children}</>;
}

function MainRoutes() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<Library />} />
          <Route path="/now-playing" element={<NowPlaying />} />
          <Route path="/video-player" element={<VideoPlayer />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/artist/:id" element={<ArtistDetail />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/radio" element={<Radio />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/playlist/:id" element={<PlaylistDetail />} />
          <Route path="/album/:id" element={<AlbumDetail />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/recently-played" element={<RecentlyPlayed />} />
          <Route path="/create-playlist" element={<CreatePlaylist />} />
          <Route path="/user-playlist/:id" element={<UserPlaylistDetail />} />
          <Route path="/ai-dj" element={<AIDJ />} />
          <Route path="/batch-playlists" element={<BatchPlaylistCreator />} />
          <Route path="/sleep-timer" element={<SleepTimerPage />} />
          <Route path="/equalizer" element={<EqualizerPage />} />
          <Route path="/lyrics" element={<FullLyrics />} />
          <Route path="/liked" element={<LikedSongs />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PlayerProvider>
        <DJProvider>
          <DownloadModeProvider>
          <AppBootstrap>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Splash />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/install" element={<Splash />} />
                  <Route path="/*" element={<MainRoutes />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AppBootstrap>
          </DownloadModeProvider>
        </DJProvider>
      </PlayerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
