
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can check if masters exist" ON public.user_roles;

-- Create a secure function that only returns boolean, not user IDs
CREATE OR REPLACE FUNCTION public.check_master_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'master'
  )
$$;
