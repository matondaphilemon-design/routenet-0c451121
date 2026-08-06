/**
 * Editorial / YouTube playlist detail — built on the shared DetailPage layout.
 */
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Track } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { DetailPage, totalLength } from "@/components/detail/DetailPage";
import { supabase } from "@/integrations/supabase/client";
import { transformTrack } from "@/services/deezer";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";

interface PlaylistData {
  id: number;
  title: string;
  description?: string;
  picture_big?: string;
  picture_medium?: string;
  nb_tracks?: number;
  creator?: { name?: string };
  user?: { name?: string };
}

/** YouTube playlists (ids prefixed with `yt-`) come from the homepage feed. */
async function fetchYouTubePlaylist(playlistId: string): Promise<{ playlist: PlaylistData | null; tracks: Track[] }> {
  try {
    const { data } = await supabase.functions.invoke("youtube", {
      body: { action: "getPlaylistItems", params: { playlistId, limit: 50 } },
    });
    const items: any[] = data?.data || [];
    const tracks: Track[] = items.map((v) => ({
      id: `yt-${v.videoId}`,
      title: v.title,
      artist: (v.channelTitle || "YouTube").replace(/\s*-\s*Topic$/i, ""),
      album: "",
      artwork: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      duration: 0,
      youtubeId: v.videoId,
    }));
    return {
      playlist: {
        id: 0,
        title: "YouTube Playlist",
        picture_big: tracks[0]?.artwork,
        nb_tracks: tracks.length,
        creator: { name: tracks[0]?.artist },
      } as PlaylistData,
      tracks,
    };
  } catch (e) {
    console.warn("[PlaylistDetail] youtube fetch failed", e);
    return { playlist: null, tracks: [] };
  }
}

async function fetchPlaylist(id: string): Promise<{ playlist: PlaylistData | null; tracks: Track[] }> {
  if (id.startsWith("yt-")) return fetchYouTubePlaylist(id.slice(3));
  try {
    const { data: pl } = await supabase.functions.invoke("deezer", {
      body: { action: "getPlaylist", params: { playlistId: id } },
    });
    const { data: tr } = await supabase.functions.invoke("deezer", {
      body: { action: "getPlaylistTracks", params: { playlistId: id, limit: 100 } },
    });
    const tracks = (tr?.data || []).map(transformTrack) as Track[];
    return { playlist: pl || null, tracks };
  } catch (e) {
    console.warn("[PlaylistDetail] fetch failed", e);
    return { playlist: null, tracks: [] };
  }
}

export default function PlaylistDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();

  // Support both raw Deezer IDs and legacy "deezer-…" prefixes.
  const cleanId = id.replace(/^deezer-/, "");

  const { data, isLoading } = useQuery({
    queryKey: ["playlist", cleanId],
    queryFn: () => fetchPlaylist(cleanId),
    enabled: !!cleanId,
    staleTime: 5 * 60 * 1000,
  });

  const playlist = data?.playlist;
  const tracks = data?.tracks || [];

  usePreloadYouTube(tracks, tracks.length > 0);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">We couldn't load this playlist.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  const cover = playlist?.picture_big || playlist?.picture_medium || tracks[0]?.artwork || "/placeholder.svg";
  const title = playlist?.title || "Playlist";
  const creator = playlist?.creator?.name || playlist?.user?.name || "Deezer";

  return (
    <DetailPage
      cover={cover}
      title={title}
      typeLabel="Playlist"
      meta={[playlist?.description, `${tracks.length} songs`, totalLength(tracks)]}
      owner={{ name: creator, image: cover }}
      tracks={tracks}
      group={{ groupKey: `playlist-${cleanId}`, groupName: title, groupType: "playlist" }}
    />
  );
}
