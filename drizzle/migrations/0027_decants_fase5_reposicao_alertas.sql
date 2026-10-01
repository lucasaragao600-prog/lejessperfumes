-- Fase 5 Decants: reposição e alertas (somente leitura, aditiva). Reverter: supabase/rollback/0027_decants_fase5_down.sql
CREATE OR REPLACE FUNCTION public.fn_decant_reposicao(p_unidade uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  WITH base AS (
    SELECT su.sku_id, su.unidade_id, s.produto_id, s.sku, t.id tamanho_id, t.nome tamanho, t.volume_ml,
      su.estoque_minimo minimo, su.estoque_ideal ideal, u.nome filial,
      COALESCE((SELECT sum(quantidade) FROM public.decant_estoque e WHERE e.sku_id = su.sku_id AND e.unidade_id = su.unidade_id),0)::int atual,
      COALESCE((SELECT sum(i.qtd_planejada) FROM public.decant_lote_itens i JOIN public.decant_lotes l ON l.id = i.lote_id
        WHERE i.sku_id = su.sku_id AND l.unidade_id = su.unidade_id AND l.status IN ('planejado','em_producao','aguardando_conferencia')),0)::int em_producao
    FROM public.decant_sku_unidade su JOIN public.decant_skus s ON s.id = su.sku_id AND s.ativo
    JOIN public.decant_tamanhos t ON t.id = s.tamanho_id JOIN public.unidades u ON u.id = su.unidade_id
    WHERE (p_unidade IS NULL OR su.unidade_id = p_unidade) AND public.fn__pode(su.unidade_id,'decant.ver')
  ), calc AS (
    SELECT b.*, GREATEST(GREATEST(b.ideal,b.minimo) - b.atual - b.em_producao, 0) sugerido,
      (SELECT COALESCE(sum(GREATEST(public.fn_decant_disponivel_frasco(f.id),0)),0) FROM public.decant_frascos f
        WHERE f.produto_id = b.produto_id AND f.unidade_id = b.unidade_id AND f.status = 'aberto') ml_disponivel,
      (SELECT jsonb_build_object('id', f.id, 'codigo', f.codigo, 'disponivel_ml', public.fn_decant_disponivel_frasco(f.id))
        FROM public.decant_frascos f WHERE f.produto_id = b.produto_id AND f.unidade_id = b.unidade_id AND f.status = 'aberto'
          AND public.fn_decant_disponivel_frasco(f.id) > 0 ORDER BY f.aberto_em, f.codigo LIMIT 1) frasco_sugerido,
      COALESCE((SELECT sum(quantidade) FROM public.decant_fechados_saldo fs WHERE fs.produto_id = b.produto_id AND fs.unidade_id = b.unidade_id),0) fechados
    FROM base b WHERE b.atual <= b.minimo
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sku_id', sku_id, 'unidade_id', unidade_id, 'produto_id', produto_id, 'tamanho_id', tamanho_id,
      'sku', sku, 'perfume', public.fn__decant_rotulo(produto_id), 'tamanho', tamanho, 'volume_ml', volume_ml, 'filial', filial,
      'minimo', minimo, 'ideal', ideal, 'atual', atual, 'em_producao', em_producao, 'sugerido', sugerido,
      'ml_necessario', sugerido * volume_ml, 'ml_disponivel', ml_disponivel,
      'deficit_ml', GREATEST(sugerido * volume_ml - ml_disponivel, 0),
      'produzivel', LEAST(sugerido, floor(ml_disponivel / NULLIF(volume_ml,0)))::int,
      'frasco_sugerido', frasco_sugerido, 'frascos_fechados', fechados) ORDER BY public.fn__decant_rotulo(produto_id), volume_ml),'[]')
  INTO v FROM calc WHERE sugerido > 0;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_alertas(p_unidade uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb := public.fn__decant_cfg(); v_crit numeric; v_dias int; v_perda numeric; v_rep jsonb; r jsonb := '[]';
  v_it jsonb;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  v_crit := COALESCE((c->>'volume_critico_ml')::numeric, 10);
  v_dias := COALESCE((c->>'dias_aberto_alerta')::int, 60);
  v_perda := COALESCE((c->>'perda_max_pct')::numeric, 5);

  -- 1. Volume crítico por perfume/filial
  SELECT COALESCE(jsonb_agg(x),'[]') INTO v_it FROM (
    SELECT jsonb_build_object('ref', public.fn__decant_rotulo(f.produto_id), 'filial', u.nome,
      'detalhe', public.fn__fmt_ml(sum(GREATEST(public.fn_decant_disponivel_frasco(f.id),0))) || ' ml disponíveis (limite ' || public.fn__fmt_ml(COALESCE(NULLIF(max(pc.estoque_minimo_ml),0), v_crit)) || ' ml)') x
    FROM public.decant_frascos f JOIN public.unidades u ON u.id = f.unidade_id
    LEFT JOIN public.decant_perfume_config pc ON pc.produto_id = f.produto_id
    WHERE f.status = 'aberto' AND (p_unidade IS NULL OR f.unidade_id = p_unidade) AND public.fn__pode(f.unidade_id,'decant.ver')
    GROUP BY f.produto_id, f.unidade_id, u.nome
    HAVING sum(GREATEST(public.fn_decant_disponivel_frasco(f.id),0)) < COALESCE(NULLIF(max(pc.estoque_minimo_ml),0), v_crit)) q;
  r := r || jsonb_build_object('tipo','volume_critico','titulo','Perfume com volume crítico','aba','frascos','itens',v_it);

  -- 2 e 7. Decant abaixo do mínimo / produção sugerida
  v_rep := public.fn_decant_reposicao(p_unidade);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', e->>'sku', 'filial', e->>'filial',
    'detalhe', (e->>'perfume') || ' · ' || (e->>'atual') || ' em estoque, mínimo ' || (e->>'minimo'))),'[]') INTO v_it
    FROM jsonb_array_elements(v_rep) e WHERE (e->>'atual')::int < (e->>'minimo')::int;
  r := r || jsonb_build_object('tipo','abaixo_minimo','titulo','Decant abaixo do mínimo','aba','reposicao','itens',v_it);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', e->>'sku', 'filial', e->>'filial',
    'detalhe', 'Produzir ' || (e->>'sugerido') || ' un' || CASE WHEN (e->>'deficit_ml')::numeric > 0 THEN ' · faltam ' || public.fn__fmt_ml((e->>'deficit_ml')::numeric) || ' ml' ELSE '' END)),'[]') INTO v_it
    FROM jsonb_array_elements(v_rep) e;
  r := r || jsonb_build_object('tipo','producao_sugerida','titulo','Produção sugerida','aba','reposicao','itens',v_it);

  -- 3. Lote aguardando conferência
  SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', l.codigo, 'filial', u.nome, 'detalhe', public.fn__decant_rotulo(l.produto_id))),'[]') INTO v_it
    FROM public.decant_lotes l JOIN public.unidades u ON u.id = l.unidade_id
    WHERE l.status = 'aguardando_conferencia' AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver');
  r := r || jsonb_build_object('tipo','lote_conferencia','titulo','Lote aguardando conferência','aba','producao','itens',v_it);

  -- 4. Divergências pendentes (conferência de frasco, inventário, transferência, quarentena)
  SELECT COALESCE(jsonb_agg(x),'[]') INTO v_it FROM (
    SELECT jsonb_build_object('ref', f.codigo, 'filial', u.nome, 'detalhe', 'Conferência de frasco: diferença de ' || public.fn__fmt_ml(c2.diferenca) || ' ml') x
      FROM public.decant_conferencias c2 JOIN public.decant_frascos f ON f.id = c2.frasco_id JOIN public.unidades u ON u.id = c2.unidade_id
      WHERE c2.status = 'pendente' AND (p_unidade IS NULL OR c2.unidade_id = p_unidade) AND public.fn__pode(c2.unidade_id,'decant.ver')
    UNION ALL
    SELECT jsonb_build_object('ref', s.sku, 'filial', u.nome, 'detalhe', 'Inventário: diferença de ' || i.diferenca || ' un')
      FROM public.decant_inventarios i JOIN public.decant_skus s ON s.id = i.sku_id JOIN public.unidades u ON u.id = i.unidade_id
      WHERE i.status = 'pendente' AND (p_unidade IS NULL OR i.unidade_id = p_unidade) AND public.fn__pode(i.unidade_id,'decant.ver')
    UNION ALL
    SELECT jsonb_build_object('ref', s.sku, 'filial', u.nome, 'detalhe', 'Devolução em quarentena: ' || q.quantidade || ' un')
      FROM public.decant_quarentena q JOIN public.decant_skus s ON s.id = q.sku_id JOIN public.unidades u ON u.id = q.unidade_id
      WHERE q.status = 'pendente' AND (p_unidade IS NULL OR q.unidade_id = p_unidade) AND public.fn__pode(q.unidade_id,'decant.ver')
    UNION ALL
    SELECT jsonb_build_object('ref', 'Transferência', 'filial', u.nome, 'detalhe', 'Recebimento com divergência')
      FROM public.decant_transferencias t JOIN public.unidades u ON u.id = t.destino_id
      WHERE t.status = 'divergencia' AND (p_unidade IS NULL OR t.destino_id = p_unidade OR t.origem_id = p_unidade)
        AND (public.fn__pode(t.destino_id,'decant.ver') OR public.fn__pode(t.origem_id,'decant.ver'))) q;
  r := r || jsonb_build_object('tipo','divergencia','titulo','Divergência pendente','aba','estoque','itens',v_it);

  -- 5. Perda acima do permitido (últimos 30 dias, por filial)
  SELECT COALESCE(jsonb_agg(x),'[]') INTO v_it FROM (
    SELECT jsonb_build_object('ref', u.nome, 'filial', u.nome, 'detalhe', round(p.ml / NULLIF(m.ml,0) * 100, 1) || '% de perda (limite ' || v_perda || '%)') x
    FROM (SELECT unidade_id, sum(ml) ml FROM public.decant_perdas WHERE created_at >= now() - interval '30 days' GROUP BY 1) p
    JOIN (SELECT unidade_id, sum(-ml) ml FROM public.decant_ml_ledger WHERE ml < 0 AND tipo <> 'abertura' AND created_at >= now() - interval '30 days' GROUP BY 1) m ON m.unidade_id = p.unidade_id
    JOIN public.unidades u ON u.id = p.unidade_id
    WHERE m.ml > 0 AND p.ml / m.ml * 100 > v_perda AND (p_unidade IS NULL OR p.unidade_id = p_unidade) AND public.fn__pode(p.unidade_id,'decant.ver')) q;
  r := r || jsonb_build_object('tipo','perda_alta','titulo','Perda acima do permitido','aba','perdas','itens',v_it);

  -- 6. Perfume aberto há mais dias que o limite
  SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', f.codigo, 'filial', u.nome,
      'detalhe', public.fn__decant_rotulo(f.produto_id) || ' · aberto há ' || (public.fn__hoje_manaus() - public.fn__decant_dia(f.aberto_em)) || ' dias')),'[]') INTO v_it
    FROM public.decant_frascos f JOIN public.unidades u ON u.id = f.unidade_id
    WHERE f.status = 'aberto' AND public.fn__hoje_manaus() - public.fn__decant_dia(f.aberto_em) > v_dias
      AND public.fn_decant_disponivel_frasco(f.id) > 0
      AND (p_unidade IS NULL OR f.unidade_id = p_unidade) AND public.fn__pode(f.unidade_id,'decant.ver');
  r := r || jsonb_build_object('tipo','aberto_antigo','titulo','Perfume aberto há muito tempo','aba','frascos','itens',v_it);

  -- 9. Venda sem estoque suficiente (venda sob demanda aguardando produção)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('ref', s.sku, 'filial', u.nome, 'detalhe', v2.quantidade || ' un vendidas aguardando produção')),'[]') INTO v_it
    FROM public.decant_vendas v2 JOIN public.decant_skus s ON s.id = v2.sku_id JOIN public.unidades u ON u.id = v2.unidade_id
    WHERE v2.status = 'pendente_producao' AND (p_unidade IS NULL OR v2.unidade_id = p_unidade) AND public.fn__pode(v2.unidade_id,'decant.ver');
  r := r || jsonb_build_object('tipo','venda_sem_estoque','titulo','Venda sem estoque suficiente','aba','vendas','itens',v_it);

  -- 8. Produto indisponível no site: plataforma do site ainda não confirmada; sem integração externa.
  SELECT COALESCE(jsonb_agg(e || jsonb_build_object('qtd', jsonb_array_length(e->'itens'))),'[]') INTO r FROM jsonb_array_elements(r) e;
  RETURN jsonb_build_object('alertas', r, 'total', (SELECT COALESCE(sum((e->>'qtd')::int),0) FROM jsonb_array_elements(r) e),
    'limites', jsonb_build_object('volume_critico_ml', v_crit, 'dias_aberto_alerta', v_dias, 'perda_max_pct', v_perda));
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_decant_reposicao(uuid), public.fn_decant_alertas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_reposicao(uuid), public.fn_decant_alertas(uuid) TO authenticated;