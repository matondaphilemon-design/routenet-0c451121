import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search as SearchIcon, Mic, MicOff, X, Loader2, Clock, User, Music, Disc, Radio } from "lucide-react";
import { TrackCard } from "@/components/cards/TrackCard";
import { ArtistCard } from "@/components/cards/ArtistCard";
import { AlbumCard, Album } from "@/components/cards/AlbumCard";
import { PodcastCard, Podcast } from "@/components/cards/PodcastCard";
import { useDebouncedSearch, useSearchMusic, useYouTubeSearch, useUnifiedTrackSearch } from "@/hooks/useMusicSearch";
import { useDeezerGenres } from "@/hooks/useDeezerGenres";
import { Track, Artist } from "@/data/mockData";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import { getUserPlaylists } from "@/services/playlistService";
import { getCombinedScore } from "@/lib/balancedPlaylist";
import { supabase } from "@/integrations/supabase/client";

const SEARCH_HISTORY_KEY = 'echotunes_search_history';
const MAX_HISTORY = 10;
function getSearchHistory(): string[] { try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); } catch { return []; } }
function addToSearchHistory(query: string) { if (!query.trim()) return; const h = getSearchHistory().filter(h => h.toLowerCase() !== query.toLowerCase()); h.unshift(query.trim()); localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY))); }
function removeFromSearchHistory(query: string) { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(getSearchHistory().filter(h => h !== query))); }
function clearSearchHistory() { localStorage.removeItem(SEARCH_HISTORY_KEY); }

type FilterType = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'mixes';
const filterOptions: { type: FilterType; label: string; icon: React.ReactNode }[] = [
  { type: 'all', label: 'All', icon: null },
  { type: 'tracks', label: 'Songs', icon: <Music className="h-3 w-3" /> },
  { type: 'artists', label: 'Artists', icon: <User className="h-3 w-3" /> },
  { type: 'albums', label: 'Albums', icon: <Disc className="h-3 w-3" /> },
  { type: 'playlists', label: 'Playlists', icon: <Music className="h-3 w-3" /> },
  { type: 'mixes', label: 'Mixes', icon: <Radio className="h-3 w-3" /> },
];

const isSpeechRecognitionSupported = () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

/** Read user onboarding artists/genres so search results can be biased toward taste. */
function getUserTaste(): { artists: Set<string>; genres: Set<string> } {
  try {
    const raw = localStorage.getItem("onboarding");
    if (raw) {
      const o = JSON.parse(raw);
      const artists = new Set<string>(((o.artists || []) as any[]).map((a) => (a.name || a).toString().toLowerCase()));
      const genres = new Set<string>(((o.genres || []) as any[]).map((g) => (g.name || g).toString().toLowerCase()));
      return { artists, genres };
    }
  } catch { /* ignore */ }
  return { artists: new Set(), genres: new Set() };
}

// Prioritize: match query against title, artist, album - best match first
function scoreMatch(query: string, item: { title?: string; name?: string; artist?: string; album?: string }): number {
  const q = query.toLowerCase();
  let score = 0;
  const title = (item.title || item.name || "").toLowerCase();
  const artist = (item.artist || "").toLowerCase();
  const album = (item.album || "").toLowerCase();
  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 80;
  else if (title.includes(q)) score += 50;
  if (artist === q) score += 90;
  else if (artist.startsWith(q)) score += 70;
  else if (artist.includes(q)) score += 40;
  if (album.includes(q)) score += 30;
  return score;
}

/**
 * Final ranking: relevance dominates, then popularity/recency breaks ties,
 * then a small personal-taste boost (matches user's onboarding artists/genres)
 * surfaces results closer to the user's profile.
 */
