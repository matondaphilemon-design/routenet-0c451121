ALTER TABLE public.liked_songs ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Users can manage liked songs" ON public.liked_songs;

CREATE POLICY "Users can read their own liked songs"
ON public.liked_songs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own liked songs"
ON public.liked_songs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own liked songs"
ON public.liked_songs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own liked songs"
ON public.liked_songs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
