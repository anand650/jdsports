-- Ensure chat_messages and chat_sessions tables have proper real-time configuration
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;

-- Add the tables to the realtime publication if not already added
DO $$
BEGIN
    -- Add chat_messages to realtime publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
    
    -- Add chat_sessions to realtime publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
    END IF;
END $$;