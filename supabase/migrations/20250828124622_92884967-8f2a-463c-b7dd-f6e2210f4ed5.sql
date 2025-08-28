-- Enable realtime for transcripts and suggestions tables
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;
ALTER TABLE public.suggestions REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER publication supabase_realtime ADD TABLE public.transcripts;
ALTER publication supabase_realtime ADD TABLE public.suggestions;
ALTER publication supabase_realtime ADD TABLE public.calls;