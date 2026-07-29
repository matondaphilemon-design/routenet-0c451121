import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Track } from "@/data/mockData";

function getDeviceId(): string {
  let id = localStorage.getItem("tunestream_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("tunestream_device_id", id);
  }
  return id;
}

export interface LikedSong {
  id: string;
  track_title: string;
  track_artist: string;
  track_album: string | null;
  track_artwork: string | null;
  track_duration: number | null;
  youtube_id: string | null;
  liked_at: string;
}

function getLocalLikedSongs(): LikedSong[] {
  try {
    const local = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]") as Track[];
    return local.map((track, index) => ({
      id: `local-${track.id || index}`,
      track_title: track.title,
      track_artist: track.artist,
      track_album: track.album || null,
      track_artwork: track.artwork || null,
      track_duration: track.duration || 0,
      youtube_id: (track as any).youtubeId || null,
      liked_at: new Date(Date.now() - index).toISOString(),
    }));
  } catch {
    return [];
  }
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function useLikedSongs() {
  const [songs, setSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const userId = await getCurrentUserId();
    let remote: LikedSong[] = [];

    if (userId) {
      const { data, error } = await supabase
        .from("liked_songs")
        .select("*")
        .eq("user_id", userId)
        .order("liked_at", { ascending: false });
      remote = !error ? (data || []) : [];
    }

    const merged = [...getLocalLikedSongs(), ...remote].filter((song, index, arr) =>
      arr.findIndex((candidate) =>
        candidate.track_title.toLowerCase() === song.track_title.toLowerCase()
        && candidate.track_artist.toLowerCase() === song.track_artist.toLowerCase()
      ) === index
    );
    setSongs(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("liked-updated", onChange);
    return () => window.removeEventListener("liked-updated", onChange);
  }, [refresh]);

  return { songs, loading, refresh };
}

export async function likeSong(track: Track): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return true; // rely on localStorage when not signed in

  const deviceId = getDeviceId();
  const { error } = await supabase.from("liked_songs").insert({
    user_id: userId,
    device_id: deviceId,
    track_title: track.title,
    track_artist: track.artist,
    track_album: track.album || null,
    track_artwork: track.artwork || null,
    track_duration: track.duration || 0,
    youtube_id: (track as any).youtubeId || null,
  });
  return !error;
}

export async function unlikeSong(title: string, artist: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return true; // rely on localStorage when not signed in

  const { error } = await supabase
    .from("liked_songs")
    .delete()
    .eq("user_id", userId)
    .eq("track_title", title)
    .eq("track_artist", artist);
  return !error;
}

export async function isSongLiked(title: string, artist: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) {
    // fall back to localStorage when not signed in
    return getLocalLikedSongs().some(
      (s) =>
        s.track_title.toLowerCase() === title.toLowerCase()
        && s.track_artist.toLowerCase() === artist.toLowerCase()
    );
  }

  const { data } = await supabase
    .from("liked_songs")
    .select("id")
    .eq("user_id", userId)
    .eq("track_title", title)
    .eq("track_artist", artist)
    .maybeSingle();
  return !!data;
}

export function likedSongToTrack(s: LikedSong): Track {
  return {
    id: `liked-${s.id}`,
    title: s.track_title,
    artist: s.track_artist,
    album: s.track_album || "",
    artwork: s.track_artwork || "",
    duration: s.track_duration || 0,
    ...(s.youtube_id ? { youtubeId: s.youtube_id } : {}),
  } as Track;
}
