-- Enable realtime for missing tables
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;  
ALTER TABLE public.suggestions REPLICA IDENTITY FULL;

-- Add missing tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;