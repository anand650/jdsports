-- Add order_number column to orders table for simple references
ALTER TABLE public.orders 
ADD COLUMN order_number TEXT;

-- Create a sequence for order numbers
CREATE SEQUENCE order_number_seq START 1;

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

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Add index for faster order number lookups
CREATE INDEX idx_orders_order_number ON public.orders(order_number);

-- Enhance customer_profiles table for better voice assistant context
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';

-- Create function to update customer stats
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
DECLARE
  customer_phone TEXT;
  order_count INTEGER;
  total_amount NUMERIC;
BEGIN
  -- Get customer phone from the order
  SELECT u.phone_number INTO customer_phone
  FROM users u
  WHERE u.id = NEW.user_id;
  
  IF customer_phone IS NOT NULL THEN
    -- Calculate stats
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
    INTO order_count, total_amount
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE u.phone_number = customer_phone;
    
    -- Update or insert customer profile
    INSERT INTO customer_profiles (phone_number, name, email, total_orders, total_spent, call_history_count)
    SELECT customer_phone, u.full_name, u.email, order_count, total_amount, 0
    FROM users u
    WHERE u.id = NEW.user_id
    ON CONFLICT (phone_number) DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      total_spent = EXCLUDED.total_spent,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update customer stats when orders are created
CREATE TRIGGER trigger_update_customer_stats
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

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
CREATE POLICY "Anyone can create interaction history" ON public.interaction_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view interaction history" ON public.interaction_history
  FOR SELECT USING (true);

CREATE POLICY "Agents can update interaction history" ON public.interaction_history
  FOR UPDATE USING (true);

-- Add indexes for interaction history
CREATE INDEX idx_interaction_history_phone ON public.interaction_history(customer_phone);
CREATE INDEX idx_interaction_history_type ON public.interaction_history(interaction_type);
CREATE INDEX idx_interaction_history_created ON public.interaction_history(created_at);

-- Update knowledge_base for better voice assistant responses
ALTER TABLE public.knowledge_base 
ADD COLUMN IF NOT EXISTS voice_optimized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quick_response TEXT;

-- Add common voice queries to knowledge base
INSERT INTO public.knowledge_base (title, content, category, voice_optimized, quick_response) VALUES
('Order Status Check', 'To check your order status, I need your order number (like JD123) or the email address used for the order. I can then provide you with the current status and tracking information.', 'orders', true, 'I can help you check your order status. What''s your order number or email?'),
('Return Policy', 'You can return items within 30 days of purchase. Items must be unworn with original tags. Free returns are available for online orders.', 'returns', true, 'We offer 30-day returns on unworn items with tags. Need help with a return?'),
('Shipping Information', 'Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days. Free shipping on orders over $75.', 'shipping', true, 'Standard shipping is 3-5 days, express is 1-2 days. Free shipping over $75.'),
('Size Guide', 'Our size guide is available on each product page. For specific fit questions, I can help you find the right size based on your measurements.', 'sizing', true, 'I can help you find the right size. What item are you looking at?')
ON CONFLICT (title) DO NOTHING;