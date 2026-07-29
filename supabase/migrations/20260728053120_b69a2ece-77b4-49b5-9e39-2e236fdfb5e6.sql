
-- user_taste_events
CREATE TABLE public.user_taste_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  track_id text,
  track_title text,
  artist text,
  genre text,
  weight real NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_taste_events TO authenticated;
GRANT ALL ON public.user_taste_events TO service_role;
ALTER TABLE public.user_taste_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own taste events" ON public.user_taste_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_taste_events_user_created_idx ON public.user_taste_events (user_id, created_at DESC);

-- user_settings
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- followed_artists
CREATE TABLE public.followed_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  artist_id text,
  artist_name text NOT NULL,
  artist_image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, artist_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followed_artists TO authenticated;
GRANT ALL ON public.followed_artists TO service_role;
ALTER TABLE public.followed_artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own follows" ON public.followed_artists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
