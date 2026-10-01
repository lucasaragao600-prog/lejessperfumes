-- Testes automatizados da Fase 2 de Decants (produção e lotes). Rodam em transação e terminam em ROLLBACK.
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/decants_fase2.sql
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub',(SELECT user_id FROM public.user_roles WHERE role='master' ORDER BY created_at LIMIT 1),'role','authenticated')::text, true);

DO $$
DECLARE v_u uuid; v_p uuid; r jsonb; v_a uuid; v_b uuid; v_t2 uuid; v_t5 uuid; v_t10 uuid; v_l1 uuid; v_l2 uuid;
  v_err boolean; v_msg text; v_aud int; v_itens jsonb;
BEGIN
  SELECT id INTO v_u FROM public.unidades WHERE status <> 'INATIVA' ORDER BY ordem LIMIT 1;
  INSERT INTO public.perfumes (codigo, nome, marca, casa_sigla, tipo, concentracao, tamanho, volume, custo, preco_venda,
    estoque_casa, estoque_sumauma, estoque_amazonas, estoque_minimo, custo_medio, ncm, cfop, cst_csosn, unidade_fiscal,
    codigo_barras, classificacao, perfil_olfativo, notas_saida, notas_coracao, notas_fundo)
  SELECT '1051','Teste Decant F2','Teste', sigla,'Teste','EDP','100ml',100,600,900,0,0,0,0,600,'','','','UN',
    'TESTEDEC2'||floor(random()*1e9)::text,'','','','','' FROM public.casas LIMIT 1
  RETURNING id INTO v_p;
  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade) VALUES (v_p, v_u, 2);
  INSERT INTO public.decant_perfume_config (produto_id, elegivel, ativo) VALUES (v_p, true, true);
  INSERT INTO public.decant_tamanhos (nome, volume_ml, custo_frasco) VALUES ('T2',2,1),('T5',5,1),('T10',10,1) ON CONFLICT (volume_ml) DO NOTHING;
  SELECT id INTO v_t2 FROM public.decant_tamanhos WHERE volume_ml=2;
  SELECT id INTO v_t5 FROM public.decant_tamanhos WHERE volume_ml=5;
  SELECT id INTO v_t10 FROM public.decant_tamanhos WHERE volume_ml=10;

  -- SKU no padrão
  ASSERT public.fn_decant_sku_codigo('1051',5) = 'DEC-1051-005', 'SKU 5 ml';
  ASSERT public.fn_decant_sku_codigo('1051',2.5) = 'DEC-1051-2P5', 'SKU 2,5 ml';

  PERFORM public.fn_decant_destinar(v_p, v_u, 2, 'T', NULL, '', NULL);
  v_a := (public.fn_decant_abrir_frasco(v_p, v_u, '', NULL, NULL, 'T', '', NULL)->>'frasco_id')::uuid;
  PERFORM public.fn_decant_registrar_saida(v_a, 'perda', 10, 'teste', NULL);  -- A fica com 90 ml

  -- Regra 2 / aceite: 10×2 + 10×5 + 4×10 = 110 ml, com 90 disponíveis → bloqueado com a mensagem exata
  v_msg := '';
  BEGIN
    PERFORM public.fn_decant_lote_criar(v_p, v_u, jsonb_build_array(
      jsonb_build_object('tamanho_id',v_t2,'quantidade',10), jsonb_build_object('tamanho_id',v_t5,'quantidade',10),
      jsonb_build_object('tamanho_id',v_t10,'quantidade',4)), NULL, 'T', '', NULL);
  EXCEPTION WHEN others THEN v_msg := SQLERRM; END;
  ASSERT v_msg = 'Volume insuficiente. Necessário: 110 ml. Disponível: 90 ml.', 'mensagem exata, veio: ' || v_msg;

  -- Reserva: lote 1 reserva 80 ml de A (FIFO)
  r := public.fn_decant_lote_criar(v_p, v_u, jsonb_build_array(jsonb_build_object('tamanho_id',v_t10,'quantidade',8)), NULL, 'T', '', 'f2-l1');
  v_l1 := (r->>'lote_id')::uuid;
  ASSERT r->>'codigo' ~ '^DEC-LOTE-\d{6}$', 'código do lote';
  ASSERT public.fn_decant_disponivel_frasco(v_a) = 10, 'disponível = 90 - 80 reservados';
  ASSERT (public.fn_decant_lote_criar(v_p, v_u, '[]'::jsonb || jsonb_build_object('tamanho_id',v_t10,'quantidade',8), NULL, 'T', '', 'f2-l1')->>'repetido')::boolean, 'idempotente';
  ASSERT (SELECT count(*) FROM public.decant_skus WHERE produto_id=v_p) = 1, 'SKU criado automaticamente';

  -- Segundo lote não usa o mesmo ml (regra 9)
  v_err := false;
  BEGIN PERFORM public.fn_decant_lote_criar(v_p, v_u, jsonb_build_array(jsonb_build_object('tamanho_id',v_t5,'quantidade',3)), NULL, 'T', '', NULL);
  EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'segundo lote de 15 ml com só 10 disponíveis deve falhar';
  v_err := false;
  BEGIN PERFORM public.fn_decant_registrar_saida(v_a, 'tester', 20, 'x', NULL); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'saída avulsa não pode usar ml reservado';

  -- Cancelar lote planejado libera a reserva
  PERFORM public.fn_decant_lote_cancelar(v_l1, 'teste de cancelamento');
  ASSERT public.fn_decant_disponivel_frasco(v_a) = 90, 'reserva liberada';
  v_err := false;
  BEGIN DELETE FROM public.decant_lotes WHERE id = v_l1; EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'lote não pode ser excluído (regra 6)';

  -- Dois frascos: 20 ml de A + 40 ml de B = 60 ml
  v_b := (public.fn_decant_abrir_frasco(v_p, v_u, '', NULL, NULL, 'T', '', NULL)->>'frasco_id')::uuid;
  r := public.fn_decant_lote_criar(v_p, v_u, jsonb_build_array(jsonb_build_object('tamanho_id',v_t5,'quantidade',12)),
    jsonb_build_array(jsonb_build_object('frasco_id',v_a,'ml',20), jsonb_build_object('frasco_id',v_b,'ml',40)), 'T', '', NULL);
  v_l2 := (r->>'lote_id')::uuid;
  ASSERT (r->>'volume_ml')::numeric = 60, 'volume 60';
  ASSERT NOT (r->>'fora_fifo')::boolean, 'A é o mais antigo e foi usado primeiro';

  -- Produção sem lote é impossível: não há RPC de produção fora do lote; finalizar exige lote em produção
  v_err := false;
  BEGIN PERFORM public.fn_decant_lote_finalizar(v_l2, NULL); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'finalizar sem iniciar deve falhar';
  PERFORM public.fn_decant_lote_iniciar(v_l2);
  PERFORM public.fn_decant_lote_finalizar(v_l2, NULL);
  ASSERT (SELECT ml_consumido FROM public.decant_lote_frascos WHERE lote_id=v_l2 AND frasco_id=v_a) = 20, 'consumo A';
  ASSERT (SELECT ml_consumido FROM public.decant_lote_frascos WHERE lote_id=v_l2 AND frasco_id=v_b) = 40, 'consumo B';
  ASSERT public.fn_decant_saldo_frasco(v_a) = 70 AND public.fn_decant_saldo_frasco(v_b) = 60, 'saldos após produção';
  ASSERT (SELECT custo_liquido FROM public.decant_lotes WHERE id=v_l2) = 360, 'custo do líquido 60 ml × R$ 6';

  -- Regra 4: sem conferência não há entrada; conferência com diferença exige motivo
  ASSERT NOT (SELECT entrada_estoque_pendente FROM public.decant_lotes WHERE id=v_l2), 'sem entrada antes da conferência';
  SELECT jsonb_agg(jsonb_build_object('item_id', id, 'qtd_fisica', 11)) INTO v_itens FROM public.decant_lote_itens WHERE lote_id=v_l2;
  v_err := false;
  BEGIN PERFORM public.fn_decant_lote_conferir(v_l2, v_itens, 'C'); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'diferença sem motivo deve falhar';
  SELECT jsonb_agg(jsonb_build_object('item_id', id, 'qtd_fisica', 11, 'motivo','quebra','justificativa','frasco quebrou')) INTO v_itens
    FROM public.decant_lote_itens WHERE lote_id=v_l2;
  r := public.fn_decant_lote_conferir(v_l2, v_itens, 'C');
  ASSERT (r->>'custo_total')::numeric = 372, 'custo total = 360 líquido + 12 × R$ 1 de frasco';
  ASSERT (SELECT custo_unitario FROM public.decant_lote_itens WHERE lote_id=v_l2) = round(372/11.0, 6), 'perda rateada nas 11 boas';
  ASSERT (SELECT perdas_ml FROM public.decant_lotes WHERE id=v_l2) = 5, 'perda 5 ml';
  ASSERT EXISTS (SELECT 1 FROM public.decant_lote_eventos WHERE lote_id=v_l2 AND evento='entrada_estoque_pendente'), 'gancho de entrada';

  -- Regra 7: editar lote concluído gera auditoria
  SELECT count(*) INTO v_aud FROM public.audit_logs WHERE entidade_id = v_l2 AND acao='decant_lote_editar';
  PERFORM public.fn_decant_lote_editar(v_l2, 'nova observação', NULL, 'correção de anotação');
  ASSERT (SELECT count(*) FROM public.audit_logs WHERE entidade_id = v_l2 AND acao='decant_lote_editar') = v_aud + 1, 'auditoria';
  v_err := false;
  BEGIN UPDATE public.decant_lote_eventos SET evento='x' WHERE lote_id=v_l2; EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'eventos são imutáveis';

  RAISE NOTICE 'DECANTS FASE 2: TODOS OS TESTES PASSARAM';
END $$;
ROLLBACK;
