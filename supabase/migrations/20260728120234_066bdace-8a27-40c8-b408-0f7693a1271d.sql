-- Shared updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- playlists
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Playlist',
  description text,
  is_public boolean NOT NULL DEFAULT true,
  cover_image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read playlists" ON public.playlists FOR SELECT TO authenticated USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can create their own playlists" ON public.playlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own playlists" ON public.playlists FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own playlists" ON public.playlists FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_playlists_user_id ON public.playlists(user_id);
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- playlist_tracks
CREATE TABLE public.playlist_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_title text NOT NULL,
  track_artist text NOT NULL,
  track_album text,
  track_artwork text,
  track_duration integer DEFAULT 0,
  track_preview text,
  position integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_tracks TO authenticated;
GRANT ALL ON public.playlist_tracks TO service_role;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read accessible playlist tracks" ON public.playlist_tracks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_tracks.playlist_id AND (p.is_public = true OR p.user_id = auth.uid())));
CREATE POLICY "Owners can modify playlist tracks" ON public.playlist_tracks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_tracks.playlist_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_tracks.playlist_id AND p.user_id = auth.uid()));
CREATE INDEX idx_playlist_tracks_playlist_id ON public.playlist_tracks(playlist_id, position);

-- liked_songs
CREATE TABLE public.liked_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  track_title text NOT NULL,
  track_artist text NOT NULL,
  track_album text,
  track_artwork text,
  track_duration integer DEFAULT 0,
  youtube_id text,
  liked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, track_title, track_artist)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liked_songs TO authenticated;
GRANT ALL ON public.liked_songs TO service_role;
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own liked songs" ON public.liked_songs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_liked_songs_user ON public.liked_songs(user_id, liked_at DESC);

-- youtube_cache
CREATE TABLE public.youtube_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  video_title text,
  thumbnail text,
  channel_title text,
  duration integer,
  view_count text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.youtube_cache TO authenticated;
GRANT SELECT ON public.youtube_cache TO anon;
GRANT ALL ON public.youtube_cache TO service_role;
ALTER TABLE public.youtube_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read youtube cache" ON public.youtube_cache FOR SELECT USING (true);
CREATE POLICY "Signed-in users can add to youtube cache" ON public.youtube_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update youtube cache" ON public.youtube_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_youtube_cache_title_artist ON public.youtube_cache (title, artist);
CREATE INDEX idx_youtube_cache_video_id ON public.youtube_cache (video_id);
CREATE TRIGGER update_youtube_cache_updated_at BEFORE UPDATE ON public.youtube_cache FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- onboarding_preferences
CREATE TABLE public.onboarding_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  display_name text,
  genres text[] DEFAULT '{}',
  subgenres text[] DEFAULT '{}',
  artists text[] DEFAULT '{}',
  mood_presets text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_preferences TO anon, authenticated;
GRANT ALL ON public.onboarding_preferences TO service_role;
ALTER TABLE public.onboarding_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read onboarding prefs" ON public.onboarding_preferences FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert onboarding prefs" ON public.onboarding_preferences FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update onboarding prefs" ON public.onboarding_preferences FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_onboarding_prefs_updated_at BEFORE UPDATE ON public.onboarding_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
CREATE POLICY "own taste events" ON public.user_taste_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
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
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
CREATE POLICY "own follows" ON public.followed_artists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- generated_queues
CREATE TABLE public.generated_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed_track_id text,
  seed_title text,
  seed_artist text,
  tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_queues TO authenticated;
GRANT ALL ON public.generated_queues TO service_role;
ALTER TABLE public.generated_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own generated queues" ON public.generated_queues FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX generated_queues_user_created_idx ON public.generated_queues (user_id, created_at DESC);
CREATE TRIGGER update_generated_queues_updated_at BEFORE UPDATE ON public.generated_queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- discovered_playlists
CREATE TABLE public.discovered_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_track_id text NOT NULL,
  seed_title text NOT NULL,
  seed_artist text NOT NULL,
  playlist_id text NOT NULL,
  playlist_title text,
  playlist_image text,
  tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.discovered_playlists TO authenticated;
GRANT SELECT ON public.discovered_playlists TO anon;
GRANT ALL ON public.discovered_playlists TO service_role;
ALTER TABLE public.discovered_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read discovered playlists" ON public.discovered_playlists FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert discovered playlists" ON public.discovered_playlists FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_discovered_playlists_seed_track_id ON public.discovered_playlists(seed_track_id);
CREATE INDEX idx_discovered_playlists_playlist_id ON public.discovered_playlists(playlist_id);