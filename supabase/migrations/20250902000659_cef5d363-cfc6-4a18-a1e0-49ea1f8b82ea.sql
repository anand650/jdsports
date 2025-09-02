-- Update RLS policy for chat_sessions to properly handle agent role checks
-- First, let's check if the get_current_user_role function exists and create it if needed
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Drop and recreate the update policy for chat_sessions with better role handling
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
  -- Agents and admins can update any session
  (public.get_current_user_role() IN ('agent', 'admin'))
);