-- Enable full row data for real-time updates
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;