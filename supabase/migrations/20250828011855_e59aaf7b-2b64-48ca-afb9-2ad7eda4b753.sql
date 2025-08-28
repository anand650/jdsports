-- Insert sample products with proper UUIDs
INSERT INTO public.products (name, description, category, brand, price, stock_quantity, colors, sizes, images, is_active) VALUES
('Air Max 90', 'Classic Nike Air Max sneakers with visible air cushioning', 'shoes', 'Nike', 120.00, 50, '["White", "Black", "Red", "Blue"]', '["6", "7", "8", "9", "10", "11", "12"]', '["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500"]', true),
('Stan Smith', 'Iconic Adidas white leather tennis shoes', 'shoes', 'Adidas', 80.00, 30, '["White", "Green"]', '["6", "7", "8", "9", "10", "11", "12"]', '["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500"]', true),
('Classic Tracksuit', 'Comfortable cotton tracksuit for casual wear', 'clothing', 'JD Sports', 65.00, 25, '["Black", "Navy", "Gray"]', '["S", "M", "L", "XL", "XXL"]', '["https://images.unsplash.com/photo-1556821840-3a9416b45f75?w=500"]', true),
('Running Shorts', 'Lightweight shorts perfect for running and gym', 'clothing', 'Nike', 35.00, 40, '["Black", "Navy", "Red"]', '["S", "M", "L", "XL"]', '["https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500"]', true),
('Sports Backpack', 'Durable backpack with multiple compartments', 'accessories', 'Adidas', 45.00, 15, '["Black", "Blue", "Gray"]', '["One Size"]', '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500"]', true);

-- Get product IDs for reference
DO $$
DECLARE
    product1_id uuid;
    product2_id uuid;
    product3_id uuid;
    product4_id uuid;
    product5_id uuid;
    order1_id uuid;
    order2_id uuid;
    order3_id uuid;
BEGIN
    -- Get product IDs
    SELECT id INTO product1_id FROM public.products WHERE name = 'Air Max 90' LIMIT 1;
    SELECT id INTO product2_id FROM public.products WHERE name = 'Stan Smith' LIMIT 1;
    SELECT id INTO product3_id FROM public.products WHERE name = 'Classic Tracksuit' LIMIT 1;
    SELECT id INTO product4_id FROM public.products WHERE name = 'Running Shorts' LIMIT 1;
    SELECT id INTO product5_id FROM public.products WHERE name = 'Sports Backpack' LIMIT 1;

    -- Insert sample orders for the customer
    INSERT INTO public.orders (user_id, total_amount, status, shipping_address, created_at) VALUES
    ('c1111111-1111-1111-1111-111111111111'::uuid, 200.00, 'delivered', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW() - INTERVAL '7 days'),
    ('c1111111-1111-1111-1111-111111111111'::uuid, 145.00, 'shipped', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW() - INTERVAL '2 days'),
    ('c1111111-1111-1111-1111-111111111111'::uuid, 65.00, 'pending', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW());

    -- Get order IDs
    SELECT id INTO order1_id FROM public.orders WHERE status = 'delivered' AND user_id = 'c1111111-1111-1111-1111-111111111111'::uuid LIMIT 1;
    SELECT id INTO order2_id FROM public.orders WHERE status = 'shipped' AND user_id = 'c1111111-1111-1111-1111-111111111111'::uuid LIMIT 1;
    SELECT id INTO order3_id FROM public.orders WHERE status = 'pending' AND user_id = 'c1111111-1111-1111-1111-111111111111'::uuid LIMIT 1;

    -- Insert order items
    INSERT INTO public.order_items (order_id, product_id, quantity, price, size, color) VALUES
    -- Order 1 items
    (order1_id, product1_id, 1, 120.00, '9', 'Black'),
    (order1_id, product2_id, 1, 80.00, '9', 'White'),
    -- Order 2 items  
    (order2_id, product3_id, 1, 65.00, 'L', 'Black'),
    (order2_id, product4_id, 2, 35.00, 'M', 'Navy'),
    (order2_id, product5_id, 1, 45.00, 'One Size', 'Black'),
    -- Order 3 items
    (order3_id, product3_id, 1, 65.00, 'XL', 'Navy');

    -- Insert some cart items for the customer
    INSERT INTO public.cart_items (user_id, product_id, quantity, size, color) VALUES
    ('c1111111-1111-1111-1111-111111111111'::uuid, product1_id, 1, '10', 'White'),
    ('c1111111-1111-1111-1111-111111111111'::uuid, product4_id, 2, 'L', 'Red');
END $$;