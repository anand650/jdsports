-- Enable realtime for calls table to show new calls in UI immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Also ensure replica identity is set for complete row data in realtime updates
ALTER TABLE public.calls REPLICA IDENTITY FULL;