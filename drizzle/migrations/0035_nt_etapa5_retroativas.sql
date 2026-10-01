-- NT Etapa 5: emissão retroativa, uma origem por vez, só Master, sem mover estoque
ALTER TABLE public.notas_transferencia
  ADD COLUMN IF NOT EXISTS retroativa boolean NOT NULL
  DEFAULT coalesce(nullif(current_setting('lejess.nt_retroativa', true), ''), 'false')::boolean;
COMMENT ON COLUMN public.notas_transferencia.retroativa IS 'Emitida retroativamente para transferência/reposição já finalizada (sem mover estoque)';

CREATE OR REPLACE FUNCTION public.fn_nt_retroativas_pendentes(p_tipo text DEFAULT NULL, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Somente Master'; END IF;
  WITH base AS (
    SELECT 'transferencia'::text AS tipo, t.id, t.numero, ou.nome AS origem_nome, du.nome AS destino_nome, coalesce(t.recebido_em, t.updated_at) AS concluido_em,
      (SELECT count(*) FROM public.transferencia_itens i WHERE i.transferencia_id = t.id) AS itens
    FROM public.transferencias t
    LEFT JOIN public.unidades ou ON ou.id = t.origem_unidade_id LEFT JOIN public.unidades du ON du.id = t.destino_unidade_id
    WHERE t.status = 'RECEBIDO' AND t.origem_unidade_id IS DISTINCT FROM t.destino_unidade_id
      AND NOT EXISTS (SELECT 1 FROM public.notas_transferencia n WHERE n.tipo_origem='transferencia' AND n.origem_id=t.id)
    UNION ALL
    SELECT 'reposicao', r.id, r.codigo, r.origem, r.destino, coalesce(r.finalizado_em, r.updated_at),
      (SELECT count(*) FROM public.reposicao_itens i WHERE i.reposicao_id = r.id)
    FROM public.reposicoes r
    WHERE r.status = 'finalizada' AND r.origem IS DISTINCT FROM r.destino
      AND NOT EXISTS (SELECT 1 FROM public.notas_transferencia n WHERE n.tipo_origem='reposicao' AND n.origem_id=r.id)
  ), f AS (SELECT * FROM base WHERE p_tipo IS NULL OR p_tipo = '' OR tipo = p_tipo)
  SELECT jsonb_build_object('total', (SELECT count(*) FROM f), 'itens', coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.concluido_em DESC) FROM
      (SELECT * FROM f ORDER BY concluido_em DESC LIMIT least(greatest(p_limite,1),100) OFFSET greatest(p_offset,0)) x), '[]'::jsonb)) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.fn_nt_emitir_retroativa(p_tipo text, p_origem_id uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.transferencias; rp public.reposicoes; v_o uuid; v_d uuid; v_itens jsonb; v_rec jsonb; v_id uuid; v_num text; v_sep text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Somente Master pode emitir nota retroativa'; END IF;
  IF length(trim(coalesce(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mínimo 5 caracteres)'; END IF;
  IF NOT coalesce((public.fn__nt_cfg()->>'ativo')::boolean, false) THEN RAISE EXCEPTION 'Ligue as Notas de Transferência nas Configurações primeiro'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('nt-retro:' || p_tipo || ':' || p_origem_id));
  IF EXISTS (SELECT 1 FROM public.notas_transferencia WHERE tipo_origem = p_tipo AND origem_id = p_origem_id) THEN
    RAISE EXCEPTION 'Esta operação já tem nota de transferência';
  END IF;
  IF p_tipo = 'transferencia' THEN
    SELECT * INTO t FROM public.transferencias WHERE id = p_origem_id;
    IF t.id IS NULL OR t.status <> 'RECEBIDO' THEN RAISE EXCEPTION 'Só transferências recebidas podem ter nota retroativa'; END IF;
    v_o := t.origem_unidade_id; v_d := t.destino_unidade_id; v_num := t.numero; v_sep := coalesce(t.separado_por_nome,'');
    SELECT jsonb_agg(jsonb_build_object('tipo_item','produto','referencia_id',i.id,'codigo',coalesce(p.codigo,''),'descricao',i.produto_nome,
      'unidade_medida','un','quantidade',coalesce(i.quantidade_enviada,0),'custo_unitario',coalesce(p.custo_medio,p.custo,0)) ORDER BY i.produto_nome),
      jsonb_agg(jsonb_build_object('referencia_id',i.id,'quantidade',coalesce(i.quantidade_recebida,0)))
      INTO v_itens, v_rec FROM public.transferencia_itens i LEFT JOIN public.perfumes p ON p.id = i.produto_id WHERE i.transferencia_id = t.id;
  ELSIF p_tipo = 'reposicao' THEN
    SELECT * INTO rp FROM public.reposicoes WHERE id = p_origem_id;
    IF rp.id IS NULL OR rp.status <> 'finalizada' THEN RAISE EXCEPTION 'Só reposições finalizadas podem ter nota retroativa'; END IF;
    SELECT o, d INTO v_o, v_d FROM public.fn__reposicao_unidades(rp);
    v_num := rp.codigo; v_sep := coalesce(rp.separado_por_nome,'');
    SELECT jsonb_agg(jsonb_build_object('tipo_item','produto','referencia_id',i.id,'codigo',coalesce(p.codigo,''),'descricao',i.produto_nome,
      'unidade_medida','un','quantidade',coalesce(i.quantidade_enviada,i.quantidade_separada,i.quantidade_solicitada,0),'custo_unitario',coalesce(p.custo_medio,p.custo,0)) ORDER BY i.produto_nome),
      jsonb_agg(jsonb_build_object('referencia_id',i.id,'quantidade',coalesce(i.quantidade_recebida,i.quantidade_enviada,0)))
      INTO v_itens, v_rec FROM public.reposicao_itens i LEFT JOIN public.perfumes p ON p.id = i.produto_id WHERE i.reposicao_id = rp.id;
  ELSE
    RAISE EXCEPTION 'Tipo inválido: use transferencia ou reposicao';
  END IF;
  IF v_itens IS NULL THEN RAISE EXCEPTION 'Operação sem itens'; END IF;
  PERFORM set_config('lejess.nt_retroativa', 'true', true);
  v_id := public.fn__nt_emitir(p_tipo, p_origem_id, v_num, v_o, v_d, v_itens, v_sep, 1, NULL, 'normal', 'Emitida retroativamente: ' || trim(p_motivo));
  PERFORM set_config('lejess.nt_retroativa', '', true);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Nota não emitida (mesma unidade ou módulo desligado)'; END IF;
  PERFORM public.fn__nt_receber(p_tipo, p_origem_id, v_rec);
  PERFORM public.fn_audit('NT_RETROATIVA', 'notas_transferencia', v_id, v_o, NULL,
    jsonb_build_object('tipo_origem', p_tipo, 'origem_id', p_origem_id, 'motivo', trim(p_motivo)));
  RETURN jsonb_build_object('id', v_id, 'numero', (SELECT numero FROM public.notas_transferencia WHERE id = v_id));
END $$;

REVOKE ALL ON FUNCTION public.fn_nt_retroativas_pendentes(text,integer,integer), public.fn_nt_emitir_retroativa(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_nt_retroativas_pendentes(text,integer,integer), public.fn_nt_emitir_retroativa(text,uuid,text) TO authenticated;