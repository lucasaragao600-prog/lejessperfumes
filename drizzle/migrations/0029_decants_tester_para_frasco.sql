-- Permite usar um tester já aberto como frasco de decant. Aditiva.
ALTER TABLE public.decant_frascos ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'fechado';
ALTER TABLE public.decant_frascos ADD COLUMN IF NOT EXISTS tester_id uuid;

CREATE OR REPLACE FUNCTION public.fn_decant_tester_para_frasco(p_tester_id uuid, p_volume_atual numeric, p_responsavel text,
  p_observacao text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.testers; v_u public.unidades; v_p public.perfumes; v_prev public.decant_frascos; v_rend numeric; v_custo numeric;
  v_codigo text; v_id uuid; v_user text := public.fn__nome_usuario();
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.decant_frascos WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('frasco_id', v_prev.id, 'codigo', v_prev.codigo, 'repetido', true); END IF;
  END IF;
  SELECT * INTO v_t FROM public.testers WHERE id = p_tester_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tester não encontrado'; END IF;
  SELECT * INTO v_u FROM public.fn_unidade_por_texto(v_t.deposito);
  IF v_u.id IS NULL THEN RAISE EXCEPTION 'Filial do tester não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_u.id,'decant.abrir');
  IF COALESCE(v_t.quantidade,0) < 1 THEN RAISE EXCEPTION 'Não há tester disponível deste perfume nesta filial'; END IF;
  SELECT * INTO v_p FROM public.perfumes WHERE id = v_t.perfume_id;
  IF COALESCE(v_p.volume,0) <= 0 THEN RAISE EXCEPTION 'Perfume sem volume cadastrado'; END IF;
  IF p_volume_atual IS NULL OR p_volume_atual <= 0 OR p_volume_atual > v_p.volume THEN
    RAISE EXCEPTION 'Informe quantos ml restam no tester (máximo % ml)', v_p.volume; END IF;
  SELECT rendimento_util INTO v_rend FROM public.decant_perfume_config WHERE produto_id = v_p.id;
  v_rend := COALESCE(v_rend, (public.fn__decant_cfg()->>'rendimento_padrao')::numeric, 100);
  v_custo := COALESCE(NULLIF(v_t.custo,0), NULLIF(v_p.custo_medio,0), v_p.custo, 0);

  UPDATE public.testers SET quantidade = quantidade - 1 WHERE id = v_t.id;

  v_codigo := 'FR-' || lpad(nextval('public.decant_frasco_seq')::text, 6, '0');
  INSERT INTO public.decant_frascos (codigo, produto_id, unidade_id, volume_nominal_ml, volume_inicial_ml, custo, rendimento_util,
    custo_ml, responsavel, aberto_por, aberto_por_nome, observacao, idempotency_key, origem, tester_id)
  VALUES (v_codigo, v_p.id, v_u.id, v_p.volume, p_volume_atual, v_custo, v_rend,
    public.fn_decant_custo_ml(v_custo, v_p.volume, v_rend), COALESCE(p_responsavel,''), auth.uid(), v_user,
    trim('Veio de tester. ' || COALESCE(p_observacao,'')), p_idempotency_key, 'tester', v_t.id)
  RETURNING id INTO v_id;

  INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, usuario_id, usuario_nome)
  VALUES (v_id, v_u.id, 'abertura', p_volume_atual, p_volume_atual, 'Tester transformado em frasco de decant', auth.uid(), v_user);

  PERFORM public.fn_audit('decant_tester_para_frasco','decant_frascos',v_id,v_u.id,
    jsonb_build_object('tester_id', v_t.id, 'testers_antes', v_t.quantidade),
    jsonb_build_object('codigo',v_codigo,'ml',p_volume_atual,'custo',v_custo,'testers_depois', v_t.quantidade - 1),'');
  RETURN jsonb_build_object('frasco_id', v_id, 'codigo', v_codigo, 'repetido', false);
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_decant_tester_para_frasco(uuid,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_tester_para_frasco(uuid,numeric,text,text,text) TO authenticated;