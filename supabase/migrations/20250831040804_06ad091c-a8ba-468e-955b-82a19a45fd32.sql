-- Update RLS policy for users table to allow agents to view customer profiles
DROP POLICY "Users can view their own profile" ON public.users;

CREATE POLICY "Users can view profiles with role-based access" 
ON public.users 
FOR SELECT 
USING (
  id = auth.uid() OR 
  (EXISTS (
    SELECT 1 FROM public.users agent_user 
    WHERE agent_user.id = auth.uid() 
    AND agent_user.role IN ('agent', 'admin')
  ))
);