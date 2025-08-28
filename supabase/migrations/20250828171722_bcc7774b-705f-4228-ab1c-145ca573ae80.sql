-- Clean up orphaned calls that have been stuck in 'in-progress' status
-- Update calls that have been in-progress for more than 1 hour to 'completed'
UPDATE public.calls 
SET 
  call_status = 'completed',
  ended_at = NOW(),
  updated_at = NOW()
WHERE 
  call_status = 'in-progress' 
  AND started_at < NOW() - INTERVAL '1 hour';