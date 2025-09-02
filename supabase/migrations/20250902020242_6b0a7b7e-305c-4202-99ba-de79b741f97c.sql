-- Fix RLS policy to work without get_current_user_role function
-- and handle the agent assignment clearing properly
DROP POLICY IF EXISTS "Allow chat session updates" ON public.chat_sessions;

CREATE POLICY "Allow chat session updates" ON public.chat_sessions
FOR UPDATE 
USING (
  -- Session owner can update
  (user_id = auth.uid()) 
  OR 
  -- Currently assigned agent can update
  (assigned_agent_id = auth.uid())
  OR 
  -- Any user with agent/admin role can update
  (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE role IN ('agent', 'admin')
  ))
)
WITH CHECK (
  -- After update: session owner still owns OR user has agent/admin role
  (user_id = auth.uid()) 
  OR 
  (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE role IN ('agent', 'admin')
  ))
);