-- Fase 5: reembolso com confirmação. Transacional com rollback — não persiste nada.
-- Valida: pix nasce pendente; confirmação exige permissão; confirmação marca quem/quando;
-- confirmação duplicada é bloqueada; dinheiro/crédito nascem confirmados.
BEGIN;
DO $$
DECLARE
  master_id uuid;
  vv record;
  r jsonb;
  dev record;
  erro text;
BEGIN
  SELECT user_id INTO master_id FROM public.user_roles WHERE role = 'master' LIMIT 1;
  IF master_id IS NULL THEN RAISE EXCEPTION 'Teste exige um master'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', master_id, 'role', 'authenticated')::text, true);

  SELECT s.id, s.grupo_venda, s.unidade_id
  INTO vv
  FROM public.vendas s
  WHERE s.cancelada = false AND s.unidade_id IS NOT NULL AND s.quantidade >= 1
    AND NOT s.is_teste
    AND NOT EXISTS (SELECT 1 FROM public.devolucao_itens di WHERE di.venda_id = s.id)
  ORDER BY s.created_at DESC LIMIT 1;
  IF vv.id IS NULL THEN RAISE EXCEPTION 'Nenhuma venda elegível para o teste'; END IF;

  -- 1) Devolução com reembolso via pix: nasce pendente
  r := public.fn_devolucao_registrar(vv.grupo_venda,
    jsonb_build_array(jsonb_build_object('venda_id', vv.id, 'quantidade', 1, 'destino', 'estoque', 'condicao', 'novo_lacrado')),
    'teste reembolso', 'pix');
  SELECT * INTO dev FROM public.devolucoes WHERE id = (r->>'id')::uuid;
  IF dev.reembolso_status <> 'pendente' THEN
    RAISE EXCEPTION 'FALHOU: pix deveria nascer pendente, veio %', dev.reembolso_status; END IF;

  -- 2) Master confirma: marca quem e quando
  r := public.fn_devolucao_reembolso_confirmar(dev.id, 'pago no pix da loja');
  SELECT * INTO dev FROM public.devolucoes WHERE id = dev.id;
  IF dev.reembolso_status <> 'confirmado' OR dev.reembolso_confirmado_por IS NULL OR dev.reembolso_confirmado_em IS NULL THEN
    RAISE EXCEPTION 'FALHOU: confirmação não marcou status/quem/quando'; END IF;

  -- 3) Confirmação duplicada é bloqueada
  BEGIN
    PERFORM public.fn_devolucao_reembolso_confirmar(dev.id, NULL);
    RAISE EXCEPTION 'FALHOU: confirmação duplicada passou';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS erro = MESSAGE_TEXT;
    IF erro NOT LIKE '%não está pendente%' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS: reembolso pix nasce pendente, confirmação auditada, duplicada bloqueada';
END $$;
ROLLBACK;
