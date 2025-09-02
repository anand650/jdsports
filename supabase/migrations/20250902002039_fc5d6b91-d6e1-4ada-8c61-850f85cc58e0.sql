-- Clean up all UPDATE policies and create a single working one
DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned" ON public.chat_sessions;
DROP POLICY IF EXISTS "Temp allow authenticated users to update sessions" ON public.chat_sessions;

-- Create a single, clean UPDATE policy
CREATE POLICY "Allow session updates" ON public.chat_sessions
FOR UPDATE 
TO authenticated
USING (
  -- Users can update their own sessions
  (user_id = auth.uid()) 
  OR 
  -- Agents can update sessions they're assigned to
  (assigned_agent_id = auth.uid()) 
  OR 
  -- Allow agents and admins to update any session
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('agent', 'admin')
  )
);