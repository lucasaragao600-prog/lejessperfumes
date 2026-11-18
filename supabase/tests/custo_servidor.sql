-- Fase B: custo escondido no servidor + Vendedor Líder (rollback no fim)
BEGIN;
DO $$
DECLARE v_vend uuid; v_master uuid; n int; j jsonb; ok boolean;
BEGIN
  SELECT user_id INTO v_vend FROM user_roles WHERE role='vendedor' LIMIT 1;
  SELECT user_id INTO v_master FROM user_roles WHERE role='master' LIMIT 1;
  -- Vendedor
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_vend,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF fn__ver_custos() THEN RAISE EXCEPTION 'FALHA: vendedor vê custo'; END IF;
  SELECT count(*) INTO n FROM fn_produtos_custos(); IF n>0 THEN RAISE EXCEPTION 'FALHA: fn_produtos_custos vazou'; END IF;
  SELECT count(*) INTO n FROM produto_custos; IF n>0 THEN RAISE EXCEPTION 'FALHA: produto_custos vazou'; END IF;
  SELECT count(*) INTO n FROM notas_fiscais_itens; IF n>0 THEN RAISE EXCEPTION 'FALHA: itens NF vazaram'; END IF;
  j := fn_estoque_listar('{}'::jsonb, 5, 0);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(j->'itens') e WHERE e ? 'custo' OR e ? 'custo_medio') THEN RAISE EXCEPTION 'FALHA: estoque_listar vazou custo'; END IF;
  IF (fn_estoque_resumo('{}'::jsonb)->>'custo') IS NOT NULL THEN RAISE EXCEPTION 'FALHA: resumo vazou custo'; END IF;
  BEGIN PERFORM custo FROM perfumes LIMIT 1; RAISE EXCEPTION 'FALHA: coluna custo legível';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  -- Master
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_master,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT fn__ver_custos() THEN RAISE EXCEPTION 'FALHA: master sem custo'; END IF;
  SELECT count(*) INTO n FROM fn_produtos_custos(); IF n=0 THEN RAISE EXCEPTION 'FALHA: master sem custos'; END IF;
  IF (fn_estoque_resumo('{}'::jsonb)->>'custo') IS NULL THEN RAISE EXCEPTION 'FALHA: master sem valor a custo'; END IF;
  RESET ROLE;
  SELECT count(*) INTO n FROM role_permissions WHERE role='vendedor_lider';
  IF n < 20 OR EXISTS (SELECT 1 FROM role_permissions WHERE role='vendedor_lider' AND permission='custo.ver') THEN RAISE EXCEPTION 'FALHA: padrão do líder'; END IF;
  RAISE NOTICE 'PASS custo_servidor (lider=% permissões)', n;
END $$;
ROLLBACK;
