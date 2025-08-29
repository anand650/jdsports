-- Enable real-time for chat_messages table (only, since chat_sessions already has it)
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
-- chat_messages might already be in realtime too, so use IF NOT EXISTS equivalent
ALTER publication supabase_realtime ADD TABLE public.chat_messages;