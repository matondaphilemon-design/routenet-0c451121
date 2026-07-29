
CREATE TABLE public.onboarding_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  display_name text,
  genres text[] DEFAULT '{}',
  artists text[] DEFAULT '{}',
  mood_presets text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.onboarding_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert onboarding prefs"
  ON public.onboarding_preferences FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read own onboarding prefs"
  ON public.onboarding_preferences FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update own onboarding prefs"
  ON public.onboarding_preferences FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_onboarding_prefs_updated_at
  BEFORE UPDATE ON public.onboarding_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
