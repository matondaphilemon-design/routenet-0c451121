CREATE TABLE public.generated_queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed_track_id TEXT,
  seed_title TEXT,
  seed_artist TEXT,
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_queues TO authenticated;
GRANT ALL ON public.generated_queues TO service_role;

ALTER TABLE public.generated_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own generated queues"
  ON public.generated_queues
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX generated_queues_user_created_idx
  ON public.generated_queues (user_id, created_at DESC);

CREATE TRIGGER update_generated_queues_updated_at
  BEFORE UPDATE ON public.generated_queues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();