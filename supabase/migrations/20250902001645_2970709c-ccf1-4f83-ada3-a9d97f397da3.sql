-- Temporarily make the policy more permissive to test the core functionality
-- This will help us isolate if the issue is authentication or RLS logic

DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned" ON public.chat_sessions;

-- Temporarily allow all authenticated users to update sessions for testing
CREATE POLICY "Temp allow authenticated users to update sessions" ON public.chat_sessions
FOR UPDATE 
TO authenticated
USING (true);