-- Fix the RLS policy with correct syntax
DROP POLICY IF EXISTS "Allow session updates" ON public.chat_sessions;

-- Create a working policy that checks role directly from users table
CREATE POLICY "Chat session updates" ON public.chat_sessions
FOR UPDATE 
TO authenticated
USING (
  -- Users can update their own sessions
  (user_id = auth.uid()) 
  OR 
  -- Original assigned agent can always update
  (assigned_agent_id = auth.uid()) 
  OR 
  -- Direct role check from users table for agents/admins
  (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE role IN ('agent', 'admin')
  ))
);