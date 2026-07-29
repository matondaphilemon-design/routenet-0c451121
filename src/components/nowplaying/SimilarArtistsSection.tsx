import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function SimilarArtistsSection({ artistName }: { artistName: string }) {
  const navigate = useNavigate();

  const { data: artists, isLoading } = useQuery({
    queryKey: ['similar-artists-section', artistName],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('lastfm', {
        body: { action: 'getSimilarArtists', params: { name: artistName, limit: 10 } },
      });
      const similar = data?.similarartists?.artist || [];

      const enriched = await Promise.allSettled(
        similar.slice(0, 10).map(async (a: any) => {
          const { data: dz } = await supabase.functions.invoke('deezer', {
            body: { action: 'searchArtist', params: { query: a.name, limit: 1 } },
          });
          const dzArtist = dz?.data?.[0];
          return {
            name: a.name,
            image: dzArtist?.picture_medium || dzArtist?.picture || a.image?.[2]?.['#text'] || '',
            fans: dzArtist?.nb_fan || 0,
          };
        })
      );

      return enriched
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(a => a.image);
    },
    enabled: !!artistName,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="px-5 mt-5">
        <h3 className="text-lg font-bold text-white mb-3">Artists Like This</h3>
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
      </div>
    );
  }

  if (!artists || artists.length === 0) return null;

  return (
    <div className="px-5 mt-5">
      <h3 className="text-lg font-bold text-white mb-3">Artists Like This</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {artists.map((artist: any, i: number) => (
          <motion.button
            key={artist.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
            className="flex-shrink-0 flex flex-col items-center gap-2 w-24"
          >
            <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-white/10">
              <img src={artist.image} alt={artist.name} className="h-full w-full object-cover" />
            </div>
            <p className="text-xs font-semibold text-white truncate w-full text-center">{artist.name}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
