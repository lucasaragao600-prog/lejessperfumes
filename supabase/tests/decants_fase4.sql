-- Testes automatizados da Fase 4 de Decants (perdas, dashboard, rentabilidade, relatórios e permissões).
-- Tudo roda dentro de um DO que termina com erro proposital 'FASE4_OK' → nada é gravado.
DO $$
DECLARE v_master uuid; v_vend uuid; v_u uuid; v_p uuid; v_a uuid; v_t5 uuid; v_l uuid; v_sku uuid; v_itens jsonb; v_err boolean;
  r jsonb; v_hoje date := public.fn__hoje_manaus(); v_dir numeric; v_n int; v_rent jsonb;
BEGIN
  SELECT user_id INTO v_master FROM public.user_roles WHERE role='master' ORDER BY created_at LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_master,'role','authenticated')::text, true);
  SELECT id INTO v_u FROM public.unidades WHERE status <> 'INATIVA' ORDER BY ordem LIMIT 1;

  INSERT INTO public.perfumes (codigo, nome, marca, casa_sigla, tipo, concentracao, tamanho, volume, custo, preco_venda,
    estoque_casa, estoque_sumauma, estoque_amazonas, estoque_minimo, custo_medio, ncm, cfop, cst_csosn, unidade_fiscal,
    codigo_barras, classificacao, perfil_olfativo, notas_saida, notas_coracao, notas_fundo)
  SELECT '9F4','Teste Decant F4','Teste', sigla,'Teste','EDP','100ml',100,600,900,0,0,0,0,600,'','','','UN',
    'TESTEDEC4'||floor(random()*1e9)::text,'','','','','' FROM public.casas LIMIT 1 RETURNING id INTO v_p;
  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade) VALUES (v_p, v_u, 2);
  INSERT INTO public.decant_perfume_config (produto_id, elegivel, ativo) VALUES (v_p, true, true);
  INSERT INTO public.decant_tamanhos (nome, volume_ml, custo_frasco) VALUES ('T5',5,1) ON CONFLICT (volume_ml) DO NOTHING;
  SELECT id INTO v_t5 FROM public.decant_tamanhos WHERE volume_ml=5;
  PERFORM public.fn_decant_destinar(v_p, v_u, 2, 'T', NULL, '', NULL);
  v_a := (public.fn_decant_abrir_frasco(v_p, v_u, '', NULL, NULL, 'T', '', NULL)->>'frasco_id')::uuid;

  -- 4.1 Perda fora de lote: tipo, ml, custo/ml, valor, usuário
  PERFORM public.fn_decant_registrar_perda(v_a, 'evaporacao', 2, 'Evaporação no balcão', 'f4-p1');
  SELECT count(*) INTO v_n FROM public.decant_perdas WHERE frasco_id = v_a AND tipo='evaporacao' AND ml=2 AND custo_ml=6 AND valor=12 AND NOT absorvida_custo;
  ASSERT v_n = 1, 'perda evaporação 2 ml × R$6 = R$12';
  PERFORM public.fn_decant_registrar_perda(v_a, 'evaporacao', 2, 'Evaporação no balcão', 'f4-p1');
  ASSERT (SELECT count(*) FROM public.decant_perdas WHERE frasco_id = v_a) = 1, 'perda idempotente';
  ASSERT public.fn_decant_saldo_frasco(v_a) = 98, 'saldo 100 → 98';
  v_err := false; BEGIN PERFORM public.fn_decant_registrar_perda(v_a, 'quebra', 1, 'x', NULL); EXCEPTION WHEN OTHERS THEN v_err := true; END;
  ASSERT v_err, 'perda exige justificativa';
  v_err := false; BEGIN PERFORM public.fn_decant_registrar_perda(v_a, 'roubo', 1, 'justificativa ok', NULL); EXCEPTION WHEN OTHERS THEN v_err := true; END;
  ASSERT v_err, 'tipo inválido recusado';
  v_err := false; BEGIN PERFORM public.fn_decant_registrar_perda(v_a, 'quebra', 500, 'justificativa ok', NULL); EXCEPTION WHEN OTHERS THEN v_err := true; END;
  ASSERT v_err, 'perda não deixa saldo negativo';

  -- Perda de produção: 8×5 planejados, 7 bons (quebra) → 5 ml absorvidos no custo do lote
  v_l := (public.fn_decant_lote_criar(v_p, v_u, jsonb_build_array(jsonb_build_object('tamanho_id',v_t5,'quantidade',8)), NULL, 'T', '', NULL)->>'lote_id')::uuid;
  SELECT id INTO v_sku FROM public.decant_skus WHERE produto_id = v_p AND tamanho_id = v_t5;
  PERFORM public.fn_decant_sku_salvar(v_p, v_t5, NULL, 50, true);
  PERFORM public.fn_decant_lote_iniciar(v_l);
  PERFORM public.fn_decant_lote_finalizar(v_l, NULL);
  SELECT jsonb_agg(jsonb_build_object('item_id', id, 'qtd_fisica', 7, 'motivo', 'quebra', 'justificativa', 'Frasco quebrou')) INTO v_itens FROM public.decant_lote_itens WHERE lote_id=v_l;
  PERFORM public.fn_decant_lote_conferir(v_l, v_itens, 'C');
  ASSERT (SELECT count(*) FROM public.decant_perdas WHERE lote_id = v_l AND origem='producao' AND tipo='quebra' AND ml=5 AND absorvida_custo AND valor=30) = 1,
    'perda de produção 5 ml (R$30) absorvida no lote';
  -- Perdas fora de lote batem com o ledger do frasco
  SELECT COALESCE(sum(-ml),0) INTO v_dir FROM public.decant_ml_ledger WHERE frasco_id = v_a AND ml < 0 AND tipo NOT IN ('producao','abertura');
  ASSERT v_dir = (SELECT sum(ml) FROM public.decant_perdas WHERE frasco_id = v_a), 'perdas = ledger';

  -- Venda de exemplo para rentabilidade: receita 1.250, custo consumido 480 → lucro 770
  INSERT INTO public.decant_vendas (grupo_venda, unidade_id, sku_id, quantidade, preco_unit, custo_unit, total, canal, status)
  VALUES (gen_random_uuid(), v_u, v_sku, 10, 125, 48, 1250, 'loja_fisica', 'concluida');
  v_rent := public.fn_decant_rentabilidade('perfume', v_u, v_hoje, v_hoje);
  SELECT e INTO r FROM jsonb_array_elements(v_rent->'linhas') e WHERE (e->>'chave')::uuid = v_p;
  ASSERT (r->>'receita')::numeric = 1250 AND (r->>'custo_consumido')::numeric = 480 AND (r->>'lucro_bruto')::numeric = 770, 'rentabilidade = R$770';
  ASSERT (r->>'margem_pct')::numeric = 61.6, 'margem 61,6%';
  ASSERT (r->>'volume_restante')::numeric = public.fn_decant_saldo_frasco(v_a), 'volume restante = saldo do frasco';

  -- 4.2 Dashboard bate com consultas diretas (filial + hoje)
  r := public.fn_decant_dashboard(v_u, v_hoje, v_hoje)->'cards';
  SELECT COALESCE(sum(round(preco_unit*(quantidade-qtd_devolvida),2)),0) INTO v_dir FROM public.decant_vendas
   WHERE unidade_id = v_u AND status <> 'cancelada' AND public.fn__decant_dia(created_at) = v_hoje;
  ASSERT (r->>'faturamento_periodo')::numeric = v_dir AND (r->>'faturamento_hoje')::numeric = v_dir, 'faturamento = vendas do dia';
  SELECT COALESCE(sum(quantidade-qtd_devolvida),0) INTO v_dir FROM public.decant_vendas WHERE unidade_id = v_u AND status <> 'cancelada' AND public.fn__decant_dia(created_at) = v_hoje;
  ASSERT (r->>'vendidos_un')::numeric = v_dir, 'decants vendidos';
  SELECT COALESCE(sum(ml),0) INTO v_dir FROM public.decant_perdas WHERE unidade_id = v_u AND public.fn__decant_dia(created_at) = v_hoje;
  ASSERT (r->>'perdas_ml')::numeric = v_dir, 'perdas em ml';
  SELECT COALESCE(sum(GREATEST(public.fn_decant_saldo_frasco(id) - public.fn_decant_reservado_frasco(id),0)),0) INTO v_dir
    FROM public.decant_frascos WHERE unidade_id = v_u AND status = 'aberto';
  ASSERT (r->>'ml_disponivel')::numeric = v_dir, 'ml disponível = ledger − reservas';
  SELECT COALESCE(sum(i.qtd_fisica),0) INTO v_dir FROM public.decant_lote_itens i JOIN public.decant_lotes l ON l.id=i.lote_id
   WHERE l.unidade_id = v_u AND l.status='concluido' AND public.fn__decant_dia(l.conferido_em) = v_hoje;
  ASSERT (r->>'produzidos_un')::numeric = v_dir, 'quantidade produzida';
  SELECT COALESCE(sum(quantidade),0) INTO v_dir FROM public.decant_fechados_saldo WHERE unidade_id = v_u;
  ASSERT (r->>'fechados_reservados')::numeric = v_dir, 'frascos fechados reservados';
  -- Filtro de período muda os cards: ontem não tem as vendas de hoje do teste
  ASSERT (public.fn_decant_dashboard(v_u, v_hoje - 1, v_hoje - 1)->'cards'->>'faturamento_periodo')::numeric
       = (SELECT COALESCE(sum(round(preco_unit*(quantidade-qtd_devolvida),2)),0) FROM public.decant_vendas WHERE unidade_id = v_u AND status <> 'cancelada' AND public.fn__decant_dia(created_at) = v_hoje - 1),
    'filtro de período coerente';

  -- 4.3 Visão 360°
  r := public.fn_decant_perfume_360(v_p, NULL);
  ASSERT (r->>'frascos_fechados')::int = 1 AND (r->>'frascos_abertos')::int = 1, '360: 1 fechado e 1 aberto';
  ASSERT (r->>'perdas_ml')::numeric = 7, '360: perdas 2 + 5 ml';
  ASSERT (r->>'custo_ml')::numeric = 6, '360: custo/ml';

  -- 4.6 Relatórios: todos executam
  PERFORM public.fn_decant_relatorio(t, NULL, v_hoje - 30, v_hoje) FROM unnest(ARRAY['producao','vendas','estoque','estoque_filial','volume_disponivel',
    'perfumes_abertos_fechados','perdas','margem','custos','movimentacoes','divergencias','lotes','reposicao','mais_vendidos','sem_venda',
    'rent_perfume','rent_tamanho','desempenho_filial']) t;
  r := public.fn_decant_relatorio('vendas', v_u, v_hoje, v_hoje);
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'colunas') c WHERE c->>'k' = 'custo'), 'master vê custo';

  -- Permissão: usuário sem decant.custos/margem não vê custo nem lucro (nem no relatório/exportação)
  SELECT user_id INTO v_vend FROM public.user_roles WHERE role='vendedor' LIMIT 1;
  IF v_vend IS NOT NULL THEN
    UPDATE public.configuracoes SET valor = valor || '{"ativo": true}'::jsonb WHERE chave = 'decants';
    INSERT INTO public.role_permissions (role, permission) SELECT 'vendedor', x FROM unnest(ARRAY['decant.ver','decant.relatorios']) x
      WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role='vendedor' AND permission = x);
    DELETE FROM public.role_permissions WHERE role='vendedor' AND permission IN ('decant.custos','decant.margem');
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_vend,'role','authenticated')::text, true);
    r := public.fn_decant_relatorio('vendas', NULL, v_hoje - 30, v_hoje);
    ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'colunas') c WHERE c->>'k' IN ('custo','lucro')), 'sem coluna de custo/lucro';
    ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'linhas') l WHERE l ? 'custo' OR l ? 'lucro'), 'linhas sem custo/lucro';
    r := public.fn_decant_dashboard(NULL, v_hoje, v_hoje);
    ASSERT r->'cards'->'custo_estoque' = 'null'::jsonb AND r->'cards'->'margem_pct' = 'null'::jsonb AND r->'cards'->'perdas_valor' = 'null'::jsonb, 'dashboard sem custos';
    r := public.fn_decant_rentabilidade('perfume', NULL, v_hoje, v_hoje);
    ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'linhas') l WHERE l->'custo_consumido' <> 'null'::jsonb OR l->'lucro_bruto' <> 'null'::jsonb), 'rentabilidade sem custos';
  END IF;

  RAISE EXCEPTION 'FASE4_OK';
END $$;