function rankedScore(
  query: string,
  item: any,
  taste: { artists: Set<string>; genres: Set<string> },
): number {
  let score = scoreMatch(query, item) + getCombinedScore(item) * 30;
  const artist = (item.artist || item.name || "").toString().toLowerCase();
  const album = (item.album || "").toString().toLowerCase();
  if (artist && taste.artists.has(artist)) score += 20;
  for (const g of taste.genres) {
    if (g && (artist.includes(g) || album.includes(g))) { score += 8; break; }
  }
  return score;
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Search() {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { query, debouncedQuery, setQuery, clearQuery } = useDebouncedSearch(400);
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const { data: playlists } = useQuery({ queryKey: ["user-playlists"], queryFn: getUserPlaylists, staleTime: 30_000 });
  const { data: genres } = useDeezerGenres();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    if (urlQuery && urlQuery !== query) { setQuery(urlQuery); window.history.replaceState({}, '', '/search'); }
  }, []);

  useEffect(() => {
    setSearchHistory(getSearchHistory());
    setSpeechSupported(isSpeechRecognitionSupported());
    if (isSpeechRecognitionSupported()) {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const r = new SR(); r.continuous = false; r.interimResults = true; r.lang = 'en-US';
      r.onresult = (e: any) => { const t = Array.from(e.results).map((r: any) => r[0].transcript).join(''); setQuery(t); };
      r.onend = () => setIsListening(false);
      r.onerror = () => setIsListening(false);
      setRecognition(r);
    }
  }, []);

  const toggleVoiceSearch = useCallback(() => {
    if (!recognition) return;
    if (isListening) { recognition.stop(); setIsListening(false); } else { recognition.start(); setIsListening(true); }
  }, [recognition, isListening]);

  const { data: searchResults, isLoading, error } = useSearchMusic(debouncedQuery);
  const { data: youtubeResults, isLoading: loadingYouTube } = useYouTubeSearch(debouncedQuery);
  // Piped (playback) + Deezer (metadata) pipeline — primary song results.
  const { data: unifiedTracks, isLoading: loadingUnified } = useUnifiedTrackSearch(debouncedQuery);
  const taste = useMemo(() => getUserTaste(), []);

  useEffect(() => {
    if (debouncedQuery.length >= 2 && searchResults) { addToSearchHistory(debouncedQuery); setSearchHistory(getSearchHistory()); }
  }, [debouncedQuery, searchResults]);

  const hasQuery = query.length > 0;
  const hasApiResults = searchResults && (searchResults.artists.length > 0 || searchResults.tracks.length > 0 || searchResults.albums.length > 0);

  // Songs come from Piped only (always playable). Deezer stays behind the
  // scenes as the metadata layer — its own rows are never listed.
  const filteredTracks: Track[] = ((unifiedTracks || []) as Track[])
    .slice()
    .sort((a, b) => rankedScore(debouncedQuery, b, taste) - rankedScore(debouncedQuery, a, taste));


  const filteredArtists = hasApiResults
    ? searchResults.artists.map((a): Artist => ({ id: a.id, name: a.name, avatar: a.avatar || '', monthlyListeners: a.monthlyListeners || 0 }))
        .sort((a, b) => rankedScore(debouncedQuery, { name: b.name, nb_fan: (b as any).monthlyListeners }, taste) - rankedScore(debouncedQuery, { name: a.name, nb_fan: (a as any).monthlyListeners }, taste))
    : [];

  const filteredAlbums: Album[] = hasApiResults
    ? searchResults.albums.map((a) => ({ id: a.id, title: a.name, artist: a.artist, artwork: a.artwork || '', trackCount: a.trackCount || 0 }))
        .sort((a, b) => rankedScore(debouncedQuery, b, taste) - rankedScore(debouncedQuery, a, taste))
    : [];

  // Also search playlists
  const matchingPlaylists = (playlists || []).filter(p => p.name.toLowerCase().includes(debouncedQuery.toLowerCase()));

  const podcasts: Podcast[] = youtubeResults?.slice(0, 6).map((v) => ({ id: v.id, title: v.title, author: v.channelTitle, image: v.thumbnail, description: v.title })) || [];

  usePreloadYouTube(filteredTracks.slice(0, 10), filteredTracks.length > 0);

  const showArtists = activeFilter === 'all' || activeFilter === 'artists';
  const showTracks = activeFilter === 'all' || activeFilter === 'tracks';
  const showAlbums = activeFilter === 'all' || activeFilter === 'albums';
  const showPlaylists = activeFilter === 'all' || activeFilter === 'playlists';
  const showMixes = activeFilter === 'mixes';

  // Find the top result across all types
  const topItems = [
    ...filteredTracks.map(t => ({ type: 'track' as const, score: scoreMatch(debouncedQuery, t), item: t })),
    ...filteredArtists.map(a => ({ type: 'artist' as const, score: scoreMatch(debouncedQuery, { name: a.name }), item: a })),
    ...filteredAlbums.map(a => ({ type: 'album' as const, score: scoreMatch(debouncedQuery, a), item: a })),
    ...matchingPlaylists.map(p => ({ type: 'playlist' as const, score: scoreMatch(debouncedQuery, { title: p.name }), item: p })),
  ].sort((a, b) => b.score - a.score);

  const topResult = topItems[0];


  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-4">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl px-4 pt-3 pb-3 border-b border-white/5"
      >
        <h1 className="mb-2 text-xl font-extrabold text-foreground">Search</h1>
        <motion.div animate={{ scale: isFocused ? 1.01 : 1 }} className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
            placeholder={isListening ? "Listening..." : "Songs, artists, albums, playlists"}
            className={`w-full rounded-lg py-2 pl-9 pr-16 text-[13px] font-medium focus:outline-none transition-colors ${isListening ? 'bg-primary/15 text-foreground placeholder:text-white/70' : 'bg-white text-black placeholder:text-black/55'}`} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading || loadingYouTube || loadingUnified ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : hasQuery ? <button onClick={clearQuery} className="p-1 text-black/60 hover:text-black"><X className="h-4 w-4" /></button> : null}
          </div>
        </motion.div>


        <AnimatePresence>
          {isListening && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex items-center gap-2 text-primary">
              <div className="flex gap-0.5">{[0,1,2,3,4].map((i) => <motion.div key={i} className="h-4 w-1 rounded-full bg-primary" animate={{ scaleY: [0.3, 1, 0.3] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }} />)}</div>
              <span className="text-sm">Listening... speak now</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {filterOptions.map((filter) => (
            <button key={filter.type} onClick={() => setActiveFilter(filter.type)}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                activeFilter === filter.type
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-white/12 bg-transparent text-white/75 hover:bg-white/5'
              }`}>{filter.icon}{filter.label}</button>
          ))}
        </motion.div>

      </motion.header>

      <div className="px-4 pt-4">
      {hasQuery ? (
        <div className="space-y-3">
          {/* Skeletons while the Piped pipeline resolves */}
          {(loadingUnified || isLoading) && topItems.length === 0 && <SearchSkeletons />}

          {/* Unified top results list — sorted by relevance, unlimited scroll */}

          {activeFilter === 'all' && topItems.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-bold text-foreground">Top Results</h2>
              <div className="space-y-1.5">
                {topItems.map((entry, i) => {
                  if (entry.type === 'track') {
                    const t = entry.item as Track;
                    return (
                      <motion.div key={`tr-${t.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-2 cursor-pointer hover:border-primary/30 hover:bg-white/[0.07] active:scale-[0.99] transition-all"
                        onClick={() => {
                          playTrack(t, filteredTracks);
                        }}>
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl">
                          <img src={t.artwork} alt="" loading="lazy" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                            <Music className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                            {(t as any).explicit && (
                              <span className="rounded-[3px] bg-muted px-1 text-[9px] font-bold text-muted-foreground">E</span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {[t.artist, t.album && t.album !== "Unknown Album" ? t.album : "", formatDuration(t.duration)].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </motion.div>
                    );

                  }
                  if (entry.type === 'artist') {
                    const a = entry.item as Artist;
                    return (
                      <motion.div key={`ar-${a.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
                        onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)}>
                        <img src={a.avatar} alt="" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
                          <p className="truncate text-xs text-muted-foreground">Artist</p>
                        </div>
                      </motion.div>
                    );
                  }
                  if (entry.type === 'album') {
                    const a = entry.item as Album;
                    return (
                      <motion.div key={`al-${a.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
                        onClick={() => navigate(`/album/${a.id.toString().replace("deezer-", "")}`)}>
                        <img src={a.artwork} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                          <p className="truncate text-xs text-muted-foreground">Album • {a.artist}</p>
                        </div>
                      </motion.div>
                    );
                  }
                  if (entry.type === 'playlist') {
                    const p = entry.item as any;
                    return (
                      <motion.div key={`pl-${p.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
                        onClick={() => navigate(`/user-playlist/${p.id}`)}>
                        <div className="h-12 w-12 rounded-lg bg-muted/30 overflow-hidden flex-shrink-0">
                          {p.cover_image ? <img src={p.cover_image} alt="" className="h-full w-full object-cover" /> : <Music className="h-5 w-5 text-muted-foreground m-auto mt-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">Playlist</p>
                        </div>
                      </motion.div>
                    );
                  }
                  return null;
                })}
              </div>
            </section>
          )}

          {/* Filtered views */}
          {showArtists && activeFilter === 'artists' && filteredArtists.length > 0 && (
            <section><h2 className="mb-2 text-base font-bold text-foreground">Artists</h2>
              <div className="space-y-1">{filteredArtists.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-white/10" onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)}>
                  <img src={a.avatar} alt="" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                  <div><p className="text-sm font-semibold text-foreground">{a.name}</p><p className="text-xs text-muted-foreground">Artist</p></div>
                </motion.div>
              ))}</div>
            </section>
          )}
          {showTracks && activeFilter === 'tracks' && filteredTracks.length > 0 && (
            <section><h2 className="mb-2 text-base font-bold text-foreground">Songs</h2>
              <div className="glass-card p-2">{filteredTracks.map((t, i) => <TrackCard key={t.id} track={t} index={i} contextTracks={filteredTracks} radioFromSearch />)}</div>
            </section>
          )}
          {showAlbums && activeFilter === 'albums' && filteredAlbums.length > 0 && (
            <section><h2 className="mb-2 text-base font-bold text-foreground">Albums</h2>
              <div className="space-y-1">{filteredAlbums.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-white/10" onClick={() => navigate(`/album/${a.id.toString().replace("deezer-", "")}`)}>
                  <img src={a.artwork} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                  <div><p className="text-sm font-semibold text-foreground">{a.title}</p><p className="text-xs text-muted-foreground">Album • {a.artist}</p></div>
                </motion.div>
              ))}</div>
            </section>
          )}
          {showMixes && (
            <MixesResults query={debouncedQuery} />
          )}
          {topItems.length === 0 && podcasts.length === 0 && !loadingUnified && !isLoading && (
            <div className="py-12 text-center"><p className="text-muted-foreground">No results found for "{query}"</p></div>
          )}
        </div>
      ) : (
        <SearchEmptyState
          setQuery={setQuery}
          searchHistory={searchHistory}
          clearSearchHistory={() => { clearSearchHistory(); setSearchHistory([]); }}
          removeFromSearchHistory={(item) => { removeFromSearchHistory(item); setSearchHistory(getSearchHistory()); }}
          toggleVoiceSearch={toggleVoiceSearch}
          isListening={isListening}
          speechSupported={speechSupported}
          genres={genres || []}
        />
      )}
      </div>
    </div>
  );
}

/** Mixes tab — YouTube long mixes from the youtube edge function. */
/** Loading placeholders shown while results stream in. */
function SearchSkeletons() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-2">
          <div className="h-14 w-14 flex-shrink-0 animate-pulse rounded-xl bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MixesResults({ query }: { query: string }) {

  const { playVideo } = usePlayer();
  const { data, isLoading } = useQuery({
    queryKey: ["search-mixes", query],
    queryFn: async () => {
      const q = `${query} mix`;
      const { data } = await supabase.functions.invoke("youtube", {
        body: { action: "search", params: { query: q, maxResults: 20 } },
      });
      const items: any[] = data?.items || data?.results || data?.videos || (Array.isArray(data) ? data : []);
      return items.filter((v) => (v.duration || 0) >= 15 * 60 || /mix|hour/i.test(v.title || ""));
    },
    enabled: !!query && query.length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  if (!query) return null;
  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Finding mixes…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">No mixes found.</p>;

  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-foreground">Mixes</h2>
      <div className="space-y-2">
        {data.map((v: any) => (
          <button key={v.id} onClick={() => playVideo({
            id: `yt-mix-${v.id}`, title: v.title, artist: v.channelTitle || "YouTube",
            youtubeId: v.id, thumbnail: v.thumbnail || "", duration: v.duration || 0,
          })} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/10 transition-colors">
            <img src={v.thumbnail} alt="" className="h-14 w-20 rounded-lg object-cover flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{v.title}</p>
              <p className="truncate text-xs text-muted-foreground">Mix • {v.channelTitle || "YouTube"}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- */
/* Image-9 inspired empty state: voice hero, trending chips, artists grid */
/* --------------------------------------------------------------- */
function SearchEmptyState({
  setQuery, searchHistory, clearSearchHistory, removeFromSearchHistory,
  toggleVoiceSearch, isListening, speechSupported, genres,
}: any) {
  const navigate = useNavigate();
  const { data: popularArtistsData } = useQuery({
    queryKey: ["search-popular-artists"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("deezer", {
        body: { action: "getChart", params: { type: "artists", limit: 9 } },
      });
      return (data?.artists?.data || data?.data || []) as any[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const trending = ["Taylor Swift", "Drake", "Billie Eilish", "Lofi Beats", "Afrobeats", "Top 50"];

  // Pull 3 short Piped trending videos for the muted preview row.
  const { data: shorts } = useQuery({
    queryKey: ["search-piped-shorts"],
    queryFn: async () => {
      try {
        const res = await fetch("https://pipedapi.kavin.rocks/trending?region=US");
        const arr: any[] = await res.json();
        return (arr || [])
          .filter((v) => v?.duration > 0 && v.duration <= 90 && v?.url)
          .slice(0, 3)
          .map((v) => ({
            id: (v.url || "").split("v=")[1] || v.url,
            title: v.title,
            thumb: v.thumbnail,
          }));
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="space-y-4 pt-2">
      {searchHistory.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Recent Searches</h2>
            <button onClick={clearSearchHistory} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Clear all</button>
          </div>
          <div className="space-y-0.5">
            {searchHistory.map((item: string) => (
              <div key={item} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-white/5 group">
                <button onClick={() => setQuery(item)} className="flex items-center gap-3 min-w-0 flex-1">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{item}</span>
                </button>
                <button onClick={() => removeFromSearchHistory(item)} className="p-1 opacity-0 group-hover:opacity-100">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {searchHistory.length === 0 && (
        <div className="pt-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">Search across songs, artists, albums, playlists and mixes.</p>
        </div>
      )}
    </div>
  );
}

