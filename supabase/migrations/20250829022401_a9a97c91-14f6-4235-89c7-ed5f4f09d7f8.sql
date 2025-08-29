-- Enable real-time for transcripts table
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;

-- Add transcripts table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;