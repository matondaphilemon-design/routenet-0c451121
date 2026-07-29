DROP TABLE IF EXISTS public.onboarding_preferences;

DROP POLICY IF EXISTS "Signed-in users can add to youtube cache" ON public.youtube_cache;
DROP POLICY IF EXISTS "Signed-in users can update youtube cache" ON public.youtube_cache;
REVOKE INSERT, UPDATE ON public.youtube_cache FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;