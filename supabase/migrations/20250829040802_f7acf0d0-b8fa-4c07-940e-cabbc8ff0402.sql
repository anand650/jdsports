-- Manually escalate one session for testing
UPDATE chat_sessions 
SET status = 'escalated', escalated_at = now() 
WHERE id = 'cf1212e9-e5af-400d-9f12-5d0366a617c1';