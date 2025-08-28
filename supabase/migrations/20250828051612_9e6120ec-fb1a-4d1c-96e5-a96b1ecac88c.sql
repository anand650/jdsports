-- Add unique constraint for twilio_call_sid to support upsert operations
ALTER TABLE public.calls ADD CONSTRAINT calls_twilio_call_sid_unique UNIQUE (twilio_call_sid);

-- Insert a test agent so calls can be assigned
INSERT INTO public.agents (name, email) VALUES ('Test Agent', 'agent@test.com');

-- Update existing calls to set proper status for ringing calls
UPDATE public.calls 
SET call_status = 'ringing', call_direction = 'inbound'
WHERE call_status = 'queued' AND ended_at IS NULL;