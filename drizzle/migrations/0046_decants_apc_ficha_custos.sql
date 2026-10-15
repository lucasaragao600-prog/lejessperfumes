CREATE OR REPLACE FUNCTION public.fn_decant_frasco_ficha(p_frasco_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f public.decant_frascos; v_p public.perfumes; v_u public.unidades; v_ver_custo boolean; v_res jsonb;
  v_granel numeric; v_reserv numeric; v_prod numeric; v_perda numeric; v_vend jsonb; v_ml_sd numeric; v_rec_sd numeric;
  v_apc jsonb; v_rec_apc numeric; v_ml_apc numeric; v_hist jsonb; v_base numeric;
BEGIN
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = p_frasco_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frasco não encontrado'; END IF;
  IF NOT public.fn__pode(v_f.unidade_id,'decant.ver') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_p FROM public.perfumes WHERE id = v_f.produto_id;
  SELECT * INTO v_u FROM public.unidades WHERE id = v_f.unidade_id;
  v_ver_custo := public.fn__decant_ver_custos();
  v_granel := public.fn_decant_saldo_frasco(v_f.id);
  v_reserv := COALESCE(public.fn_decant_reservado_frasco(v_f.id, NULL),0);
  SELECT COALESCE(sum(-ml),0) INTO v_prod FROM public.decant_ml_ledger WHERE frasco_id = v_f.id AND tipo = 'producao';
  SELECT COALESCE(sum(ml),0) INTO v_perda FROM public.decant_perdas WHERE frasco_id = v_f.id;
  SELECT COALESCE(jsonb_object_agg(vol, jsonb_build_object('qtd', q, 'ml', ml, 'receita', rec)), '{}'::jsonb),
         COALESCE(sum(ml),0), COALESCE(sum(rec),0)
    INTO v_vend, v_ml_sd, v_rec_sd
    FROM (SELECT t.volume_ml::text vol, sum(v.quantidade) q, sum(v.ml_consumido) ml, sum(v.total) rec
          FROM public.decant_vendas v JOIN public.decant_skus s ON s.id = v.sku_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
          WHERE v.frasco_id = v_f.id AND v.status = 'concluida' GROUP BY t.volume_ml) x;
  SELECT to_jsonb(a) - 'idempotency_key' INTO v_apc FROM public.decant_apc a WHERE a.frasco_id = v_f.id;
  SELECT COALESCE(sum(preco),0) INTO v_rec_apc FROM public.decant_apc_vendas av JOIN public.decant_apc a ON a.id = av.apc_id
   WHERE a.frasco_id = v_f.id AND av.status = 'concluida';
  v_ml_apc := CASE WHEN v_apc IS NOT NULL AND v_apc->>'status' <> 'cancelado' THEN (v_apc->>'ml_reservado')::numeric ELSE 0 END;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('em', created_at, 'tipo', tipo, 'ml', ml, 'saldo', saldo_apos, 'motivo', motivo, 'por', usuario_nome) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_hist FROM (SELECT * FROM public.decant_ml_ledger WHERE frasco_id = v_f.id ORDER BY created_at DESC LIMIT 50) h;
  v_base := COALESCE(v_f.ml_decants,0) + v_ml_apc;
  v_res := jsonb_build_object(
    'id', v_f.id, 'codigo', v_f.codigo, 'produto_id', v_p.id, 'marca', v_p.marca, 'nome', v_p.nome, 'concentracao', v_p.concentracao,
    'unidade_id', v_u.id, 'unidade_nome', v_u.nome_exibicao, 'volume_nominal_ml', v_f.volume_nominal_ml, 'volume_inicial_ml', v_f.volume_inicial_ml,
    'dividido_em', v_f.dividido_em, 'ml_decants', v_f.ml_decants, 'granel_ml', v_granel, 'reservado_lotes_ml', v_reserv,
    'produzido_ml', v_prod, 'perdas_ml', v_perda, 'vendas_sob_demanda', v_vend, 'vendido_sob_demanda_ml', v_ml_sd,
    'receita_decants', v_rec_sd, 'receita_apc', v_rec_apc, 'receita_total', v_rec_sd + v_rec_apc,
    'apc', v_apc, 'historico', v_hist,
    'custo_incompleto', COALESCE(v_f.custo,0) <= 0);
  IF v_ver_custo THEN
    v_res := v_res || jsonb_build_object('custo_frasco', v_f.custo, 'custo_ml', v_f.custo_ml,
      'custo_rateio_decants', CASE WHEN v_base > 0 THEN round(v_f.custo * COALESCE(v_f.ml_decants,0) / v_base, 2) END,
      'custo_rateio_apc', CASE WHEN v_base > 0 THEN round(v_f.custo * v_ml_apc / v_base, 2) END,
      'custo_consumido_sob_demanda', round(v_ml_sd * v_f.custo_ml, 2));
  END IF;
  RETURN v_res;
END $$;