-- Create a test agent user for the current user
INSERT INTO users (id, email, full_name, role) 
VALUES (
  '1ec26bf4-3094-462c-ae04-9d3859bdb4bc',
  'zenviolentures@gmail.com',
  'Anand',
  'agent'
) ON CONFLICT (id) DO UPDATE SET role = 'agent';