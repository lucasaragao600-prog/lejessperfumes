-- Testes automatizados da Fase 3 de Decants (estoque, venda, cancelamento, devolução, inventário, transferência).
-- Rodam em transação e terminam em ROLLBACK. Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/decants_fase3.sql
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub',(SELECT user_id FROM public.user_roles WHERE role='master' ORDER BY created_at LIMIT 1),'role','authenticated')::text, true);

DO $$
DECLARE v_u uuid; v_u2 uuid; v_p uuid; r jsonb; v_a uuid; v_t5 uuid; v_l uuid; v_sku uuid; v_itens jsonb; v_err boolean;
  v_g uuid; v_vid uuid; v_q uuid; v_inv uuid; v_tr uuid; v_n int; v_saldo_disp numeric;
BEGIN
  -- Usa uma filial com caixa aberto (o teste não abre caixa).
  SELECT unidade_id INTO v_u FROM public.caixa_sessoes WHERE status = 'aberto' AND unidade_id IS NOT NULL ORDER BY aberto_em DESC LIMIT 1;
  IF v_u IS NULL THEN RAISE EXCEPTION 'Abra um caixa em qualquer filial para rodar este teste'; END IF;
  SELECT id INTO v_u2 FROM public.unidades WHERE status <> 'INATIVA' AND id <> v_u ORDER BY ordem LIMIT 1;
  INSERT INTO public.perfumes (codigo, nome, marca, casa_sigla, tipo, concentracao, tamanho, volume, custo, preco_venda,
    estoque_casa, estoque_sumauma, estoque_amazonas, estoque_minimo, custo_medio, ncm, cfop, cst_csosn, unidade_fiscal,
    codigo_barras, classificacao, perfil_olfativo, notas_saida, notas_coracao, notas_fundo)
  SELECT '9F3','Teste Decant F3','Teste', sigla,'Teste','EDP','100ml',100,600,900,0,0,0,0,600,'','','','UN',
    'TESTEDEC3'||floor(random()*1e9)::text,'','','','','' FROM public.casas LIMIT 1 RETURNING id INTO v_p;
  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade) VALUES (v_p, v_u, 2);
  INSERT INTO public.decant_perfume_config (produto_id, elegivel, ativo) VALUES (v_p, true, true);
  INSERT INTO public.decant_tamanhos (nome, volume_ml, custo_frasco) VALUES ('T5',5,1) ON CONFLICT (volume_ml) DO NOTHING;
  SELECT id INTO v_t5 FROM public.decant_tamanhos WHERE volume_ml=5;

  PERFORM public.fn_decant_destinar(v_p, v_u, 2, 'T', NULL, '', NULL);
  v_a := (public.fn_decant_abrir_frasco(v_p, v_u, '', NULL, NULL, 'T', '', NULL)->>'frasco_id')::uuid;

  -- Estoque potencial: 100 ml = 20×5, mas é só simulação (nenhum estoque físico)
  r := public.fn_decant_estoque_listar(v_u);
  SELECT (e->>'disponivel_ml')::numeric INTO v_saldo_disp FROM jsonb_array_elements(r->'potencial') e WHERE (e->>'produto_id')::uuid = v_p;
  ASSERT v_saldo_disp = 100, 'potencial parte de 100 ml';
  ASSERT NOT EXISTS (SELECT 1 FROM public.decant_estoque e JOIN public.decant_skus s ON s.id=e.sku_id WHERE s.produto_id = v_p), 'simulação não gera estoque';

  -- Produção de 8×5 ml; antes da conferência não há estoque
  v_l := (public.fn_decant_lote_criar(v_p, v_u, jsonb_build_array(jsonb_build_object('tamanho_id',v_t5,'quantidade',8)), NULL, 'T', '', NULL)->>'lote_id')::uuid;
  SELECT id INTO v_sku FROM public.decant_skus WHERE produto_id = v_p AND tamanho_id = v_t5;
  UPDATE public.decant_skus SET preco_venda = 50 WHERE id = v_sku;
  PERFORM public.fn_decant_lote_iniciar(v_l);
  PERFORM public.fn_decant_lote_finalizar(v_l, NULL);
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 0, 'sem entrada antes da conferência';
  SELECT jsonb_agg(jsonb_build_object('item_id', id, 'qtd_fisica', 8)) INTO v_itens FROM public.decant_lote_itens WHERE lote_id=v_l;
  PERFORM public.fn_decant_lote_conferir(v_l, v_itens, 'C');
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 8, 'entrada automática após conferência: 8';
  ASSERT NOT (SELECT entrada_estoque_pendente FROM public.decant_lotes WHERE id=v_l), 'gancho baixado';
  ASSERT (SELECT custo_medio FROM public.decant_skus WHERE id=v_sku) = 31, 'custo médio = 5 ml × R$6 + R$1';

  -- Venda baixa o SKU correto: 8 → 7
  r := public.fn_decant_vender(v_u, jsonb_build_array(jsonb_build_object('sku_id',v_sku,'quantidade',1)),
    jsonb_build_array(jsonb_build_object('forma','Dinheiro','valor',50)), 'loja_fisica', NULL, 'Teste', 'f3-v1');
  v_g := (r->>'grupo_venda')::uuid;
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 7, 'venda 8 → 7';
  ASSERT (public.fn_decant_vender(v_u, jsonb_build_array(jsonb_build_object('sku_id',v_sku,'quantidade',1)),
    jsonb_build_array(jsonb_build_object('forma','Dinheiro','valor',50)), 'loja_fisica', NULL, 'Teste', 'f3-v1')->>'repetido')::boolean, 'idempotente';
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 7, 'reenvio não baixa de novo';
  ASSERT EXISTS (SELECT 1 FROM public.caixa_movimentacoes WHERE tipo='venda_decant' AND valor=50), 'dinheiro no caixa';

  -- Venda sem estoque é bloqueada (sob demanda desligado)
  v_err := false;
  BEGIN PERFORM public.fn_decant_vender(v_u, jsonb_build_array(jsonb_build_object('sku_id',v_sku,'quantidade',8)),
    jsonb_build_array(jsonb_build_object('forma','Pix','valor',400)), 'site', NULL, '', NULL);
  EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err AND public.fn_decant_saldo_sku(v_sku, v_u) = 7, 'venda sem estoque bloqueada';
  v_err := false;
  BEGIN PERFORM public.fn_decant_vender(v_u, jsonb_build_array(jsonb_build_object('sku_id',v_sku,'quantidade',1)),
    jsonb_build_array(jsonb_build_object('forma','Pix','valor',10)), 'site', NULL, '', NULL);
  EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'pagamento diferente do total é recusado';

  -- Cancelamento antes da saída restaura o estoque
  PERFORM public.fn_decant_venda_cancelar(v_g, 'cliente desistiu');
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 8, 'cancelamento 7 → 8';
  ASSERT EXISTS (SELECT 1 FROM public.caixa_movimentacoes WHERE tipo='estorno_decant' AND valor=50), 'estorno no caixa';

  -- Devolução de produto entregue vai para a quarentena (não volta ao vendável)
  r := public.fn_decant_vender(v_u, jsonb_build_array(jsonb_build_object('sku_id',v_sku,'quantidade',2)),
    jsonb_build_array(jsonb_build_object('forma','Pix','valor',100)), 'whatsapp', NULL, '', NULL);
  SELECT id INTO v_vid FROM public.decant_vendas WHERE grupo_venda = (r->>'grupo_venda')::uuid;
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 6, 'venda 2';
  v_q := (public.fn_decant_devolver(v_vid, 1, 'cliente devolveu', false)->>'quarentena_id')::uuid;
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 6, 'devolução não volta ao estoque vendável';
  v_err := false;
  BEGIN PERFORM public.fn_decant_quarentena_decidir(v_q, 'retornar', false, ''); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'sem lacre não retorna';
  PERFORM public.fn_decant_quarentena_decidir(v_q, 'retornar', true, 'lacrado');
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 7, 'lacrado aprovado retorna';

  -- Inventário: diferença fica pendente até aprovação
  v_inv := (public.fn_decant_inventario_contar(v_sku, v_u, 5, 'contagem física')->>'id')::uuid;
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 7, 'contagem não altera antes de aprovar';
  PERFORM public.fn_decant_inventario_decidir(v_inv, true);
  ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 5, 'inventário aprovado 7 → 5';

  -- Transferência: em trânsito não conta em nenhuma filial; recebimento com falta gera divergência
  IF v_u2 IS NOT NULL THEN
    v_tr := (public.fn_decant_transf_criar(v_u, v_u2, jsonb_build_array(jsonb_build_object('tipo','pronto','sku_id',v_sku,'quantidade',3)), '', NULL)->>'id')::uuid;
    PERFORM public.fn_decant_transf_separar(v_tr);
    PERFORM public.fn_decant_transf_enviar(v_tr, 'Moto');
    ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 2 AND public.fn_decant_saldo_sku(v_sku, v_u2) = 0, 'em trânsito não conta no destino';
    SELECT jsonb_agg(jsonb_build_object('item_id', id, 'qtd_recebida', 2)) INTO v_itens FROM public.decant_transf_itens WHERE transferencia_id = v_tr;
    r := public.fn_decant_transf_receber(v_tr, v_itens);
    ASSERT r->>'status' = 'divergencia', 'falta gera divergência';
    ASSERT public.fn_decant_saldo_sku(v_sku, v_u2) = 2, 'destino recebe só o conferido';
    PERFORM public.fn_decant_transf_resolver(v_tr, 'retorno_origem', 'achado na origem');
    ASSERT public.fn_decant_saldo_sku(v_sku, v_u) = 3, 'falta volta à origem';
    -- frasco aberto sem configuração é bloqueado
    v_err := false;
    BEGIN PERFORM public.fn_decant_transf_criar(v_u, v_u2, jsonb_build_array(jsonb_build_object('tipo','frasco','frasco_id',v_a)), '', NULL);
    EXCEPTION WHEN others THEN v_err := true; END;
    ASSERT v_err, 'frasco aberto exige configuração';
  END IF;

  -- Nenhum registro de movimentação é editável ou excluível
  v_err := false;
  BEGIN UPDATE public.decant_un_ledger SET quantidade = 99 WHERE sku_id = v_sku; EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'ledger de unidades imutável';
  v_err := false;
  BEGIN DELETE FROM public.decant_vendas WHERE id = v_vid; EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'venda não pode ser excluída';
  SELECT count(*) INTO v_n FROM public.decant_un_ledger WHERE sku_id = v_sku;
  ASSERT v_n >= 8, 'movimentos registrados';
  ASSERT jsonb_array_length(public.fn_decant_movimentacoes_listar(jsonb_build_object('busca','9f3'), 100, 0)) >= 8, 'histórico filtrável';

  RAISE NOTICE 'DECANTS FASE 3: TODOS OS TESTES PASSARAM';
END $$;
ROLLBACK;
