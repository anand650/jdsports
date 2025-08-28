-- Enable realtime for call center tables
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;  
ALTER TABLE public.suggestions REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;