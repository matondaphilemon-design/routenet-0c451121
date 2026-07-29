/**
 * Deezer API helpers — routed through the `deezer` edge function so we
 * inherit its proxy fallback + CORS. Never call api.deezer.com directly
 * from the client (blocked in the browser).
 */
import { supabase } from "@/integrations/supabase/client";

async function call(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("deezer", {
    body: { action, params },
  });
  if (error) throw error;
  return data;
}

export async function getGenres() {
  const d = await call("getGenres");
  return (d?.data || []).filter((g: any) => g.id !== 0);
}

export async function searchArtist(name: string, limit = 20) {
  const d = await call("searchArtist", { name, limit });
  return d?.data || [];
}

export async function getArtistTopTracks(artistId: number | string, limit = 10) {
  const d = await call("getArtistTopTracks", { artistId, limit });
  return d?.data || [];
}

export async function getArtistAlbums(artistId: number | string, limit = 10) {
  const d = await call("getArtistAlbums", { artistId, limit });
  return d?.data || [];
}

export async function getGenreArtists(genreId: number, limit = 20) {
  const d = await call("getGenreArtists", { genreId, limit });
  return d?.data || [];
}

export async function getGenreTracks(genreId: number, limit = 20) {
  const d = await call("getGenreTracks", { genreId, limit });
  return d?.data || d?.tracks?.data || [];
}

export async function getChart(limit = 30) {
  const d = await call("getChart", { type: "tracks", limit });
  return d?.data || d?.tracks?.data || [];
}

export async function getLocalChart(country: string, limit = 20) {
  const d = await call("getLocalChart", { country, limit });
  return d?.data || d?.tracks?.data || [];
}

export async function getEditorialReleases(limit = 20) {
  const d = await call("getEditorialReleases", { limit });
  return d?.data || [];
}

export async function getArtistRadio(artistId: number | string, limit = 25) {
  const d = await call("getArtistRadio", { artistId, limit });
  return d?.data || [];
}

export async function getPlaylistTracks(playlistId: number | string, limit = 25) {
  const d = await call("getPlaylistTracks", { playlistId, limit });
  return d?.data || [];
}

/** Search Deezer for playlists matching a query. */
export async function searchPlaylists(query: string, limit = 10) {
  try {
    const d = await call("searchPlaylist", { query, limit });
    if (d?.data?.length) return d.data;
  } catch { /* fall through */ }
  // Fallback via public proxy (safe read-only endpoint)
  try {
    const url = `https://corsproxy.io/?${encodeURIComponent(
      `https://api.deezer.com/search/playlist?q=${encodeURIComponent(query)}&limit=${limit}`,
    )}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const j = await res.json();
    return j?.data || [];
  } catch {
    return [];
  }
}

export function transformTrack(t: any) {
  return {
    id: `deezer-${t.id}`,
    deezerId: t.id,
    title: t.title || t.title_short || "Unknown",
    artist: t.artist?.name || "Unknown",
    artistId: t.artist?.id,
    album: t.album?.title || "",
    artwork: t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "/placeholder.svg",
    duration: t.duration || 0,
    preview: t.preview,
    streams: t.rank || 0,
    releaseDate: t.release_date,
  };
}

export function transformArtist(a: any) {
  return {
    id: a.id,
    name: a.name,
    picture: a.picture_big || a.picture_medium || a.picture || "",
    fans: a.nb_fan || 0,
  };
}

export function transformPlaylist(p: any) {
  return {
    id: p.id,
    title: p.title,
    cover: p.picture_big || p.picture_medium || p.picture || "",
    description: p.description || "",
    trackCount: p.nb_tracks || 0,
    creator: p.user?.name || p.creator?.name || "Deezer",
  };
}

export function transformAlbum(a: any) {
  return {
    id: a.id,
    title: a.title,
    cover: a.cover_big || a.cover_medium || a.cover || "",
    artist: a.artist?.name || "",
    releaseDate: a.release_date,
  };
}
