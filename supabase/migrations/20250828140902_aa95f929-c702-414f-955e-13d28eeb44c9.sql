-- Add analytics columns to calls table for performance tracking
ALTER TABLE public.calls 
ADD COLUMN satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
ADD COLUMN resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('resolved', 'unresolved', 'escalated', 'pending')),
ADD COLUMN first_response_time INTEGER, -- Time to first agent response in seconds
ADD COLUMN resolution_time INTEGER; -- Total time to resolution in seconds

-- Add phone number to users table for customer linking
ALTER TABLE public.users 
ADD COLUMN phone_number TEXT;

-- Create index for fast phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users (phone_number);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_number ON public.customer_profiles (phone_number);

-- Enable realtime for analytics dashboard
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.customer_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;