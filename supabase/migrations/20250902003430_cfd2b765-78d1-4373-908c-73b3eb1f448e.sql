-- Remove the old conflicting UPDATE policy
DROP POLICY IF EXISTS "Users can update their sessions and agents can update assigned" ON public.chat_sessions;