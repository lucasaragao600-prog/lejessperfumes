-- View de compatibilidade passa a respeitar o RLS de quem consulta
ALTER VIEW public.perfumes_estoque_compat SET (security_invoker = true);

-- Nenhuma função interna pode ser chamada sem login
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Funções chamadas pelo app continuam liberadas para usuários autenticados
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_tem_unidade(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tem_acesso_unidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_audit(text, text, uuid, uuid, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ajustar_saldo(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_baixar_venda(uuid, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferir(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_unidade_por_texto(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validar_operacao_unidade(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_master_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_master(uuid) TO authenticated;
