CREATE OR REPLACE FUNCTION public.fn__nome_usuario(p_user uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT nome FROM public.profiles WHERE user_id = p_user LIMIT 1), ''); $$;
REVOKE ALL ON FUNCTION public.fn__nome_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn__nome_usuario(uuid) TO authenticated, service_role;