
-- Function to assign master role to first user (only works if no masters exist)
CREATE OR REPLACE FUNCTION public.claim_first_master(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if no master exists yet
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master') THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'master')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN TRUE;
END;
$$;
