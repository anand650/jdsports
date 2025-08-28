-- Insert dummy users in public.users table only (let auth.users be managed by Supabase auth)
INSERT INTO public.users (id, email, full_name, role, created_at, updated_at) VALUES
(gen_random_uuid(), 'customer1@test.com', 'John Customer', 'customer', now(), now()),
(gen_random_uuid(), 'customer2@test.com', 'Jane Smith', 'customer', now(), now()),
(gen_random_uuid(), 'agent1@test.com', 'Sarah Agent', 'agent', now(), now()),
(gen_random_uuid(), 'agent2@test.com', 'Mike Support', 'agent', now(), now());