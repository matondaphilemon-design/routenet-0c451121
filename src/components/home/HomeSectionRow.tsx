import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SectionDescriptor, SectionResult } from "@/services/homeFeedEngine";
import type { Track } from "@/data/mockData";
import { SongCard, AlbumCard, PlaylistCard, ArtistCard, CardSkeleton, SongListRow, SongListColumn, MusicVideoCard, ListSkeleton, VideoSkeleton } from "./cards/UnifiedCards";

interface Props {
  section: SectionDescriptor;
  onPlay: (track: Track, source: Track[]) => void;
}

export function HomeSectionRow({ section, onPlay }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<SectionResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "empty">("idle");

  useEffect(() => {
    if (!ref.current || state !== "idle") return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        setState("loading");
        section.load()
          .then((res) => {
            const count =
              (res.songs?.length ?? 0) +
              (res.albums?.length ?? 0) +
              (res.playlists?.length ?? 0) +
              (res.artists?.length ?? 0) +
              (res.videos?.length ?? 0);
            setData(res);
            setState(count > 0 ? "loaded" : "empty");
          })
          .catch(() => setState("empty"));
      }
    }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [section, state]);

  const isArtistKind = section.kind === "artists";

  const items = (() => {
    if (!data) return null;
    if (section.kind === "videos" && data.videos?.length) {
      return data.videos.slice(0, 12).map((v) => (
        <MusicVideoCard
          key={v.id}
          video={v}
          onClick={() => onPlay(
            { id: `yt-${v.videoId}`, title: v.title, artist: v.artist, album: "", artwork: v.thumbnail, duration: v.duration || 0, youtubeId: v.videoId } as Track,
            (data.videos || []).map((x) => ({ id: `yt-${x.videoId}`, title: x.title, artist: x.artist, album: "", artwork: x.thumbnail, duration: x.duration || 0, youtubeId: x.videoId } as Track)),
          )}
        />
      ));
    }
    if (section.kind === "songlist" && data.songs?.length) {
      const songs = data.songs.slice(0, 16);
      const columns: Track[][] = [];
      for (let i = 0; i < songs.length; i += 4) columns.push(songs.slice(i, i + 4));
      return columns.map((col, ci) => (
        <SongListColumn key={`col-${ci}`}>
          {col.map((t) => (
            <SongListRow key={t.id} track={t} onPlay={() => onPlay(t, songs)} />
          ))}
        </SongListColumn>
      ));
    }
    if (data.songs?.length) {
      return data.songs.slice(0, 20).map((t) => (
        <SongCard key={t.id} track={t} onClick={() => onPlay(t, data.songs!)} />
      ));
    }
    if (data.albums?.length) {
      return data.albums.slice(0, 20).map((a) => (
        <AlbumCard key={a.id} album={a} onClick={() => navigate(`/album/${encodeURIComponent(a.title)}`)} />
      ));
    }
    if (data.playlists?.length) {
      return data.playlists.slice(0, 20).map((p) => (
        <PlaylistCard key={p.id} playlist={p} onClick={() => navigate(`/playlist/${p.id}`)} />
      ));
    }
    if (data.artists?.length) {
      return data.artists.slice(0, 20).map((a) => (
        <ArtistCard key={a.id} artist={a} onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)} />
      ));
    }
    return null;
  })();

  return (
    <section ref={ref} className="space-y-3.5">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-extrabold tracking-tight text-foreground sm:text-xl">{data?.title || section.title}</h2>
          {section.subtitle && <p className="truncate text-[11px] font-medium text-muted-foreground">{section.subtitle}</p>}
        </div>
      </div>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-1 scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-3 sm:gap-4">
          {items ?? Array.from({ length: section.kind === "videos" ? 3 : section.kind === "songlist" ? 2 : 6 }).map((_, i) =>
            section.kind === "videos" ? <VideoSkeleton key={i} />
              : section.kind === "songlist" ? <ListSkeleton key={i} />
              : <CardSkeleton key={i} round={isArtistKind} />)}
          {items && section.kind !== "videos" && section.kind !== "songlist" && Array.from({ length: Math.max(0, 6 - (data?.songs?.length || data?.albums?.length || data?.playlists?.length || data?.artists?.length || 0)) }).map((_, i) => (
            <CardSkeleton key={`placeholder-${i}`} round={isArtistKind} />
          ))}
        </div>
      </div>
    </section>
  );
}

