-- NT Etapa 4: filtros, cartão por origem, configuração e alerta de recebimento
CREATE OR REPLACE FUNCTION public.fn_nt_filtrar(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg_val boolean := coalesce((public.fn__nt_cfg()->>'mostrar_valores')::boolean, false);
  v_or uuid := nullif(p_filtros->>'origem','')::uuid; v_de uuid := nullif(p_filtros->>'destino','')::uuid;
  v_ini date := nullif(p_filtros->>'de','')::date; v_fim date := nullif(p_filtros->>'ate','')::date;
  v_st text := nullif(p_filtros->>'status',''); v_tp text := nullif(p_filtros->>'tipo_origem','');
  v_bu text := nullif(trim(coalesce(p_filtros->>'busca','')),'');
  v_lim int := least(greatest(coalesce(p_limite,30),1),2000); r jsonb;
BEGIN
  WITH base AS (
    SELECT n.* FROM public.notas_transferencia n
    WHERE (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id))
      AND (v_or IS NULL OR n.origem_unidade_id = v_or) AND (v_de IS NULL OR n.destino_unidade_id = v_de)
      AND (v_st IS NULL OR n.status = v_st) AND (v_tp IS NULL OR n.tipo_origem = v_tp)
      AND (v_ini IS NULL OR (n.emitido_em AT TIME ZONE 'America/Manaus')::date >= v_ini)
      AND (v_fim IS NULL OR (n.emitido_em AT TIME ZONE 'America/Manaus')::date <= v_fim)
      AND (v_bu IS NULL OR n.numero ILIKE '%'||v_bu||'%' OR n.origem_numero ILIKE '%'||v_bu||'%')
  ), pag AS (SELECT * FROM base ORDER BY emitido_em DESC LIMIT v_lim OFFSET greatest(coalesce(p_offset,0),0))
  SELECT jsonb_build_object('total', (SELECT count(*) FROM base), 'itens', coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',b.id,'numero',b.numero,'revisao',b.revisao,'tipo_nota',b.tipo_nota,'tipo_origem',b.tipo_origem,
      'origem_numero',b.origem_numero,'status',b.status,'origem_nome',b.origem_snapshot->>'nome_exibicao','destino_nome',b.destino_snapshot->>'nome_exibicao',
      'emitido_em',b.emitido_em,'emitido_por_nome',b.emitido_por_nome,'recebido_em',b.recebido_em,'recebido_por_nome',b.recebido_por_nome,
      'cnpjs_diferentes',b.cnpjs_diferentes,
      'total_itens',(SELECT count(*) FROM public.notas_transferencia_itens i WHERE i.nota_id=b.id),
      'qtd_enviada',(SELECT coalesce(sum(i.quantidade_enviada),0) FROM public.notas_transferencia_itens i WHERE i.nota_id=b.id AND i.unidade_medida='un'),
      'qtd_recebida',(SELECT sum(i.quantidade_recebida) FROM public.notas_transferencia_itens i WHERE i.nota_id=b.id AND i.unidade_medida='un'),
      'valor_total', CASE WHEN v_cfg_val AND (public.fn__pode(b.origem_unidade_id,'nt.ver_valores') OR public.fn__pode(b.destino_unidade_id,'nt.ver_valores'))
        THEN (SELECT round(sum(coalesce(c.custo_unitario,0)*coalesce(i.quantidade_enviada,0)),2) FROM public.notas_transferencia_itens i
              LEFT JOIN public.notas_transferencia_custos c ON c.item_id=i.id WHERE i.nota_id=b.id) ELSE NULL END
    ) ORDER BY b.emitido_em DESC) FROM pag b), '[]'::jsonb)) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.fn_nt_por_origem(p_tipo_origem text, p_origem_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'numero',n.numero,'revisao',n.revisao,'tipo_nota',n.tipo_nota,'status',n.status,
    'emitido_em',n.emitido_em,'reimpressoes',n.reimpressoes) ORDER BY n.revisao DESC), '[]'::jsonb)
  FROM public.notas_transferencia n
  WHERE n.tipo_origem = p_tipo_origem AND n.origem_id = p_origem_id
    AND (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id));
$$;

CREATE OR REPLACE FUNCTION public.fn_nt_config_salvar(p_cfg jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_atual jsonb := public.fn__nt_cfg(); v_novo jsonb; v_dias int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Somente Master pode alterar a configuração das notas'; END IF;
  v_dias := coalesce(nullif(p_cfg->>'dias_alerta_recebimento','')::int, coalesce((v_atual->>'dias_alerta_recebimento')::int, 3));
  IF v_dias < 1 OR v_dias > 90 THEN RAISE EXCEPTION 'Dias para alerta deve ficar entre 1 e 90'; END IF;
  IF coalesce(p_cfg->>'formato_padrao','a4') NOT IN ('a4','termica') THEN RAISE EXCEPTION 'Formato inválido'; END IF;
  IF coalesce(p_cfg->>'via_padrao','todas') NOT IN ('todas','origem','destino','transporte') THEN RAISE EXCEPTION 'Via inválida'; END IF;
  v_novo := v_atual || jsonb_build_object(
    'ativo', coalesce((p_cfg->>'ativo')::boolean, (v_atual->>'ativo')::boolean, false),
    'mostrar_valores', coalesce((p_cfg->>'mostrar_valores')::boolean, (v_atual->>'mostrar_valores')::boolean, false),
    'nt_mesma_unidade', coalesce((p_cfg->>'nt_mesma_unidade')::boolean, (v_atual->>'nt_mesma_unidade')::boolean, false),
    'via_padrao', coalesce(p_cfg->>'via_padrao', v_atual->>'via_padrao', 'todas'),
    'formato_padrao', coalesce(p_cfg->>'formato_padrao', v_atual->>'formato_padrao', 'a4'),
    'rodape', left(coalesce(p_cfg->>'rodape', v_atual->>'rodape', ''), 300),
    'dias_alerta_recebimento', v_dias);
  INSERT INTO public.configuracoes (chave, valor) VALUES ('notas_transferencia', v_novo)
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
  PERFORM public.fn_audit('NT_CONFIG', 'configuracoes', NULL, NULL, v_atual, v_novo);
  RETURN v_novo;
END $$;

CREATE OR REPLACE FUNCTION public.fn_nt_alertas() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT coalesce((public.fn__nt_cfg()->>'dias_alerta_recebimento')::int, 3) AS dias,
                    coalesce((public.fn__nt_cfg()->>'ativo')::boolean, false) AS ativo)
  SELECT jsonb_build_object('dias', c.dias, 'itens', coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',n.id,'numero',n.numero,'origem_nome',n.origem_snapshot->>'nome_exibicao',
      'destino_nome',n.destino_snapshot->>'nome_exibicao','emitido_em',n.emitido_em,
      'dias', floor(extract(epoch FROM now()-n.emitido_em)/86400)::int) ORDER BY n.emitido_em)
    FROM public.notas_transferencia n
    WHERE c.ativo AND n.status = 'EMITIDA' AND n.emitido_em < now() - make_interval(days => c.dias)
      AND (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id))), '[]'::jsonb))
  FROM c;
$$;

REVOKE ALL ON FUNCTION public.fn_nt_filtrar(jsonb,integer,integer), public.fn_nt_por_origem(text,uuid), public.fn_nt_config_salvar(jsonb), public.fn_nt_alertas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_nt_filtrar(jsonb,integer,integer), public.fn_nt_por_origem(text,uuid), public.fn_nt_config_salvar(jsonb), public.fn_nt_alertas() TO authenticated;