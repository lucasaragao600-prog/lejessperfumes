CREATE OR REPLACE FUNCTION public.fn__acesso_unidade_estrito(_unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'master')
      OR (_unidade_id IS NOT NULL AND public.usuario_tem_acesso_unidade(_unidade_id))
$$;
REVOKE ALL ON FUNCTION public.fn__acesso_unidade_estrito(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn__acesso_unidade_estrito(uuid) TO authenticated;

-- Políticas com origem/destino: unidade vazia não libera mais acesso
DO $do$
DECLARE p record; s text;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname='public'
             AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%usuario_tem_acesso_unidade%'
             AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%origem%'
  LOOP
    s := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF p.qual IS NOT NULL THEN
      s := s || ' USING (' || replace(p.qual, 'usuario_tem_acesso_unidade(', 'public.fn__acesso_unidade_estrito(') || ')';
    END IF;
    IF p.with_check IS NOT NULL THEN
      s := s || ' WITH CHECK (' || replace(p.with_check, 'usuario_tem_acesso_unidade(', 'public.fn__acesso_unidade_estrito(') || ')';
    END IF;
    EXECUTE s;
  END LOOP;
END $do$;

ALTER POLICY "Authenticated users can read testers" ON public.testers USING (public.fn__acesso_unidade_estrito(unidade_id));
ALTER POLICY "testers_select" ON public.testers USING (public.fn__acesso_unidade_estrito(unidade_id));