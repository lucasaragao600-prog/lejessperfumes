-- FASE 6 — ETAPA 5: ESTOQUE INICIAL (aditivo e idempotente)

INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
  ('estoque.carga_manual', 'estoque', 'Solicitar carga manual de estoque inicial'),
  ('estoque.aprovar_carga_manual', 'estoque', 'Aprovar carga manual de estoque inicial')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.implantacao_estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id UUID NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  produto_id UUID NOT NULL REFERENCES public.perfumes(id),
  produto_nome TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
  origem_unidade_id UUID REFERENCES public.unidades(id),
  fornecedor TEXT NOT NULL DEFAULT '',
  nota_numero TEXT NOT NULL DEFAULT '',
  nota_data DATE,
  lote TEXT NOT NULL DEFAULT '',
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  quantidade_solicitada INTEGER NOT NULL DEFAULT 0,
  quantidade_recebida INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PLANEJADO',
  transferencia_id UUID REFERENCES public.transferencias(id),
  motivo TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  solicitado_por UUID,
  solicitado_por_nome TEXT NOT NULL DEFAULT '',
  aprovado_por UUID,
  aprovado_por_nome TEXT NOT NULL DEFAULT '',
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impl_estoque_impl ON public.implantacao_estoque_itens(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_impl_estoque_transf ON public.implantacao_estoque_itens(transferencia_id);

GRANT SELECT, INSERT, UPDATE ON public.implantacao_estoque_itens TO authenticated;
GRANT ALL ON public.implantacao_estoque_itens TO service_role;
ALTER TABLE public.implantacao_estoque_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impl_estoque_select" ON public.implantacao_estoque_itens;
CREATE POLICY "impl_estoque_select" ON public.implantacao_estoque_itens FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id) OR public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "impl_estoque_insert" ON public.implantacao_estoque_itens;
CREATE POLICY "impl_estoque_insert" ON public.implantacao_estoque_itens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.usuario_tem_permissao(unidade_id, 'estoque.movimentar'));

DROP POLICY IF EXISTS "impl_estoque_update" ON public.implantacao_estoque_itens;
CREATE POLICY "impl_estoque_update" ON public.implantacao_estoque_itens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.usuario_tem_permissao(unidade_id, 'estoque.movimentar'));

