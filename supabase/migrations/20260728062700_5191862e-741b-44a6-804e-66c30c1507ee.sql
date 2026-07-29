DROP POLICY IF EXISTS "Authenticated users can insert discovered playlists" ON public.discovered_playlists;
DROP POLICY IF EXISTS "Anyone can insert discovered playlists" ON public.discovered_playlists;

CREATE POLICY "Authenticated users can insert discovered playlists" ON public.discovered_playlists FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

REVOKE INSERT ON public.discovered_playlists FROM anon;