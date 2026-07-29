import { supabase } from "@/integrations/supabase/client";

export interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrackRow {
  id: string;
  playlist_id: string;
  track_title: string;
  track_artist: string;
  track_album: string | null;
  track_artwork: string | null;
  track_duration: number | null;
  track_preview: string | null;
  position: number;
  added_at: string;
}

// ── Local storage fallback for non-authenticated users ──

const LOCAL_PLAYLISTS_KEY = "tunestream_local_playlists";
const LOCAL_PLAYLIST_TRACKS_KEY = "tunestream_local_playlist_tracks";

function getLocalPlaylists(): PlaylistRow[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_PLAYLISTS_KEY) || "[]"); } catch { return []; }
}
function saveLocalPlaylists(p: PlaylistRow[]) {
  localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(p));
}
function getLocalPlaylistTracks(): PlaylistTrackRow[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_PLAYLIST_TRACKS_KEY) || "[]"); } catch { return []; }
}
function saveLocalPlaylistTracks(t: PlaylistTrackRow[]) {
  localStorage.setItem(LOCAL_PLAYLIST_TRACKS_KEY, JSON.stringify(t));
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

// ── Playlists ──

export async function getUserPlaylists(): Promise<PlaylistRow[]> {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    // Return local playlists for non-authenticated users
    return getLocalPlaylists();
  }

  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching playlists:", error);
    // Fallback to local
    return getLocalPlaylists();
  }
  return (data ?? []) as PlaylistRow[];
}

