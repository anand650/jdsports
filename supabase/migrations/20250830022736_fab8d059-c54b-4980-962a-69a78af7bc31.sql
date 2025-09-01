-- Add order_number column to orders table for simple references
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Create a sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'JD' || nextval('order_number_seq');
END;
$$ LANGUAGE plpgsql;

-- Update existing orders with order numbers
UPDATE public.orders 
SET order_number = generate_order_number()
WHERE order_number IS NULL;

-- Create trigger to auto-generate order numbers for new orders
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number = generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Add unique constraint to phone_number in customer_profiles
ALTER TABLE public.customer_profiles 
ADD CONSTRAINT unique_customer_phone UNIQUE (phone_number);

-- Add index for faster order number lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- Enhance customer_profiles table for better voice assistant context
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';

-- Add product search optimization
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);

-- Add chat/voice interaction tracking
CREATE TABLE IF NOT EXISTS public.interaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('voice', 'chat', 'email')),
  topic TEXT,
  resolution_status TEXT DEFAULT 'pending',
  agent_id UUID,
  duration_seconds INTEGER,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on interaction_history
ALTER TABLE public.interaction_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for interaction_history
DROP POLICY IF EXISTS "Anyone can create interaction history" ON public.interaction_history;
CREATE POLICY "Anyone can create interaction history" ON public.interaction_history
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view interaction history" ON public.interaction_history;
CREATE POLICY "Anyone can view interaction history" ON public.interaction_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Agents can update interaction history" ON public.interaction_history;
CREATE POLICY "Agents can update interaction history" ON public.interaction_history
  FOR UPDATE USING (true);

-- Add indexes for interaction history
CREATE INDEX IF NOT EXISTS idx_interaction_history_phone ON public.interaction_history(customer_phone);
CREATE INDEX IF NOT EXISTS idx_interaction_history_type ON public.interaction_history(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interaction_history_created ON public.interaction_history(created_at);

-- Update knowledge_base for better voice assistant responses
ALTER TABLE public.knowledge_base 
ADD COLUMN IF NOT EXISTS voice_optimized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quick_response TEXT;