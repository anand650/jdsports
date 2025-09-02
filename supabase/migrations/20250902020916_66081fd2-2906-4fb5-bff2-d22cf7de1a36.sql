-- Create a service role function to handle session handover
CREATE OR REPLACE FUNCTION public.handover_session_to_ai(
  session_id_param uuid,
  agent_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify that the agent exists and has proper role
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = agent_id_param 
    AND role IN ('agent', 'admin')
  ) THEN
    RAISE EXCEPTION 'User is not authorized to perform this action';
  END IF;

  -- Verify that the session exists and is assigned to this agent
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_sessions 
    WHERE id = session_id_param 
    AND assigned_agent_id = agent_id_param
  ) THEN
    RAISE EXCEPTION 'Session not found or not assigned to this agent';
  END IF;

  -- Update the session to hand it back to AI
  UPDATE public.chat_sessions
  SET 
    status = 'active',
    assigned_agent_id = NULL,
    escalated_at = NULL,
    updated_at = now()
  WHERE id = session_id_param;

  RETURN true;
END;
$$;