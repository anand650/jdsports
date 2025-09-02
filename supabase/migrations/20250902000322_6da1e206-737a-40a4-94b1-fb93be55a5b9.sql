-- Update RLS policy for chat_messages to allow agents to send messages
-- This allows agents with proper roles to send messages even if not assigned to specific sessions
DROP POLICY IF EXISTS "Users can send messages in their sessions" ON public.chat_messages;

CREATE POLICY "Users can send messages in their sessions" ON public.chat_messages
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions cs 
    WHERE cs.id = chat_messages.session_id 
    AND (
      cs.user_id IS NULL 
      OR cs.user_id = auth.uid() 
      OR cs.assigned_agent_id = auth.uid()
    )
  )
  OR 
  -- Allow agents and admins to send messages to any session
  (
    sender_type = 'agent' 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('agent', 'admin')
    )
  )
);