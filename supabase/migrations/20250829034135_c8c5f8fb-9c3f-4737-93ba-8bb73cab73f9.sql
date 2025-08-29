-- Fix RLS policy for agents to see escalated chats
DROP POLICY IF EXISTS "Users can view chat sessions" ON public.chat_sessions;

-- Create improved policy that allows agents to see escalated chats
CREATE POLICY "Users and agents can view chat sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (
  -- Users can see their own sessions
  (user_id IS NULL) OR (user_id = auth.uid()) OR 
  -- Assigned agents can see their sessions
  (assigned_agent_id = auth.uid()) OR
  -- Any agent can see escalated sessions
  (
    status = 'escalated' AND 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'agent'
    )
  )
);

-- Enable real-time for chat_sessions table
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.chat_sessions;

-- Enable real-time for chat_messages table  
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.chat_messages;