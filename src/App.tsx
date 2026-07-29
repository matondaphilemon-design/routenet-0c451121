import { lazy, Suspense, useEffect } from "react";
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
const Splash = lazy(() => import("./pages/Splash"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const Library = lazy(() => import("./pages/Library"));
const NowPlaying = lazy(() => import("./pages/NowPlaying"));
const VideoPlayer = lazy(() => import("./pages/VideoPlayer"));
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const ArtistDetail = lazy(() => import("./pages/ArtistDetail"));
const Browse = lazy(() => import("./pages/Browse"));
const Radio = lazy(() => import("./pages/Radio"));
const Discover = lazy(() => import("./pages/Discover"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const AlbumDetail = lazy(() => import("./pages/AlbumDetail"));
const Queue = lazy(() => import("./pages/Queue"));
const Premium = lazy(() => import("./pages/Premium"));
const RecentlyPlayed = lazy(() => import("./pages/RecentlyPlayed"));
const CreatePlaylist = lazy(() => import("./pages/CreatePlaylist"));
const UserPlaylistDetail = lazy(() => import("./pages/UserPlaylistDetail"));
const AIDJ = lazy(() => import("./pages/AIDJ"));
const BatchPlaylistCreator = lazy(() => import("./pages/BatchPlaylistCreator"));
const SleepTimerPage = lazy(() => import("./pages/SleepTimerPage"));
const EqualizerPage = lazy(() => import("./pages/EqualizerPage"));
const FullLyrics = lazy(() => import("./pages/FullLyrics"));
const LikedSongs = lazy(() => import("./pages/LikedSongs"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
