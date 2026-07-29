-- Create youtube_cache table for storing video links
CREATE TABLE public.youtube_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  video_title TEXT NOT NULL,
  thumbnail TEXT,
  channel_title TEXT,
  duration INTEGER,
  view_count TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_youtube_cache_title_artist ON public.youtube_cache (title, artist);
CREATE INDEX idx_youtube_cache_video_id ON public.youtube_cache (video_id);

-- Enable RLS (public read, service role write)
ALTER TABLE public.youtube_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached videos
CREATE POLICY "Anyone can read youtube cache" 
ON public.youtube_cache 
FOR SELECT 
USING (true);

-- Only service role can insert/update (edge function uses service role)
CREATE POLICY "Service role can insert youtube cache" 
ON public.youtube_cache 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update youtube cache" 
ON public.youtube_cache 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_youtube_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_youtube_cache_updated_at
BEFORE UPDATE ON public.youtube_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_youtube_cache_updated_at();