-- Fix infinite recursion in RLS policy by using a security definer function
DROP POLICY "Users can view profiles with role-based access" ON public.users;

-- Create a security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create new policy using the function
CREATE POLICY "Users can view profiles with role-based access" 
ON public.users 
FOR SELECT 
USING (
  id = auth.uid() OR 
  public.get_current_user_role() IN ('agent', 'admin')
);