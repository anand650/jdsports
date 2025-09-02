-- Fix the UPDATE policy by adding WITH CHECK expression that allows clearing assignment
DROP POLICY IF EXISTS "Allow chat session updates" ON public.chat_sessions;

CREATE POLICY "Allow chat session updates" ON public.chat_sessions
FOR UPDATE 
USING (
  -- Can update if: owner, currently assigned agent, or any agent/admin
  (user_id = auth.uid()) 
  OR 
  (assigned_agent_id = auth.uid())
  OR 
  (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('agent', 'admin')
  ))
)
WITH CHECK (
  -- After update: owner still owns, or agent/admin performed the update
  (user_id = auth.uid()) 
  OR 
  (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('agent', 'admin')
  ))
);