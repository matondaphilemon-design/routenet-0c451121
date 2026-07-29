DROP POLICY IF EXISTS "Anyone can insert discovered playlists" ON public.discovered_playlists;

CREATE POLICY "Authenticated users can insert discovered playlists" ON public.discovered_playlists FOR INSERT TO authenticated WITH CHECK (true);

REVOKE INSERT ON public.discovered_playlists FROM anon;