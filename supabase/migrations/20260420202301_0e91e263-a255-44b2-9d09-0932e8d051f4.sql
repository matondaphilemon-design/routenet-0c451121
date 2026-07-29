-- Liked Songs table (anonymous device_id based, matching app's auth model)
CREATE TABLE public.liked_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  track_artist TEXT NOT NULL,
  track_album TEXT,
  track_artwork TEXT,
  track_duration INTEGER DEFAULT 0,
  youtube_id TEXT,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, track_title, track_artist)
);

CREATE INDEX idx_liked_songs_device ON public.liked_songs(device_id, liked_at DESC);

ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read liked songs"
ON public.liked_songs FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert liked songs"
ON public.liked_songs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can delete liked songs"
ON public.liked_songs FOR DELETE
TO anon, authenticated
USING (true);