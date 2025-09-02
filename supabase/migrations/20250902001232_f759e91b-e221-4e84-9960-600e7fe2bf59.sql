-- Fix the RLS policy for chat_sessions updates by checking user roles directly
DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned" ON public.chat_sessions;

CREATE POLICY "Users can update their sessions and agents can update assigned" ON public.chat_sessions
FOR UPDATE 
USING (
  -- Users can update their own sessions
  (user_id = auth.uid()) 
  OR 
  -- Agents can update sessions they're assigned to
  (assigned_agent_id = auth.uid()) 
  OR 
  -- Check if current user has agent or admin role directly from users table
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('agent', 'admin')
  )
);