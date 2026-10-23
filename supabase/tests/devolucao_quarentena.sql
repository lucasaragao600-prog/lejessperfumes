-- Fase 2: condição física + quarentena. Transacional com rollback — não persiste nada.
-- Valida: avaria vai para quarentena sem voltar ao estoque; decisão "reintegrar" devolve ao estoque;
-- decisão duplicada é bloqueada; condição inválida é rejeitada.
BEGIN;
DO $$
DECLARE
  master_id uuid;
  vv record;
  saldo_antes int;
  saldo_depois int;
  r jsonb;
  q record;
  erro text;
BEGIN
  SELECT user_id INTO master_id FROM public.user_roles WHERE role = 'master' LIMIT 1;
  IF master_id IS NULL THEN RAISE EXCEPTION 'Teste exige um master'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', master_id, 'role', 'authenticated')::text, true);

  -- Venda real recente com quantidade disponível para devolver
  SELECT s.id, s.grupo_venda, s.perfume_id, s.unidade_id, s.quantidade
  INTO vv
  FROM public.vendas s
  WHERE s.cancelada = false AND s.unidade_id IS NOT NULL AND s.quantidade >= 1
    AND NOT s.is_teste
    AND NOT EXISTS (SELECT 1 FROM public.devolucao_itens di WHERE di.venda_id = s.id)
  ORDER BY s.created_at DESC LIMIT 1;
  IF vv.id IS NULL THEN RAISE EXCEPTION 'Nenhuma venda elegível para o teste'; END IF;

  SELECT quantidade INTO saldo_antes FROM public.estoque_unidades
  WHERE produto_id = vv.perfume_id AND unidade_id = vv.unidade_id;
  saldo_antes := COALESCE(saldo_antes, 0);

  -- 1) Devolução com condição avariado: não volta ao estoque, entra na quarentena
  r := public.fn_devolucao_registrar(vv.grupo_venda,
    jsonb_build_array(jsonb_build_object('venda_id', vv.id, 'quantidade', 1, 'destino', 'estoque', 'condicao', 'avariado')),
    'teste quarentena', 'pix');

  SELECT quantidade INTO saldo_depois FROM public.estoque_unidades
  WHERE produto_id = vv.perfume_id AND unidade_id = vv.unidade_id;
  IF COALESCE(saldo_depois, 0) <> saldo_antes THEN
    RAISE EXCEPTION 'Avaria não deveria voltar ao estoque (antes %, depois %)', saldo_antes, saldo_depois;
  END IF;

  SELECT * INTO q FROM public.devolucao_quarentena
  WHERE devolucao_id = (r->>'id')::uuid AND status = 'pendente';
  IF q.id IS NULL THEN RAISE EXCEPTION 'Item avariado não entrou na quarentena'; END IF;
  IF q.condicao <> 'avariado' OR q.quantidade <> 1 THEN
    RAISE EXCEPTION 'Quarentena com condição/quantidade erradas: % / %', q.condicao, q.quantidade;
  END IF;

  -- 2) Decisão "reintegrar" devolve ao estoque
  PERFORM public.fn_devolucao_quarentena_decidir(q.id, 'reintegrar', 'teste');
  SELECT quantidade INTO saldo_depois FROM public.estoque_unidades
  WHERE produto_id = vv.perfume_id AND unidade_id = vv.unidade_id;
  IF COALESCE(saldo_depois, 0) <> saldo_antes + 1 THEN
    RAISE EXCEPTION 'Reintegração não devolveu ao estoque (esperado %, obtido %)', saldo_antes + 1, saldo_depois;
  END IF;

  -- 3) Segunda decisão no mesmo item é bloqueada
  BEGIN
    PERFORM public.fn_devolucao_quarentena_decidir(q.id, 'perda', 'duplicada');
    RAISE EXCEPTION 'Decisão duplicada deveria falhar';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
    IF erro NOT LIKE '%já foi decidido%' AND erro NOT LIKE '%duplicada deveria falhar%' THEN RAISE; END IF;
    IF erro LIKE '%duplicada deveria falhar%' THEN RAISE EXCEPTION 'Decisão duplicada foi aceita'; END IF;
  END;

  -- 4) Condição inválida é rejeitada
  BEGIN
    PERFORM public.fn_devolucao_registrar(vv.grupo_venda,
      jsonb_build_array(jsonb_build_object('venda_id', vv.id, 'quantidade', 1, 'destino', 'estoque', 'condicao', 'molhado')),
      'teste condicao invalida', 'pix');
    RAISE EXCEPTION 'Condição inválida foi aceita';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
    IF erro NOT LIKE '%Condição inválida%' AND erro NOT LIKE '%foi aceita%' THEN RAISE; END IF;
    IF erro LIKE '%foi aceita%' THEN RAISE EXCEPTION 'Condição inválida passou'; END IF;
  END;

  RAISE NOTICE 'OK: quarentena, reintegração, bloqueio de duplicidade e validação de condição';
END $$;
ROLLBACK;
