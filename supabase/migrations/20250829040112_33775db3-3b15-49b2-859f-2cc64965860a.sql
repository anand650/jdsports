-- Fix RLS policy to allow agents to see all escalated chats
DROP POLICY IF EXISTS "Users can view chat sessions" ON chat_sessions;

-- New policy that allows agents to see all escalated sessions
CREATE POLICY "Users can view chat sessions" 
ON chat_sessions 
FOR SELECT 
USING (
  (user_id IS NULL) OR 
  (user_id = auth.uid()) OR 
  (assigned_agent_id = auth.uid()) OR
  (status = 'escalated' AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('agent', 'admin')
  ))
);