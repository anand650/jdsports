-- Fix the RLS policy to handle agent role checking more reliably
DROP POLICY IF EXISTS "Allow session updates" ON public.chat_sessions;

-- Create a simpler, more reliable policy
CREATE POLICY "Chat session updates" ON public.chat_sessions
FOR UPDATE 
TO authenticated
USING (
  -- Users can update their own sessions
  (user_id = auth.uid()) 
  OR 
  -- Original assigned agent can always update (before removing assignment)
  (assigned_agent_id = auth.uid()) 
  OR 
  -- Anyone with agent or admin role can update any session
  (
    auth.jwt() ->> 'user_metadata' ->> 'role' IN ('agent', 'admin')
    OR 
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('agent', 'admin')
    )
  )
);