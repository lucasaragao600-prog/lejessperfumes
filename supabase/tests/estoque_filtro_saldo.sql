-- Read-only regression against the reported product, with transaction-local auth.
-- Run against the database with an administrative test connection.
BEGIN;
DO $$
DECLARE
  master_id uuid;
  loja text;
  resultado jsonb;
  resumo jsonb;
  unidade record;
  faltantes integer;
BEGIN
  SELECT user_id INTO master_id FROM public.user_roles WHERE role = 'master' LIMIT 1;
  IF master_id IS NULL THEN RAISE EXCEPTION 'Regression requires a master'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', master_id, 'role', 'authenticated')::text, true);
  -- All units: every positive balance must survive the shared unit filter.
  FOR unidade IN SELECT id, coalesce(nullif(codigo_legado, ''), codigo) AS chave FROM public.unidades LOOP
    SELECT count(*) INTO faltantes
    FROM public.estoque_unidades e
    WHERE e.unidade_id = unidade.id AND e.quantidade > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.fn__estoque_filtrado(jsonb_build_object('unidade', unidade.chave)) f
        WHERE f.produto_id = e.produto_id AND f.qtd = e.quantidade
      );
    IF faltantes > 0 THEN
      RAISE EXCEPTION 'Unit % hides % positive balances', unidade.chave, faltantes;
    END IF;
  END LOOP;
  SELECT coalesce(nullif(u.codigo_legado, ''), u.codigo) INTO loja
  FROM public.unidades u JOIN public.estoque_unidades e ON e.unidade_id = u.id
  JOIN public.perfumes p ON p.id = e.produto_id
  WHERE p.nome ILIKE 'amazonica' AND e.quantidade = 5 LIMIT 1;
  IF loja IS NULL THEN RAISE EXCEPTION 'Reported Amazonica fixture with 5 units not found'; END IF;
  resultado := public.fn_estoque_listar(jsonb_build_object('busca', 'amazonica', 'unidade', loja), 30, 0);
  IF (resultado->>'total')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Amazonica must remain visible in its unit: %', resultado;
  END IF;
  IF (resultado->'itens'->0->>'qtd')::int IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Amazonica unit balance must be 5: %', resultado;
  END IF;
  resumo := public.fn_estoque_resumo(jsonb_build_object('busca', 'amazonica', 'unidade', loja));
  IF (resumo->>'unidades')::int IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Stock summary must reconcile to 5 units: %', resumo;
  END IF;
END $$;
ROLLBACK;