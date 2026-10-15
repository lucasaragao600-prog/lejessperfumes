ALTER TABLE public.decant_vendas ADD COLUMN IF NOT EXISTS frasco_id uuid REFERENCES public.decant_frascos(id), ADD COLUMN IF NOT EXISTS ml_consumido numeric(10,3);

CREATE TABLE IF NOT EXISTS public.decant_apc_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_venda uuid NOT NULL,
  apc_id uuid NOT NULL REFERENCES public.decant_apc(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  preco numeric(12,2) NOT NULL CHECK (preco > 0),
  custo numeric(12,2),
  ml numeric(10,3) NOT NULL,
  canal text NOT NULL,
  cliente_id uuid, vendedora text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida','cancelada')),
  sessao_caixa_id uuid,
  usuario_id uuid, usuario_nome text NOT NULL DEFAULT '',
  idempotency_key text UNIQUE,
  motivo_cancelamento text, cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS decant_apc_vendas_uma_ativa ON public.decant_apc_vendas(apc_id) WHERE status = 'concluida';
GRANT SELECT ON public.decant_apc_vendas TO authenticated;
GRANT ALL ON public.decant_apc_vendas TO service_role;
ALTER TABLE public.decant_apc_vendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apc vendas leitura" ON public.decant_apc_vendas;
CREATE POLICY "apc vendas leitura" ON public.decant_apc_vendas FOR SELECT TO authenticated USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE OR REPLACE FUNCTION public.fn_decant_pdv_catalogo(p_unidade_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.marca, x.nome, x.volume_ml), '[]'::jsonb) FROM (
    SELECT s.id AS sku_id, s.sku, s.preco_venda, s.produto_id, p.marca, p.nome, p.concentracao, t.volume_ml,
      public.fn_decant_saldo_sku(s.id, p_unidade_id) AS saldo
    FROM public.decant_skus s JOIN public.perfumes p ON p.id = s.produto_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
    WHERE s.ativo AND s.preco_venda > 0 AND public.fn__pode(p_unidade_id,'decant.vender')
      AND (public.has_role(auth.uid(),'master') OR COALESCE((public.fn__decant_cfg()->>'ativo')::boolean,false))
  ) x
$function$;

