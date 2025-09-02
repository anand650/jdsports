-- Create a special policy that allows agents to clear their own assignments
DROP POLICY IF EXISTS "Allow chat session updates" ON public.chat_sessions;

-- Create separate policies for different scenarios to avoid conflicts
CREATE POLICY "Users can update their own sessions" ON public.chat_sessions
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can update any session" ON public.chat_sessions
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM public.users 
    WHERE role IN ('agent', 'admin')
  )
)
WITH CHECK (
  -- Allow any update if user is an agent/admin
  auth.uid() IN (
    SELECT id FROM public.users 
    WHERE role IN ('agent', 'admin')
  )
);