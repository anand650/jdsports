-- Fix UPDATE policy to allow users to escalate their own sessions
DROP POLICY IF EXISTS "Agents can update assigned chat sessions" ON chat_sessions;

CREATE POLICY "Users can update their sessions and agents can update assigned sessions" 
ON chat_sessions 
FOR UPDATE 
USING (
  (user_id = auth.uid()) OR 
  (assigned_agent_id = auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'agent')
  ))
);