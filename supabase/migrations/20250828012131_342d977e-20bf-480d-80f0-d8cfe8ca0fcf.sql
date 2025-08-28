-- Create orders and order items for the dummy customer
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
    INSERT INTO public.orders (user_id, total_amount, status, shipping_address, created_at) 
    VALUES 
    ('c1111111-1111-1111-1111-111111111111'::uuid, 200.00, 'delivered', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW() - INTERVAL '7 days')
    RETURNING id INTO order1_id;

    INSERT INTO public.orders (user_id, total_amount, status, shipping_address, created_at) 
    VALUES 
    ('c1111111-1111-1111-1111-111111111111'::uuid, 145.00, 'shipped', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW() - INTERVAL '2 days')
    RETURNING id INTO order2_id;

    INSERT INTO public.orders (user_id, total_amount, status, shipping_address, created_at) 
    VALUES 
    ('c1111111-1111-1111-1111-111111111111'::uuid, 65.00, 'pending', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW())
    RETURNING id INTO order3_id;

    -- Insert order items
    INSERT INTO public.order_items (order_id, product_id, quantity, price, size, color) VALUES
    -- Order 1 items (delivered)
    (order1_id, product1_id, 1, 120.00, '9', 'Black'),
    (order1_id, product2_id, 1, 80.00, '9', 'White'),
    -- Order 2 items (shipped)
    (order2_id, product3_id, 1, 65.00, 'L', 'Black'),
    (order2_id, product4_id, 2, 35.00, 'M', 'Navy'),
    (order2_id, product5_id, 1, 45.00, 'One Size', 'Black'),
    -- Order 3 items (pending)
    (order3_id, product3_id, 1, 65.00, 'XL', 'Navy');

    -- Insert some cart items for the customer (current shopping session)
    INSERT INTO public.cart_items (user_id, product_id, quantity, size, color) VALUES
    ('c1111111-1111-1111-1111-111111111111'::uuid, product1_id, 1, '10', 'White'),
    ('c1111111-1111-1111-1111-111111111111'::uuid, product4_id, 2, 'L', 'Red');
END $$;