import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function PlaylistsContainingSection({ title, artist }: { title: string; artist: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['playlists-containing', title, artist],
    queryFn: async () => {
      if (!user) return [];
      // Find playlist_tracks matching this song
      const { data: tracks } = await supabase
        .from('playlist_tracks')
        .select('playlist_id')
        .ilike('track_title', `%${title}%`)
        .ilike('track_artist', `%${artist}%`);

      if (!tracks || tracks.length === 0) return [];

      const playlistIds = [...new Set(tracks.map(t => t.playlist_id))];
      const { data: playlistData } = await supabase
        .from('playlists')
        .select('*')
        .in('id', playlistIds);

      return playlistData || [];
    },
    enabled: !!title && !!artist,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;
  if (!playlists || playlists.length === 0) return null;

  return (
    <div className="px-5 mt-5 pb-4">
      <h3 className="text-lg font-bold text-white mb-3">In Your Playlists</h3>
      <div className="space-y-1">
        {playlists.map((pl: any) => (
          <button
            key={pl.id}
            onClick={() => navigate(`/playlist/${pl.id}`)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/5 transition-colors"
          >
            <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {pl.cover_image ? (
                <img src={pl.cover_image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg"></span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
              <p className="text-xs text-white/40 truncate">{pl.description || 'Playlist'}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
