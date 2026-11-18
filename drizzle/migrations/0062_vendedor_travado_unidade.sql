CREATE OR REPLACE FUNCTION public.fn__exigir_acesso_unidade(_unidade_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.usuario_tem_acesso_unidade(_unidade_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta unidade.' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.fn__exigir_acesso_unidade(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn__exigir_acesso_unidade(uuid) TO authenticated;

-- Movimentos de saldo exigem acesso à unidade movimentada
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.fn_ajustar_saldo(uuid,text,integer,text)'::regprocedure);
  IF position('fn__exigir_acesso_unidade' in d) = 0 THEN
    EXECUTE replace(d, 'PERFORM public.fn_validar_operacao_unidade(u.id,', 'PERFORM public.fn__exigir_acesso_unidade(u.id); PERFORM public.fn_validar_operacao_unidade(u.id,');
  END IF;
  d := pg_get_functiondef('public.fn_baixar_venda(uuid,text,integer,boolean)'::regprocedure);
  IF position('fn__exigir_acesso_unidade' in d) = 0 THEN
    EXECUTE replace(d, 'PERFORM public.fn_validar_operacao_unidade(u.id, ''venda'');', 'PERFORM public.fn__exigir_acesso_unidade(u.id); PERFORM public.fn_validar_operacao_unidade(u.id, ''venda'');');
  END IF;
  d := pg_get_functiondef('public.fn_transferir(uuid,text,text,integer)'::regprocedure);
  IF position('fn__exigir_acesso_unidade' in d) = 0 THEN
    EXECUTE replace(d, 'IF uo.id = ud.id THEN', 'PERFORM public.fn__exigir_acesso_unidade(uo.id); IF uo.id = ud.id THEN');
  END IF;
END $do$;

-- Funções internas não podem ser chamadas pela API
REVOKE EXECUTE ON FUNCTION public.fn_transf_concluir_interna(uuid,text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_estoque_legado(uuid,uuid) FROM public, anon, authenticated;

-- Leitura restrita à unidade
ALTER POLICY "Authenticated users can read vendas" ON public.vendas USING (public.usuario_tem_acesso_unidade(unidade_id));
ALTER POLICY "Authenticated users can read venda_pagamentos" ON public.venda_pagamentos
  USING (EXISTS (SELECT 1 FROM public.vendas v WHERE v.grupo_venda = venda_pagamentos.grupo_venda AND public.usuario_tem_acesso_unidade(v.unidade_id)));
ALTER POLICY "Ver reposicoes" ON public.reposicoes USING (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id));
ALTER POLICY "Ver itens" ON public.reposicao_itens
  USING (EXISTS (SELECT 1 FROM public.reposicoes r WHERE r.id = reposicao_itens.reposicao_id AND (public.usuario_tem_acesso_unidade(r.unidade_origem_id) OR public.usuario_tem_acesso_unidade(r.unidade_destino_id))));

-- Escrita restrita à unidade
ALTER POLICY "Gerenciar itens" ON public.reposicao_itens
  USING ((has_permission(auth.uid(),'reposicao_criar') OR has_permission(auth.uid(),'reposicao_editar') OR has_permission(auth.uid(),'reposicao_separar') OR has_permission(auth.uid(),'reposicao_conferir'))
         AND EXISTS (SELECT 1 FROM public.reposicoes r WHERE r.id = reposicao_itens.reposicao_id AND (public.usuario_tem_acesso_unidade(r.unidade_origem_id) OR public.usuario_tem_acesso_unidade(r.unidade_destino_id))))
  WITH CHECK ((has_permission(auth.uid(),'reposicao_criar') OR has_permission(auth.uid(),'reposicao_editar') OR has_permission(auth.uid(),'reposicao_separar') OR has_permission(auth.uid(),'reposicao_conferir'))
         AND EXISTS (SELECT 1 FROM public.reposicoes r WHERE r.id = reposicao_itens.reposicao_id AND (public.usuario_tem_acesso_unidade(r.unidade_origem_id) OR public.usuario_tem_acesso_unidade(r.unidade_destino_id))));
ALTER POLICY "Atualizar reposicoes" ON public.reposicoes
  USING ((has_permission(auth.uid(),'reposicao_editar') OR has_permission(auth.uid(),'reposicao_separar') OR has_permission(auth.uid(),'reposicao_enviar') OR has_permission(auth.uid(),'reposicao_receber') OR has_permission(auth.uid(),'reposicao_conferir') OR has_permission(auth.uid(),'reposicao_finalizar'))
         AND (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id)));
ALTER POLICY "Criar reposicoes" ON public.reposicoes
  WITH CHECK (has_permission(auth.uid(),'reposicao_criar') AND (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id)));
ALTER POLICY "Excluir rascunho" ON public.reposicoes
  USING (status = 'rascunho' AND has_permission(auth.uid(),'reposicao_cancelar') AND (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id)));
ALTER POLICY "Authenticated can insert testers" ON public.testers WITH CHECK (public.usuario_tem_acesso_unidade(unidade_id) AND unidade_id IS NOT NULL OR public.has_role(auth.uid(),'master'));
ALTER POLICY "Authenticated can insert alertas_estoque" ON public.alertas_estoque WITH CHECK (public.usuario_tem_acesso_unidade(unidade_id));
ALTER POLICY "Authenticated can update alertas_estoque" ON public.alertas_estoque USING (public.usuario_tem_acesso_unidade(unidade_id));