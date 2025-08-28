-- Add analytics columns to calls table for performance tracking
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('resolved', 'unresolved', 'escalated', 'pending')),
ADD COLUMN IF NOT EXISTS first_response_time INTEGER, -- Time to first agent response in seconds  
ADD COLUMN IF NOT EXISTS resolution_time INTEGER; -- Total time to resolution in seconds

-- Add phone number to users table for customer linking
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for fast phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users (phone_number);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_number ON public.customer_profiles (phone_number);

-- Enable realtime for analytics dashboard (skip calls as it's already added)
ALTER TABLE public.customer_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- Add tables to realtime publication (skip calls as it's already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'customer_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_profiles;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
END $$;