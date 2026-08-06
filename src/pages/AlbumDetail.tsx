/**
 * Album detail — built on the shared DetailPage layout.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/data/mockData";
import { DetailPage, totalLength } from "@/components/detail/DetailPage";
import { useDeezerAlbum } from "@/hooks/useMusicSearch";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { getLikedAlbums, toggleLikedAlbum } from "@/pages/Library";
import { toTitleCase } from "@/utils/toTitleCase";

export default function AlbumDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(false);

  const { data: album, isLoading } = useDeezerAlbum(id);

  useEffect(() => {
    if (album) setIsSaved(getLikedAlbums().some((a) => a.id === id));
  }, [album, id]);

  const tracks: Track[] = useMemo(
    () =>
      ((album?.tracks?.data || []) as any[]).map((t) => ({
        id: `deezer-album-${album?.id}-${t.id}`,
        title: toTitleCase(t.title),
        artist: toTitleCase(t.artist?.name || album?.artist?.name || "Unknown Artist"),
        album: album?.title || "",
        artwork: album?.cover_xl || album?.cover_big || album?.cover_medium || "",
        duration: t.duration || 0,
        explicit: Boolean(t.explicit_lyrics),
        streams: typeof t.rank === "number" ? t.rank * 1000 : undefined,
        trackNumber: t.track_position ?? undefined,
        diskNumber: t.disk_number ?? undefined,
      })) as Track[],
    [album],
  );

  usePreloadYouTube(tracks, tracks.length > 0);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <p className="text-sm text-muted-foreground">This album couldn't be loaded.</p>
        <button onClick={() => navigate(-1)} className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground">Go back</button>
      </div>
    );
  }

  const cover = album.cover_xl || album.cover_big || album.cover_medium || "";
  const year = (album.release_date || "").slice(0, 4);

  const handleSave = () => {
    const result = toggleLikedAlbum({
      id,
      title: album.title,
      artist: album.artist?.name || "Unknown",
      artwork: album.cover_medium || album.cover || "",
    });
    setIsSaved(result);
    toast.success(result ? "Saved to your library" : "Removed from your library");
  };

  return (
    <DetailPage
      cover={cover}
      title={toTitleCase(album.title)}
      typeLabel="Album"
      meta={[year, `${tracks.length} songs`, totalLength(tracks), album.label ? String(album.label) : ""]}
      owner={{
        name: toTitleCase(album.artist?.name || ""),
        image: album.artist?.picture_small,
        onClick: () => navigate(`/artist/${encodeURIComponent(album.artist?.name || "")}`),
      }}
      tracks={tracks}
      isSaved={isSaved}
      onToggleSave={handleSave}
      group={{ groupKey: `album-${id}`, groupName: album.title || "Album", groupType: "album" }}
    />
  );
}
