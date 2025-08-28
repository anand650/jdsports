-- Enhance calls table for Twilio integration
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS twilio_call_sid text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS twilio_conference_sid text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_status text DEFAULT 'queued';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_direction text DEFAULT 'inbound';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_country text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_state text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_city text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_duration integer;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_url text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_duration integer;

-- Create customer profiles table for phone number lookup
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL UNIQUE,
  name text,
  email text,
  preferred_language text DEFAULT 'en',
  timezone text,
  call_history_count integer DEFAULT 0,
  last_interaction_at timestamp with time zone,
  customer_notes text,
  tags text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on customer_profiles
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for customer_profiles
CREATE POLICY "Agents can view all customer profiles" 
ON public.customer_profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Agents can create customer profiles" 
ON public.customer_profiles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Agents can update customer profiles" 
ON public.customer_profiles 
FOR UPDATE 
USING (true);

-- Create call recordings table
CREATE TABLE IF NOT EXISTS public.call_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL,
  twilio_recording_sid text UNIQUE,
  recording_url text NOT NULL,
  duration integer,
  file_size integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on call_recordings
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;

-- Create policies for call_recordings
CREATE POLICY "Anyone can view call recordings" 
ON public.call_recordings 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create call recordings" 
ON public.call_recordings 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON public.calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(call_status);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON public.customer_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_id ON public.call_recordings(call_id);

-- Add trigger for customer_profiles updated_at
CREATE TRIGGER update_customer_profiles_updated_at
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER TABLE public.customer_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.call_recordings REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;