export async function createPlaylist(name: string, description?: string, isPublic = true): Promise<PlaylistRow | null> {
  const userId = await getCurrentUserId();

  if (!userId) {
    // Create locally
    const newPlaylist: PlaylistRow = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: "local",
      name,
      description: description ?? null,
      is_public: isPublic,
      cover_image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const playlists = getLocalPlaylists();
    playlists.unshift(newPlaylist);
    saveLocalPlaylists(playlists);
    return newPlaylist;
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert({ user_id: userId, name, description: description ?? null, is_public: isPublic })
    .select()
    .single();

  if (error) {
    console.error("Error creating playlist:", error);
    return null;
  }
  return data as PlaylistRow;
}

export async function updatePlaylist(id: string, updates: Partial<Pick<PlaylistRow, "name" | "description" | "is_public" | "cover_image">>): Promise<boolean> {
  if (id.startsWith("local-")) {
    const playlists = getLocalPlaylists();
    const idx = playlists.findIndex(p => p.id === id);
    if (idx >= 0) {
      Object.assign(playlists[idx], updates, { updated_at: new Date().toISOString() });
      saveLocalPlaylists(playlists);
    }
    return true;
  }

  const { error } = await supabase.from("playlists").update(updates).eq("id", id);
  if (error) { console.error("Error updating playlist:", error); return false; }
  return true;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  if (id.startsWith("local-")) {
    saveLocalPlaylists(getLocalPlaylists().filter(p => p.id !== id));
    const tracks = getLocalPlaylistTracks().filter(t => t.playlist_id !== id);
    saveLocalPlaylistTracks(tracks);
    return true;
  }

  const { error } = await supabase.from("playlists").delete().eq("id", id);
  if (error) { console.error("Error deleting playlist:", error); return false; }
  return true;
}

// ── Playlist Tracks ──

export async function getPlaylistTracks(playlistId: string): Promise<PlaylistTrackRow[]> {
  if (playlistId.startsWith("local-")) {
    return getLocalPlaylistTracks()
      .filter(t => t.playlist_id === playlistId)
      .sort((a, b) => a.position - b.position);
  }

  const { data, error } = await supabase
    .from("playlist_tracks")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error) { console.error("Error fetching playlist tracks:", error); return []; }
  return (data ?? []) as PlaylistTrackRow[];
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: { title: string; artist: string; album?: string; artwork?: string; duration?: number; preview?: string }
): Promise<boolean> {
  if (playlistId.startsWith("local-")) {
    const tracks = getLocalPlaylistTracks();
    const existing = tracks.filter(t => t.playlist_id === playlistId);
    const nextPosition = existing.length > 0 ? Math.max(...existing.map(t => t.position)) + 1 : 0;
    tracks.push({
      id: `lt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playlist_id: playlistId,
      track_title: track.title,
      track_artist: track.artist,
      track_album: track.album ?? null,
      track_artwork: track.artwork ?? null,
      track_duration: track.duration ?? 0,
      track_preview: track.preview ?? null,
      position: nextPosition,
      added_at: new Date().toISOString(),
    });
    saveLocalPlaylistTracks(tracks);
    return true;
  }

  const { data: existing } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase
    .from("playlist_tracks")
    .insert({
      playlist_id: playlistId,
      track_title: track.title,
      track_artist: track.artist,
      track_album: track.album ?? null,
      track_artwork: track.artwork ?? null,
      track_duration: track.duration ?? 0,
      track_preview: track.preview ?? null,
      position: nextPosition,
    });

  if (error) { console.error("Error adding track:", error); return false; }
  return true;
}

export async function addTracksToPlaylist(
  playlistId: string,
  tracks: Array<{ title: string; artist: string; album?: string; artwork?: string; duration?: number; preview?: string }>
): Promise<boolean> {
  if (playlistId.startsWith("local-")) {
    const allTracks = getLocalPlaylistTracks();
    const existing = allTracks.filter(t => t.playlist_id === playlistId);
    let nextPos = existing.length > 0 ? Math.max(...existing.map(t => t.position)) + 1 : 0;
    for (const t of tracks) {
      allTracks.push({
        id: `lt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nextPos}`,
        playlist_id: playlistId,
        track_title: t.title,
        track_artist: t.artist,
        track_album: t.album ?? null,
        track_artwork: t.artwork ?? null,
        track_duration: t.duration ?? 0,
        track_preview: t.preview ?? null,
        position: nextPos++,
        added_at: new Date().toISOString(),
      });
    }
    saveLocalPlaylistTracks(allTracks);
    return true;
  }

  const { data: existing } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);

  let nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const rows = tracks.map((t) => ({
    playlist_id: playlistId,
    track_title: t.title,
    track_artist: t.artist,
    track_album: t.album ?? null,
    track_artwork: t.artwork ?? null,
    track_duration: t.duration ?? 0,
    track_preview: t.preview ?? null,
    position: nextPosition++,
  }));

  const { error } = await supabase.from("playlist_tracks").insert(rows);
  if (error) { console.error("Error adding tracks:", error); return false; }
  return true;
}

export async function removeTrackFromPlaylist(trackId: string): Promise<boolean> {
  if (trackId.startsWith("lt-")) {
    saveLocalPlaylistTracks(getLocalPlaylistTracks().filter(t => t.id !== trackId));
    return true;
  }

  const { error } = await supabase.from("playlist_tracks").delete().eq("id", trackId);
  if (error) { console.error("Error removing track:", error); return false; }
  return true;
}

export async function reorderPlaylistTracks(playlistId: string, orderedIds: string[]): Promise<boolean> {
  if (playlistId.startsWith("local-")) {
    const allTracks = getLocalPlaylistTracks();
    orderedIds.forEach((id, index) => {
      const t = allTracks.find(tr => tr.id === id);
      if (t) t.position = index;
    });
    saveLocalPlaylistTracks(allTracks);
    return true;
  }

  const updates = orderedIds.map((id, index) =>
    supabase.from("playlist_tracks").update({ position: index }).eq("id", id).eq("playlist_id", playlistId)
  );

  const results = await Promise.allSettled(updates);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) { console.error("Some reorder updates failed:", failed); return false; }
  return true;
}

export async function getPublicPlaylists(limit = 20): Promise<PlaylistRow[]> {
  const { data, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error fetching public playlists:", error); return []; }
  return (data ?? []) as PlaylistRow[];
}
