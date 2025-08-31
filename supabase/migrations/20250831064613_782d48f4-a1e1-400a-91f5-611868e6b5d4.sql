-- Update RLS policy to allow agents to view all orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;

CREATE POLICY "Users can view orders with role-based access" 
ON orders 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  get_current_user_role() = ANY(ARRAY['agent'::text, 'admin'::text])
);