-- Insert dummy users for testing
-- Customer users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  role
) VALUES 
(
  'customer-1-uuid-dummy-test-user-001',
  'customer1@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "John Customer", "role": "customer"}',
  'authenticated'
),
(
  'customer-2-uuid-dummy-test-user-002', 
  'customer2@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Jane Smith", "role": "customer"}',
  'authenticated'
);

-- Agent users  
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  role
) VALUES
(
  'agent-1-uuid-dummy-test-user-001',
  'agent1@test.com', 
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Sarah Agent", "role": "agent"}',
  'authenticated'
),
(
  'agent-2-uuid-dummy-test-user-002',
  'agent2@test.com',
  crypt('password123', gen_salt('bf')), 
  now(),
  now(),
  now(),
  '{"full_name": "Mike Support", "role": "agent"}',
  'authenticated'
);

-- Insert corresponding records in public.users table
INSERT INTO public.users (id, email, full_name, role, created_at, updated_at) VALUES
('customer-1-uuid-dummy-test-user-001', 'customer1@test.com', 'John Customer', 'customer', now(), now()),
('customer-2-uuid-dummy-test-user-002', 'customer2@test.com', 'Jane Smith', 'customer', now(), now()),
('agent-1-uuid-dummy-test-user-001', 'agent1@test.com', 'Sarah Agent', 'agent', now(), now()),
('agent-2-uuid-dummy-test-user-002', 'agent2@test.com', 'Mike Support', 'agent', now(), now());