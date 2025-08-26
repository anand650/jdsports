-- Fix RLS policy to allow anonymous chat sessions
DROP POLICY IF EXISTS "Users can create their own chat sessions" ON public.chat_sessions;

CREATE POLICY "Users can create chat sessions" 
ON public.chat_sessions 
FOR INSERT 
WITH CHECK (
  (user_id IS NULL) OR (user_id = auth.uid())
);

-- Update RLS policy for viewing chat sessions to include anonymous sessions
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON public.chat_sessions;

CREATE POLICY "Users can view chat sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (
  (user_id IS NULL) OR (user_id = auth.uid()) OR (assigned_agent_id = auth.uid())
);

-- Update RLS policy for chat messages to include anonymous sessions
DROP POLICY IF EXISTS "Users can view messages in their sessions" ON public.chat_messages;

CREATE POLICY "Users can view messages in their sessions" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions cs 
    WHERE cs.id = chat_messages.session_id 
    AND (
      (cs.user_id IS NULL) OR 
      (cs.user_id = auth.uid()) OR 
      (cs.assigned_agent_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Users can send messages in their sessions" ON public.chat_messages;

CREATE POLICY "Users can send messages in their sessions" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions cs 
    WHERE cs.id = chat_messages.session_id 
    AND (
      (cs.user_id IS NULL) OR 
      (cs.user_id = auth.uid()) OR 
      (cs.assigned_agent_id = auth.uid())
    )
  )
);

-- Insert dummy JD Sports products
INSERT INTO public.products (name, description, price, category, brand, sizes, colors, images, stock_quantity) VALUES
('Air Jordan 1 Retro High OG', 'Classic basketball sneaker with premium leather upper and iconic design', 149.99, 'Footwear', 'Nike', ARRAY['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'], ARRAY['Black/Red', 'White/Black'], ARRAY['https://images.unsplash.com/photo-1556906781-9a412961c28c?w=500'], 25),

('Adidas Ultraboost 22', 'Energy-returning running shoes with Boost midsole technology', 169.99, 'Footwear', 'Adidas', ARRAY['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'], ARRAY['Black', 'White', 'Blue'], ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'], 30),

('Nike Tech Fleece Hoodie', 'Premium lightweight hoodie with innovative thermal construction', 89.99, 'Clothing', 'Nike', ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'], ARRAY['Black', 'Grey', 'Navy'], ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500'], 40),

('Adidas Originals Trefoil Tee', 'Classic cotton t-shirt with iconic Trefoil logo', 24.99, 'Clothing', 'Adidas', ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'], ARRAY['Black', 'White', 'Red'], ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'], 50),

('Puma RS-X Sneakers', 'Retro-inspired running sneakers with bold colorways', 89.99, 'Footwear', 'Puma', ARRAY['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'], ARRAY['White/Blue', 'Black/Yellow'], ARRAY['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500'], 20),

('Under Armour HeatGear Shorts', 'Moisture-wicking athletic shorts for training', 34.99, 'Clothing', 'Under Armour', ARRAY['XS', 'S', 'M', 'L', 'XL'], ARRAY['Black', 'Grey', 'Navy'], ARRAY['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500'], 35),

('Converse Chuck Taylor All Star', 'Iconic canvas sneakers with timeless design', 54.99, 'Footwear', 'Converse', ARRAY['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'], ARRAY['Black', 'White', 'Red'], ARRAY['https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=500'], 45),

('Champion Reverse Weave Sweatshirt', 'Premium heavyweight sweatshirt with reverse weave construction', 64.99, 'Clothing', 'Champion', ARRAY['S', 'M', 'L', 'XL', 'XXL'], ARRAY['Grey', 'Navy', 'Burgundy'], ARRAY['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500'], 28);