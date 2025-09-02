-- Drop ALL existing UPDATE policies on chat_sessions to avoid conflicts
DROP POLICY IF EXISTS "Comprehensive chat session updates" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned " ON public.chat_sessions;
DROP POLICY IF EXISTS "Chat session updates" ON public.chat_sessions;

-- Create a single, clear UPDATE policy for chat_sessions
CREATE POLICY "Allow chat session updates" ON public.chat_sessions
FOR UPDATE 
USING (
  -- Session owner can update
  (user_id = auth.uid()) 
  OR 
  -- Currently assigned agent can update (including clearing assignment)
  (assigned_agent_id = auth.uid())
  OR 
  -- Any agent or admin can update any session
  (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('agent', 'admin')
  ))
);