DROP TRIGGER IF EXISTS update_impl_estoque_updated_at ON public.implantacao_estoque_itens;
CREATE TRIGGER update_impl_estoque_updated_at BEFORE UPDATE ON public.implantacao_estoque_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gera uma transferência (Fase 4) por unidade de origem, vinculada à implantação
CREATE OR REPLACE FUNCTION public.fn_implantacao_gerar_transferencias(p_implantacao_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unidade uuid; o record; v_itens jsonb; v_transf uuid; v_qtd integer := 0;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.implantacoes WHERE id = p_implantacao_id;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;

  FOR o IN
    SELECT origem_unidade_id
      FROM public.implantacao_estoque_itens
     WHERE implantacao_id = p_implantacao_id
       AND tipo = 'TRANSFERENCIA'
       AND status = 'PLANEJADO'
       AND origem_unidade_id IS NOT NULL
     GROUP BY origem_unidade_id
  LOOP
    SELECT jsonb_agg(jsonb_build_object('produto_id', produto_id, 'produto_nome', produto_nome,
                                        'quantidade', quantidade_solicitada))
      INTO v_itens
      FROM public.implantacao_estoque_itens
     WHERE implantacao_id = p_implantacao_id
       AND tipo = 'TRANSFERENCIA'
       AND status = 'PLANEJADO'
       AND origem_unidade_id = o.origem_unidade_id
       AND quantidade_solicitada > 0;

    IF v_itens IS NULL THEN CONTINUE; END IF;

    v_transf := public.fn_transferencia_criar(o.origem_unidade_id, v_unidade, v_itens,
                  'Carga inicial da unidade', p_implantacao_id);
    PERFORM public.fn_transferencia_confirmar(v_transf);

    UPDATE public.implantacao_estoque_itens
       SET transferencia_id = v_transf, status = 'EM_TRANSFERENCIA'
     WHERE implantacao_id = p_implantacao_id
       AND tipo = 'TRANSFERENCIA'
       AND status = 'PLANEJADO'
       AND origem_unidade_id = o.origem_unidade_id;

    v_qtd := v_qtd + 1;
  END LOOP;

  PERFORM public.fn_audit('ESTOQUE_INICIAL_CRIADO', 'implantacao_estoque_itens', p_implantacao_id, v_unidade,
    NULL, jsonb_build_object('transferencias_geradas', v_qtd));
  RETURN v_qtd;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_gerar_transferencias(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_gerar_transferencias(uuid) TO authenticated;

-- Entrada de fornecedor: soma no estoque da unidade e registra movimentação
CREATE OR REPLACE FUNCTION public.fn_implantacao_entrada_fornecedor(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE it public.implantacao_estoque_itens; v_nome text; v_legado text;
BEGIN
  SELECT * INTO it FROM public.implantacao_estoque_itens WHERE id = p_item_id FOR UPDATE;
  IF it.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF it.tipo <> 'FORNECEDOR' THEN RAISE EXCEPTION 'Item não é entrada de fornecedor'; END IF;
  IF it.status = 'CONCLUIDO' THEN RAISE EXCEPTION 'Entrada já registrada'; END IF;
  IF NOT (public.has_role(auth.uid(), 'master') OR public.usuario_tem_permissao(it.unidade_id, 'estoque.movimentar')) THEN
    RAISE EXCEPTION 'Sem permissão para dar entrada nesta unidade.';
  END IF;
  IF it.quantidade_solicitada <= 0 THEN RAISE EXCEPTION 'Informe a quantidade.'; END IF;

  PERFORM public.fn_ajustar_saldo(it.produto_id, it.unidade_id::text, it.quantidade_solicitada, 'delta');

  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  SELECT codigo_legado INTO v_legado FROM public.unidades WHERE id = it.unidade_id;

  INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, deposito_destino,
    quantidade, observacao, registrado_por, unidade_id, unidade_destino_id, implantacao_id)
  VALUES ((now() AT TIME ZONE 'America/Manaus')::date, 'ENTRADA', it.produto_id, it.produto_nome,
          v_legado, v_legado, it.quantidade_solicitada,
          'Carga inicial - fornecedor ' || it.fornecedor || CASE WHEN it.nota_numero <> '' THEN ' NF ' || it.nota_numero ELSE '' END,
          COALESCE(v_nome,''), it.unidade_id, it.unidade_id, it.implantacao_id);

  UPDATE public.implantacao_estoque_itens
     SET status = 'CONCLUIDO', quantidade_recebida = it.quantidade_solicitada
   WHERE id = p_item_id;

  PERFORM public.fn_audit('ESTOQUE_INICIAL_CRIADO', 'implantacao_estoque_itens', p_item_id, it.unidade_id,
    NULL, jsonb_build_object('tipo','FORNECEDOR','quantidade', it.quantidade_solicitada));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_entrada_fornecedor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_entrada_fornecedor(uuid) TO authenticated;

-- Carga manual: aprovação obrigatória por OUTRO usuário
CREATE OR REPLACE FUNCTION public.fn_implantacao_carga_manual_aprovar(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE it public.implantacao_estoque_itens; v_nome text; v_legado text;
BEGIN
  SELECT * INTO it FROM public.implantacao_estoque_itens WHERE id = p_item_id FOR UPDATE;
  IF it.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF it.tipo <> 'MANUAL' THEN RAISE EXCEPTION 'Item não é carga manual'; END IF;
  IF it.status = 'CONCLUIDO' THEN RAISE EXCEPTION 'Carga já aprovada'; END IF;
  IF COALESCE(btrim(it.motivo), '') = '' THEN RAISE EXCEPTION 'A carga manual exige motivo.'; END IF;
  IF it.solicitado_por = auth.uid() THEN
    RAISE EXCEPTION 'A carga manual deve ser aprovada por outro usuário.';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'master') OR public.usuario_tem_permissao(it.unidade_id, 'estoque.aprovar_carga_manual')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar carga manual.';
  END IF;

  PERFORM public.fn_ajustar_saldo(it.produto_id, it.unidade_id::text, it.quantidade_solicitada, 'delta');

  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  SELECT codigo_legado INTO v_legado FROM public.unidades WHERE id = it.unidade_id;

  INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, deposito_destino,
    quantidade, observacao, registrado_por, unidade_id, unidade_destino_id, implantacao_id)
  VALUES ((now() AT TIME ZONE 'America/Manaus')::date, 'ENTRADA', it.produto_id, it.produto_nome,
          v_legado, v_legado, it.quantidade_solicitada,
          'Carga inicial manual autorizada: ' || it.motivo, COALESCE(v_nome,''),
          it.unidade_id, it.unidade_id, it.implantacao_id);

  UPDATE public.implantacao_estoque_itens
     SET status = 'CONCLUIDO', quantidade_recebida = it.quantidade_solicitada,
         aprovado_por = auth.uid(), aprovado_por_nome = COALESCE(v_nome,''), aprovado_em = now()
   WHERE id = p_item_id;

  PERFORM public.fn_audit('ESTOQUE_INICIAL_CRIADO', 'implantacao_estoque_itens', p_item_id, it.unidade_id,
    NULL, jsonb_build_object('tipo','MANUAL','quantidade', it.quantidade_solicitada, 'motivo', it.motivo));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_carga_manual_aprovar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_carga_manual_aprovar(uuid) TO authenticated;

-- Sincroniza itens de transferência com o andamento real e diz se a etapa pode concluir
CREATE OR REPLACE FUNCTION public.fn_implantacao_estoque_sincronizar(p_implantacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_pendentes int; v_divergencias int;
BEGIN
  UPDATE public.implantacao_estoque_itens i
     SET quantidade_recebida = COALESCE(ti.quantidade_recebida, 0),
         status = CASE WHEN t.status = 'RECEBIDO' THEN 'CONCLUIDO'
                       WHEN t.status = 'CANCELADA' THEN 'CANCELADO'
                       WHEN t.status = 'AGUARDANDO_TRATAMENTO' THEN 'DIVERGENCIA'
                       ELSE 'EM_TRANSFERENCIA' END
    FROM public.transferencias t
    JOIN public.transferencia_itens ti ON ti.transferencia_id = t.id
   WHERE i.implantacao_id = p_implantacao_id
     AND i.transferencia_id = t.id
     AND ti.produto_id = i.produto_id;

  SELECT count(*) FILTER (WHERE status IN ('PLANEJADO','EM_TRANSFERENCIA')),
         count(*) FILTER (WHERE status = 'DIVERGENCIA')
    INTO v_pendentes, v_divergencias
    FROM public.implantacao_estoque_itens
   WHERE implantacao_id = p_implantacao_id;

  RETURN jsonb_build_object('pendentes', COALESCE(v_pendentes,0),
                            'divergencias', COALESCE(v_divergencias,0),
                            'pode_concluir', COALESCE(v_pendentes,0) = 0 AND COALESCE(v_divergencias,0) = 0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_estoque_sincronizar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_estoque_sincronizar(uuid) TO authenticated;