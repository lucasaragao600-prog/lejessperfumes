-- Fase 5: reembolso com confirmação de pagamento (aditiva)

ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS reembolso_status text NOT NULL DEFAULT 'confirmado';
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS reembolso_confirmado_por text;
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS reembolso_confirmado_em timestamptz;
ALTER TABLE public.devolucoes ADD CONSTRAINT devolucoes_reembolso_status_check CHECK (reembolso_status IN ('pendente','confirmado'));

-- Pix e estorno em cartão passam a nascer pendentes: o dinheiro sai fora do sistema e precisa de confirmação.
-- Dinheiro (sangria no caixa) e crédito/vale-troca (crédito do cliente) já são atômicos: nascem confirmados.
CREATE OR REPLACE FUNCTION public.fn__devolucao_reembolso(p_dev uuid, p_valor numeric, p_forma text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.devolucoes;
BEGIN
  IF p_valor <= 0 THEN RETURN; END IF;
  SELECT * INTO d FROM public.devolucoes WHERE id = p_dev;
  IF p_forma = 'dinheiro' THEN
    IF d.sessao_caixa_id IS NULL THEN RAISE EXCEPTION 'Abra o caixa da unidade para devolver em dinheiro'; END IF;
    INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
    VALUES (d.sessao_caixa_id, 'sangria', p_valor, 'Devolução ' || d.numero, d.registrado_por_nome);
  ELSIF p_forma IN ('credito_loja','vale_troca') THEN
    PERFORM public.fn__credito_entrada(d.cliente_id, d.unidade_id, p_valor, d.id,
      CASE WHEN p_forma='vale_troca' THEN 'Vale-troca ' ELSE 'Crédito ' END || d.numero);
  ELSIF p_forma IN ('pix','estorno_cartao') THEN
    UPDATE public.devolucoes SET reembolso_status = 'pendente' WHERE id = p_dev;
  ELSE
    RAISE EXCEPTION 'Forma de reembolso inválida';
  END IF;
END $$;

-- Confirmação do reembolso: master ou permissão devolucao.reembolso na unidade da devolução.
CREATE OR REPLACE FUNCTION public.fn_devolucao_reembolso_confirmar(p_devolucao_id uuid, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.devolucoes; v_nome text := public.fn__nome_usuario();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO d FROM public.devolucoes WHERE id = p_devolucao_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Devolução não encontrada'; END IF;
  IF NOT public.fn__pode(d.unidade_id, 'devolucao.reembolso') THEN
    RAISE EXCEPTION 'Sem permissão para confirmar reembolso nesta unidade'; END IF;
  IF d.reembolso_status <> 'pendente' THEN
    RAISE EXCEPTION 'Este reembolso não está pendente'; END IF;
  UPDATE public.devolucoes
  SET reembolso_status = 'confirmado', reembolso_confirmado_por = v_nome, reembolso_confirmado_em = now(), updated_at = now()
  WHERE id = d.id;
  PERFORM public.fn_audit('devolucao.reembolso_confirmado', 'devolucoes', d.id, d.unidade_id,
    jsonb_build_object('numero', d.numero, 'forma', d.forma_reembolso, 'valor', d.valor_total),
    jsonb_build_object('confirmado_por', v_nome, 'observacao', p_observacao));
  RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'valor', d.valor_total);
END $$;

INSERT INTO public.permissoes_catalogo (chave, descricao, modulo)
VALUES ('devolucao.reembolso', 'Confirmar reembolso de devolução', 'devolucao')
ON CONFLICT DO NOTHING;