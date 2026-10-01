-- Testes automatizados da Fase 1 de Decants. Rodam em transação e terminam em ROLLBACK (nada fica gravado).
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/decants_fase1.sql
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub',(SELECT user_id FROM public.user_roles WHERE role='master' ORDER BY created_at LIMIT 1),'role','authenticated')::text, true);

DO $$
DECLARE v_u uuid; v_p uuid; r jsonb; v_fr uuid; v_c uuid; v_err boolean; v_cols int;
BEGIN
  -- custo/ml
  ASSERT public.fn_decant_custo_ml(600,100,100) = 6.000000, 'custo/ml 100ml R$600 deve ser 6,00';
  ASSERT public.fn_decant_custo_ml(600,100,90) = 6.666667, 'custo/ml com rendimento 90% deve ser 6,666667';

  SELECT id INTO v_u FROM public.unidades WHERE status <> 'INATIVA' ORDER BY ordem LIMIT 1;
  INSERT INTO public.perfumes (codigo, nome, marca, casa_sigla, tipo, concentracao, tamanho, volume, custo, preco_venda,
    estoque_casa, estoque_sumauma, estoque_amazonas, estoque_minimo, custo_medio, ncm, cfop, cst_csosn, unidade_fiscal,
    codigo_barras, classificacao, perfil_olfativo, notas_saida, notas_coracao, notas_fundo)
  SELECT 'TESTE-DEC-1','Teste Decant','Teste', sigla,'Teste','EDP','100ml',100,600,900,0,0,0,0,600,'','','','UN',
    'TESTEDEC'||floor(random()*1e9)::text,'','','','','' FROM public.casas LIMIT 1
  RETURNING id INTO v_p;
  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade) VALUES (v_p, v_u, 1);

  -- destinar sem saldo suficiente é bloqueado
  v_err := false;
  BEGIN PERFORM public.fn_decant_destinar(v_p, v_u, 2, 'T', NULL, '', NULL); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'destinar acima do estoque deve falhar';

  r := public.fn_decant_destinar(v_p, v_u, 1, 'T', NULL, '', 'teste-dest-1');
  ASSERT (r->>'saldo_fechados')::int = 1;
  ASSERT (SELECT quantidade FROM public.estoque_unidades WHERE produto_id=v_p AND unidade_id=v_u) = 0, 'estoque normal -1';
  r := public.fn_decant_destinar(v_p, v_u, 1, 'T', NULL, '', 'teste-dest-1');
  ASSERT (r->>'repetido')::boolean, 'reenvio é idempotente';

  -- abrir frasco: FR único e fechado vira aberto (nunca os dois)
  r := public.fn_decant_abrir_frasco(v_p, v_u, '', NULL, NULL, 'T', '', NULL);
  v_fr := (r->>'frasco_id')::uuid;
  ASSERT r->>'codigo' ~ '^FR-\d{6}$', 'código FR no formato';
  ASSERT (SELECT quantidade FROM public.decant_fechados_saldo WHERE produto_id=v_p AND unidade_id=v_u) = 0, 'fechado -1';
  ASSERT (SELECT custo_ml FROM public.decant_frascos WHERE id=v_fr) = 6, 'custo/ml do frasco';
  v_err := false;
  BEGIN PERFORM public.fn_decant_abrir_frasco(v_p, v_u, '', NULL, NULL, 'T', '', NULL); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'sem frasco fechado não abre (não duplica frasco)';

  -- saldo 100 - 60 - 5 - 2 = 33 (60 lançado como perda até a Fase de produção existir)
  PERFORM public.fn_decant_registrar_saida(v_fr,'perda',60,'teste',NULL);
  PERFORM public.fn_decant_registrar_saida(v_fr,'tester',5,'teste',NULL);
  PERFORM public.fn_decant_registrar_saida(v_fr,'uso_interno',2,'teste',NULL);
  ASSERT public.fn_decant_saldo_frasco(v_fr) = 33, 'saldo deve ser 33 ml';

  -- saldo negativo bloqueado
  v_err := false;
  BEGIN PERFORM public.fn_decant_registrar_saida(v_fr,'perda',34,'teste',NULL); EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'consumir mais que o saldo deve falhar';

  -- ledger imutável
  v_err := false;
  BEGIN UPDATE public.decant_ml_ledger SET motivo='x' WHERE frasco_id=v_fr; EXCEPTION WHEN others THEN v_err := true; END;
  ASSERT v_err, 'ledger não pode ser alterado';

  -- conferência 33 -> 30 gera divergência -3 pendente, aprovação gera perda
  r := public.fn_decant_conferir(v_fr, 30, 'evaporação', 'manter_pendente');
  ASSERT r->>'status' = 'pendente' AND (r->>'diferenca')::numeric = -3, 'divergência -3 pendente';
  ASSERT public.fn_decant_saldo_frasco(v_fr) = 33, 'pendente não altera saldo';
  r := public.fn_decant_decidir_conferencia((r->>'conferencia_id')::uuid, true, 'perda', 'ok');
  ASSERT public.fn_decant_saldo_frasco(v_fr) = 30, 'após aprovação saldo 30';

  -- nenhuma coluna removida de tabelas existentes (perfumes ainda tem 30 colunas)
  SELECT count(*) INTO v_cols FROM information_schema.columns WHERE table_schema='public' AND table_name='perfumes';
  ASSERT v_cols >= 30, 'perfumes não perdeu colunas';

  RAISE NOTICE 'DECANTS FASE 1: TODOS OS TESTES PASSARAM';
END $$;
ROLLBACK;
