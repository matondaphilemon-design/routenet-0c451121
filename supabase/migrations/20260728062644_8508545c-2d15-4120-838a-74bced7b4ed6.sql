CREATE TABLE public.discovered_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_track_id text NOT NULL,
  seed_title text NOT NULL,
  seed_artist text NOT NULL,
  playlist_id text NOT NULL,
  playlist_title text,
  playlist_image text,
  tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.discovered_playlists TO authenticated;
GRANT SELECT, INSERT ON public.discovered_playlists TO anon;
GRANT ALL ON public.discovered_playlists TO service_role;

ALTER TABLE public.discovered_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discovered playlists" ON public.discovered_playlists FOR SELECT USING (true);
CREATE POLICY "Anyone can insert discovered playlists" ON public.discovered_playlists FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_discovered_playlists_seed_track_id ON public.discovered_playlists(seed_track_id);
CREATE INDEX IF NOT EXISTS idx_discovered_playlists_playlist_id ON public.discovered_playlists(playlist_id);