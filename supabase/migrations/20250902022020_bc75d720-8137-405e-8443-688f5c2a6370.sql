-- Fix the stuck session that wasn't properly handed over
UPDATE public.chat_sessions
SET 
  status = 'active',
  assigned_agent_id = NULL,
  escalated_at = NULL,
  updated_at = now()
WHERE id = '6b55dbe0-a511-4048-b179-6a7f647497fb';

-- Also fix any other sessions that might be in the same state
UPDATE public.chat_sessions
SET 
  status = 'active',
  assigned_agent_id = NULL,
  escalated_at = NULL,
  updated_at = now()
WHERE assigned_agent_id IS NOT NULL 
  AND status = 'active' 
  AND updated_at < now() - interval '1 hour';