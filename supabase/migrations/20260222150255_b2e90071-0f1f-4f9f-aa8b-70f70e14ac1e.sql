
-- Drop all existing RESTRICTIVE policies on playlists
DROP POLICY IF EXISTS "Anyone can read public playlists" ON public.playlists;
DROP POLICY IF EXISTS "Users can create their own playlists" ON public.playlists;
DROP POLICY IF EXISTS "Users can delete their own playlists" ON public.playlists;
DROP POLICY IF EXISTS "Users can update their own playlists" ON public.playlists;

-- Drop all existing RESTRICTIVE policies on playlist_tracks
DROP POLICY IF EXISTS "Anyone can read tracks of accessible playlists" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Playlist owners can add tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Playlist owners can delete tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Playlist owners can update tracks" ON public.playlist_tracks;

-- Recreate as PERMISSIVE policies on playlists
CREATE POLICY "Anyone can read public playlists"
ON public.playlists FOR SELECT
USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own playlists"
ON public.playlists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playlists"
ON public.playlists FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlists"
ON public.playlists FOR DELETE
USING (auth.uid() = user_id);

-- Recreate as PERMISSIVE policies on playlist_tracks
CREATE POLICY "Anyone can read tracks of accessible playlists"
ON public.playlist_tracks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM playlists
  WHERE playlists.id = playlist_tracks.playlist_id
  AND (playlists.is_public = true OR playlists.user_id = auth.uid())
));

CREATE POLICY "Playlist owners can add tracks"
ON public.playlist_tracks FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM playlists
  WHERE playlists.id = playlist_tracks.playlist_id
  AND playlists.user_id = auth.uid()
));

CREATE POLICY "Playlist owners can update tracks"
ON public.playlist_tracks FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM playlists
  WHERE playlists.id = playlist_tracks.playlist_id
  AND playlists.user_id = auth.uid()
));

CREATE POLICY "Playlist owners can delete tracks"
ON public.playlist_tracks FOR DELETE
USING (EXISTS (
  SELECT 1 FROM playlists
  WHERE playlists.id = playlist_tracks.playlist_id
  AND playlists.user_id = auth.uid()
));
