-- Fase 6: troca entre unidades. Transacional com rollback — não persiste nada.
-- Valida: busca entre lojas; devolução marcada com as duas unidades; item devolvido entra
-- na loja da troca (não na de origem); item novo sai da loja da troca; venda Vale-Troca na
-- loja da troca; troca na mesma unidade é recusada.
BEGIN;
DO $$
DECLARE
  master_id uuid; vv record; u_op record; prod_novo record; r jsonb; dev record;
  estoque_antes int; estoque_depois int; estoque_origem_antes int; estoque_origem_depois int;
  novo_antes int; novo_depois int; erro text;
BEGIN
  SELECT user_id INTO master_id FROM public.user_roles WHERE role = 'master' LIMIT 1;
  IF master_id IS NULL THEN RAISE EXCEPTION 'Teste exige um master'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', master_id, 'role', 'authenticated')::text, true);

  -- Venda elegível na unidade de origem
  SELECT s.id, s.grupo_venda, s.unidade_id, s.perfume_id
  INTO vv
  FROM public.vendas s
  WHERE s.cancelada = false AND s.unidade_id IS NOT NULL AND s.quantidade >= 1
    AND NOT s.is_teste
    AND NOT EXISTS (SELECT 1 FROM public.devolucao_itens di WHERE di.venda_id = s.id)
  ORDER BY s.created_at DESC LIMIT 1;
  IF vv.id IS NULL THEN RAISE EXCEPTION 'Nenhuma venda elegível para o teste'; END IF;

  -- Unidade de operação: outra unidade operacional que permite venda
  SELECT * INTO u_op FROM public.unidades
  WHERE id <> vv.unidade_id AND status = 'OPERACIONAL' AND permite_venda
  ORDER BY ordem LIMIT 1;
  IF u_op.id IS NULL THEN RAISE EXCEPTION 'Teste exige uma segunda unidade operacional'; END IF;

  -- Produto novo com estoque disponível na unidade de operação
  SELECT eu.produto_id, eu.quantidade INTO prod_novo
  FROM public.estoque_unidades eu
  WHERE eu.unidade_id = u_op.id AND eu.quantidade - eu.quantidade_reservada >= 1
  ORDER BY eu.quantidade DESC LIMIT 1;
  IF prod_novo.produto_id IS NULL THEN RAISE EXCEPTION 'Sem produto com estoque na unidade de operação'; END IF;

  SELECT COALESCE(sum(quantidade),0) INTO estoque_antes FROM public.estoque_unidades WHERE produto_id = vv.perfume_id AND unidade_id = u_op.id;
  SELECT COALESCE(sum(quantidade),0) INTO estoque_origem_antes FROM public.estoque_unidades WHERE produto_id = vv.perfume_id AND unidade_id = vv.unidade_id;
  novo_antes := prod_novo.quantidade;

  -- 1) Busca em todas as unidades enxerga a venda de outra loja
  IF NOT EXISTS (SELECT 1 FROM public.fn_venda_buscar_troca(u_op.id, vv.grupo_venda::text, 5) t WHERE t.grupo_venda = vv.grupo_venda) THEN
    RAISE EXCEPTION 'FALHOU: busca entre unidades não encontrou a venda'; END IF;

  -- 2) Troca entre unidades
  r := public.fn_troca_registrar_unidade(vv.grupo_venda, u_op.id,
    jsonb_build_array(jsonb_build_object('venda_id', vv.id, 'quantidade', 1, 'destino', 'estoque', 'condicao', 'novo_lacrado')),
    jsonb_build_array(jsonb_build_object('produto_id', prod_novo.produto_id, 'quantidade', 1)),
    'teste troca entre unidades', '[]'::jsonb, 'pix');

  SELECT * INTO dev FROM public.devolucoes WHERE id = (r->>'id')::uuid;
  IF NOT dev.troca_entre_unidades OR dev.unidade_id <> u_op.id OR dev.unidade_origem_id <> vv.unidade_id THEN
    RAISE EXCEPTION 'FALHOU: devolução não marcou as unidades corretamente'; END IF;

  -- 3) Item devolvido entrou na loja da troca, e NÃO na loja de origem
  SELECT COALESCE(sum(quantidade),0) INTO estoque_depois FROM public.estoque_unidades WHERE produto_id = vv.perfume_id AND unidade_id = u_op.id;
  SELECT COALESCE(sum(quantidade),0) INTO estoque_origem_depois FROM public.estoque_unidades WHERE produto_id = vv.perfume_id AND unidade_id = vv.unidade_id;
  IF estoque_depois <> estoque_antes + 1 THEN
    RAISE EXCEPTION 'FALHOU: devolvido não entrou na unidade de operação (% -> %)', estoque_antes, estoque_depois; END IF;
  IF estoque_origem_depois <> estoque_origem_antes THEN
    RAISE EXCEPTION 'FALHOU: estoque da unidade de origem mudou (% -> %)', estoque_origem_antes, estoque_origem_depois; END IF;

  -- 4) Produto novo saiu da loja da troca
  SELECT quantidade INTO novo_depois FROM public.estoque_unidades WHERE produto_id = prod_novo.produto_id AND unidade_id = u_op.id;
  IF novo_depois <> novo_antes - 1 THEN
    RAISE EXCEPTION 'FALHOU: novo item não saiu da unidade de operação (% -> %)', novo_antes, novo_depois; END IF;

  -- 5) Venda da troca registrada na loja da troca
  IF NOT EXISTS (SELECT 1 FROM public.vendas WHERE grupo_venda = (r->>'grupo_venda_troca')::uuid AND unidade_id = u_op.id AND tipo_pagamento = 'Vale-Troca') THEN
    RAISE EXCEPTION 'FALHOU: venda da troca não registrada na unidade de operação'; END IF;

  -- 6) Troca na mesma unidade é recusada
  BEGIN
    PERFORM public.fn_troca_registrar_unidade(vv.grupo_venda, vv.unidade_id,
      jsonb_build_array(jsonb_build_object('venda_id', vv.id, 'quantidade', 1)),
      jsonb_build_array(jsonb_build_object('produto_id', prod_novo.produto_id, 'quantidade', 1)),
      'teste mesma unidade');
    RAISE EXCEPTION 'FALHOU: troca na mesma unidade passou';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
    IF erro NOT LIKE '%mesma unidade%' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS: troca entre unidades atômica, estoques corretos, mesma unidade recusada';
END $$;
ROLLBACK;
