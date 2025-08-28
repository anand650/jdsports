import { supabase } from '@/integrations/supabase/client';

export const createDemoUsers = async () => {
  const demoUsers = [
    {
      email: 'customer1@test.com',
      password: 'password123',
      fullName: 'John Customer',
      role: 'customer' as const
    },
    {
      email: 'agent1@test.com', 
      password: 'password123',
      fullName: 'Sarah Agent',
      role: 'agent' as const
    }
  ];

  for (const user of demoUsers) {
    const { error } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: user.fullName,
          role: user.role
        }
      }
    });

    if (error && !error.message.includes('already registered')) {
      console.error(`Error creating ${user.email}:`, error);
    } else {
      console.log(`Created/confirmed user: ${user.email}`);
    }
  }
};