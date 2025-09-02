-- Fix RLS policy for chat_sessions to allow agents to clear their own assignments
DROP POLICY IF EXISTS "Chat session updates" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned" ON public.chat_sessions;

-- Create a comprehensive update policy that handles agent assignment clearing
CREATE POLICY "Comprehensive chat session updates" ON public.chat_sessions
FOR UPDATE 
USING (
  -- User can update their own sessions
  user_id = auth.uid() 
  OR 
  -- Currently assigned agent can update (including clearing assignment)
  assigned_agent_id = auth.uid()
  OR 
  -- Agents and admins can update any session
  (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE role IN ('agent', 'admin')
  ))
);