-- Venda sob demanda a partir de um frasco específico: envase + venda + pagamento + baixa em ml, tudo atômico.
CREATE OR REPLACE FUNCTION public.fn_decant_vender_frasco(p_frasco_id uuid, p_itens jsonb, p_pagamentos jsonb, p_canal text,
  p_cliente_id uuid, p_vendedora text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f public.decant_frascos; v_grupo uuid := gen_random_uuid(); v_sessao uuid; v_it jsonb; v_s public.decant_skus; v_vol numeric;
  v_q integer; v_ml numeric := 0; v_total numeric := 0; v_pag numeric := 0; v_p jsonb; v_saldo numeric; v_res numeric; v_granel numeric;
  v_vid uuid; v_user text := public.fn__nome_usuario(); v_cfg jsonb := public.fn__decant_cfg(); v_mlit numeric;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT grupo_venda INTO v_vid FROM public.decant_vendas WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('grupo_venda', v_vid, 'repetido', true); END IF;
  END IF;
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = p_frasco_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frasco não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_f.unidade_id,'decant.vender');
  IF NOT COALESCE((v_cfg->>'venda_sob_demanda')::boolean,false) THEN RAISE EXCEPTION 'Venda sob demanda está desligada nas configurações de Decants'; END IF;
  IF v_f.status = 'bloqueado' THEN RAISE EXCEPTION 'Frasco bloqueado'; END IF;
  IF COALESCE(p_canal,'') NOT IN ('loja_fisica','site','whatsapp','instagram','marketplace','outro') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
  v_sessao := public.fn__caixa_aberto(v_f.unidade_id);
  IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa desta filial antes de vender'; END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_q := (v_it->>'quantidade')::integer;
    IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO v_s FROM public.decant_skus WHERE id = (v_it->>'sku_id')::uuid AND ativo;
    IF NOT FOUND OR v_s.produto_id <> v_f.produto_id THEN RAISE EXCEPTION 'Tamanho não pertence ao perfume deste frasco'; END IF;
    IF v_s.preco_venda <= 0 THEN RAISE EXCEPTION 'Tamanho % sem preço: venda bloqueada', v_s.sku; END IF;
    SELECT volume_ml INTO v_vol FROM public.decant_tamanhos WHERE id = v_s.tamanho_id;
    v_ml := v_ml + v_vol * v_q;
    v_total := v_total + v_s.preco_venda * v_q;
  END LOOP;
  v_saldo := public.fn_decant_saldo_frasco(v_f.id);
  v_res := COALESCE(public.fn_decant_reservado_frasco(v_f.id, NULL),0);
  v_granel := v_saldo - v_res;
  IF v_ml > v_granel THEN
    RAISE EXCEPTION 'Saldo de decants insuficiente no frasco %: disponível % ml, pedido % ml (a reserva de APC não é usada)', v_f.codigo, v_granel, v_ml; END IF;
  FOR v_p IN SELECT * FROM jsonb_array_elements(COALESCE(p_pagamentos,'[]'::jsonb)) LOOP
    IF COALESCE((v_p->>'valor')::numeric,0) <= 0 THEN RAISE EXCEPTION 'Valor de pagamento inválido'; END IF;
    v_pag := v_pag + (v_p->>'valor')::numeric;
  END LOOP;
  IF round(v_pag,2) <> round(v_total,2) THEN RAISE EXCEPTION 'Pagamentos (R$ %) diferentes do total (R$ %)', round(v_pag,2), round(v_total,2); END IF;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_q := (v_it->>'quantidade')::integer;
    SELECT * INTO v_s FROM public.decant_skus WHERE id = (v_it->>'sku_id')::uuid;
    SELECT volume_ml INTO v_vol FROM public.decant_tamanhos WHERE id = v_s.tamanho_id;
    v_mlit := v_vol * v_q;
    INSERT INTO public.decant_vendas (grupo_venda, unidade_id, sku_id, quantidade, preco_unit, custo_unit, total, canal, status, sessao_caixa_id,
      cliente_id, vendedora, usuario_id, usuario_nome, idempotency_key, frasco_id, ml_consumido)
    VALUES (v_grupo, v_f.unidade_id, v_s.id, v_q, v_s.preco_venda, round(v_vol * v_f.custo_ml, 4), v_s.preco_venda * v_q, p_canal, 'concluida', v_sessao,
      p_cliente_id, COALESCE(p_vendedora,''), auth.uid(), v_user, p_idempotency_key, v_f.id, v_mlit) RETURNING id INTO v_vid;
    v_saldo := v_saldo - v_mlit;
    INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
    VALUES (v_f.id, v_f.unidade_id, 'venda_sob_demanda', -v_mlit, v_saldo, 'Venda sob demanda ' || v_q || '× ' || v_vol || ' ml', 'decant_venda', v_vid, auth.uid(), v_user);
  END LOOP;

  FOR v_p IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO public.decant_venda_pagamentos (grupo_venda, unidade_id, forma, valor) VALUES (v_grupo, v_f.unidade_id, v_p->>'forma', (v_p->>'valor')::numeric);
    IF v_p->>'forma' = 'Dinheiro' THEN
      INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
      VALUES (v_sessao, 'venda_decant', (v_p->>'valor')::numeric, 'Venda de decant ' || left(v_grupo::text, 8), v_user);
    END IF;
  END LOOP;
  PERFORM public.fn_audit('decant_venda_frasco','decant_vendas',v_grupo,v_f.unidade_id,
    jsonb_build_object('frasco', v_f.codigo, 'granel_antes', v_granel),
    jsonb_build_object('total',v_total,'ml',v_ml,'granel_depois',v_granel - v_ml,'itens',p_itens,'pagamentos',p_pagamentos),'');
  RETURN jsonb_build_object('grupo_venda', v_grupo, 'total', v_total, 'ml', v_ml, 'granel_depois', v_granel - v_ml, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_vender_apc(p_apc_id uuid, p_pagamentos jsonb, p_canal text, p_cliente_id uuid, p_vendedora text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_a public.decant_apc; v_f public.decant_frascos; v_grupo uuid := gen_random_uuid(); v_sessao uuid; v_pag numeric := 0; v_p jsonb;
  v_user text := public.fn__nome_usuario(); v_prev uuid; v_vid uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT grupo_venda INTO v_prev FROM public.decant_apc_vendas WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('grupo_venda', v_prev, 'repetido', true); END IF;
  END IF;
  SELECT * INTO v_a FROM public.decant_apc WHERE id = p_apc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APC não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_a.unidade_id,'decant.vender');
  IF v_a.status = 'vendido' THEN RAISE EXCEPTION 'Este APC já foi vendido'; END IF;
  IF v_a.status <> 'disponivel' THEN RAISE EXCEPTION 'APC ainda não está disponível (situação: %)', v_a.status; END IF;
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = v_a.frasco_id FOR UPDATE;
  IF public.fn_decant_saldo_frasco(v_f.id) > 0 THEN RAISE EXCEPTION 'Ainda há líquido de decants dentro do frasco; envase antes de entregar o APC'; END IF;
  IF COALESCE(p_canal,'') NOT IN ('loja_fisica','site','whatsapp','instagram','marketplace','outro') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
  v_sessao := public.fn__caixa_aberto(v_a.unidade_id);
  IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa desta filial antes de vender'; END IF;
  FOR v_p IN SELECT * FROM jsonb_array_elements(COALESCE(p_pagamentos,'[]'::jsonb)) LOOP
    IF COALESCE((v_p->>'valor')::numeric,0) <= 0 THEN RAISE EXCEPTION 'Valor de pagamento inválido'; END IF;
    v_pag := v_pag + (v_p->>'valor')::numeric;
  END LOOP;
  IF round(v_pag,2) <> round(v_a.preco,2) THEN RAISE EXCEPTION 'Pagamentos (R$ %) diferentes do preço do APC (R$ %)', round(v_pag,2), v_a.preco; END IF;

  INSERT INTO public.decant_apc_vendas (grupo_venda, apc_id, unidade_id, preco, custo, ml, canal, cliente_id, vendedora, sessao_caixa_id, usuario_id, usuario_nome, idempotency_key)
  VALUES (v_grupo, v_a.id, v_a.unidade_id, v_a.preco, round(v_a.ml_reservado * v_f.custo_ml, 2), v_a.ml_reservado, p_canal, p_cliente_id,
    COALESCE(p_vendedora,''), v_sessao, auth.uid(), v_user, p_idempotency_key) RETURNING id INTO v_vid;
  UPDATE public.decant_apc SET status = 'vendido', venda_id = v_vid, updated_at = now() WHERE id = v_a.id;
  INSERT INTO public.decant_apc_eventos (apc_id, tipo, antes, depois, usuario_id, usuario_nome)
  VALUES (v_a.id, 'venda', jsonb_build_object('status', v_a.status), jsonb_build_object('status','vendido','grupo',v_grupo,'preco',v_a.preco), auth.uid(), v_user);
  FOR v_p IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO public.decant_venda_pagamentos (grupo_venda, unidade_id, forma, valor) VALUES (v_grupo, v_a.unidade_id, v_p->>'forma', (v_p->>'valor')::numeric);
    IF v_p->>'forma' = 'Dinheiro' THEN
      INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
      VALUES (v_sessao, 'venda_decant', (v_p->>'valor')::numeric, 'Venda de APC ' || left(v_grupo::text, 8), v_user);
    END IF;
  END LOOP;
  PERFORM public.fn_audit('decant_venda_apc','decant_apc',v_a.id,v_a.unidade_id,NULL,
    jsonb_build_object('grupo',v_grupo,'preco',v_a.preco,'ml',v_a.ml_reservado,'pagamentos',p_pagamentos),'');
  RETURN jsonb_build_object('grupo_venda', v_grupo, 'total', v_a.preco, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_apc_venda_cancelar(p_grupo uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_v public.decant_apc_vendas; v_sessao uuid; v_din numeric; v_user text := public.fn__nome_usuario();
BEGIN
  SELECT * INTO v_v FROM public.decant_apc_vendas WHERE grupo_venda = p_grupo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda de APC não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_v.unidade_id,'decant.vender');
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  IF v_v.status = 'cancelada' THEN RETURN jsonb_build_object('repetido', true); END IF;
  UPDATE public.decant_apc_vendas SET status = 'cancelada', cancelada_em = now(), motivo_cancelamento = trim(p_motivo) WHERE id = v_v.id;
  -- volta para "em preparação": exige conferência física antes de ficar disponível de novo
  UPDATE public.decant_apc SET status = 'em_preparacao', venda_id = NULL, updated_at = now() WHERE id = v_v.apc_id;
  INSERT INTO public.decant_apc_eventos (apc_id, tipo, antes, depois, justificativa, usuario_id, usuario_nome)
  VALUES (v_v.apc_id, 'venda_cancelada', jsonb_build_object('status','vendido'), jsonb_build_object('status','em_preparacao'), trim(p_motivo), auth.uid(), v_user);
  SELECT COALESCE(sum(valor),0) INTO v_din FROM public.decant_venda_pagamentos WHERE grupo_venda = p_grupo AND forma = 'Dinheiro';
  IF v_din > 0 THEN
    v_sessao := public.fn__caixa_aberto(v_v.unidade_id);
    IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa para devolver o dinheiro'; END IF;
    INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
    VALUES (v_sessao, 'estorno_decant', v_din, 'Cancelamento de APC ' || left(p_grupo::text, 8), v_user);
  END IF;
  PERFORM public.fn_audit('decant_apc_venda_cancelar','decant_apc_vendas',v_v.id,v_v.unidade_id,NULL,jsonb_build_object('motivo',trim(p_motivo)),'');
  RETURN jsonb_build_object('estorno_dinheiro', v_din, 'repetido', false);
END $$;

REVOKE ALL ON FUNCTION public.fn_decant_vender_frasco(uuid,jsonb,jsonb,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_decant_vender_apc(uuid,jsonb,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_decant_apc_venda_cancelar(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_vender_frasco(uuid,jsonb,jsonb,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decant_vender_apc(uuid,jsonb,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decant_apc_venda_cancelar(uuid,text) TO authenticated;