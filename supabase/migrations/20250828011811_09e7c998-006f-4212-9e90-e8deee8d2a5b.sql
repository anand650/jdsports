-- Insert sample products
INSERT INTO public.products (id, name, description, category, brand, price, stock_quantity, colors, sizes, images, is_active) VALUES
('p1111111-1111-1111-1111-111111111111', 'Air Max 90', 'Classic Nike Air Max sneakers with visible air cushioning', 'shoes', 'Nike', 120.00, 50, '["White", "Black", "Red", "Blue"]', '["6", "7", "8", "9", "10", "11", "12"]', '["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500"]', true),
('p2222222-2222-2222-2222-222222222222', 'Stan Smith', 'Iconic Adidas white leather tennis shoes', 'shoes', 'Adidas', 80.00, 30, '["White", "Green"]', '["6", "7", "8", "9", "10", "11", "12"]', '["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500"]', true),
('p3333333-3333-3333-3333-333333333333', 'Classic Tracksuit', 'Comfortable cotton tracksuit for casual wear', 'clothing', 'JD Sports', 65.00, 25, '["Black", "Navy", "Gray"]', '["S", "M", "L", "XL", "XXL"]', '["https://images.unsplash.com/photo-1556821840-3a9416b45f75?w=500"]', true),
('p4444444-4444-4444-4444-444444444444', 'Running Shorts', 'Lightweight shorts perfect for running and gym', 'clothing', 'Nike', 35.00, 40, '["Black", "Navy", "Red"]', '["S", "M", "L", "XL"]', '["https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500"]', true),
('p5555555-5555-5555-5555-555555555555', 'Sports Backpack', 'Durable backpack with multiple compartments', 'accessories', 'Adidas', 45.00, 15, '["Black", "Blue", "Gray"]', '["One Size"]', '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500"]', true);

-- Insert sample orders for the customer
INSERT INTO public.orders (id, user_id, total_amount, status, shipping_address, created_at) VALUES
('o1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 200.00, 'delivered', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW() - INTERVAL '7 days'),
('o2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 145.00, 'shipped', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW() - INTERVAL '2 days'),
('o3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 65.00, 'pending', '{"street": "123 Main St", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}', NOW());

-- Insert order items for the orders
INSERT INTO public.order_items (id, order_id, product_id, quantity, price, size, color) VALUES
-- Order 1 items
('oi111111-1111-1111-1111-111111111111', 'o1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 1, 120.00, '9', 'Black'),
('oi111112-1111-1111-1111-111111111111', 'o1111111-1111-1111-1111-111111111111', 'p2222222-2222-2222-2222-222222222222', 1, 80.00, '9', 'White'),
-- Order 2 items  
('oi222221-1111-1111-1111-111111111111', 'o2222222-2222-2222-2222-222222222222', 'p3333333-3333-3333-3333-333333333333', 1, 65.00, 'L', 'Black'),
('oi222222-1111-1111-1111-111111111111', 'o2222222-2222-2222-2222-222222222222', 'p4444444-4444-4444-4444-444444444444', 2, 35.00, 'M', 'Navy'),
('oi222223-1111-1111-1111-111111111111', 'o2222222-2222-2222-2222-222222222222', 'p5555555-5555-5555-5555-555555555555', 1, 45.00, 'One Size', 'Black'),
-- Order 3 items
('oi333331-1111-1111-1111-111111111111', 'o3333333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333333', 1, 65.00, 'XL', 'Navy');

-- Insert some cart items for the customer (current shopping session)
INSERT INTO public.cart_items (id, user_id, product_id, quantity, size, color) VALUES
('ci111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 1, '10', 'White'),
('ci111112-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'p4444444-4444-4444-4444-444444444444', 2, 'L', 'Red');