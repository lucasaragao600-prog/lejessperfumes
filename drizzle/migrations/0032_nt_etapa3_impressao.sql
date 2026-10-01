CREATE OR REPLACE FUNCTION public.fn_nt_detalhe(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notas_transferencia; v_valores boolean; v_cega boolean; v_transp text := ''; v_obs text := '';
BEGIN
  SELECT * INTO n FROM public.notas_transferencia WHERE id = p_id;
  IF n.id IS NULL OR NOT (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id)) THEN
    RAISE EXCEPTION 'Nota não encontrada';
  END IF;
  v_valores := coalesce((public.fn__nt_cfg()->>'mostrar_valores')::boolean, false)
    AND (public.fn__pode(n.origem_unidade_id, 'nt.ver_valores') OR public.fn__pode(n.destino_unidade_id, 'nt.ver_valores'));
  v_cega := n.tipo_origem = 'reposicao' AND n.status = 'EMITIDA'
    AND NOT public.has_role(auth.uid(), 'master')
    AND NOT public.has_permission(auth.uid(), 'reposicao_ver_itens_esperados')
    AND NOT public.usuario_tem_acesso_unidade(n.origem_unidade_id);
  IF n.tipo_origem = 'transferencia' THEN
    SELECT coalesce(transportador,''), coalesce(observacao,'') INTO v_transp, v_obs FROM public.transferencias WHERE id = n.origem_id;
  ELSIF n.tipo_origem = 'decant' THEN
    SELECT coalesce(transportador,''), coalesce(observacao,'') INTO v_transp, v_obs FROM public.decant_transferencias WHERE id = n.origem_id;
  ELSIF n.tipo_origem = 'reposicao' THEN
    SELECT '', coalesce(observacoes,'') INTO v_transp, v_obs FROM public.reposicoes WHERE id = n.origem_id;
  END IF;
  RETURN jsonb_build_object(
    'id',n.id,'numero',n.numero,'codigo_publico',n.codigo_publico,'revisao',n.revisao,'tipo_nota',n.tipo_nota,'motivo_revisao',n.motivo_revisao,
    'nt_original_numero',(SELECT numero FROM public.notas_transferencia WHERE id = n.nt_original_id),
    'tipo_origem',n.tipo_origem,'origem_numero',n.origem_numero,'status',n.status,
    'origem',n.origem_snapshot,'destino',n.destino_snapshot,'cnpjs_diferentes',n.cnpjs_diferentes,
    'separado_por_nome',n.separado_por_nome,'emitido_por_nome',n.emitido_por_nome,'emitido_em',n.emitido_em,
    'recebido_por_nome',n.recebido_por_nome,'recebido_em',n.recebido_em,
    'cancelado_por_nome',n.cancelado_por_nome,'cancelado_em',n.cancelado_em,'cancelado_motivo',n.cancelado_motivo,
    'transportador',coalesce(v_transp,''),'observacao',coalesce(v_obs,''),
    'reimpressoes',n.reimpressoes,'mostrar_valores',v_valores,'conferencia_cega',v_cega,
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'tipo_item',i.tipo_item,'codigo',i.codigo,'descricao',i.descricao,
       'unidade_medida',i.unidade_medida,
       'quantidade_enviada', CASE WHEN v_cega THEN NULL ELSE i.quantidade_enviada END,
       'quantidade_recebida', i.quantidade_recebida,
       'custo_unitario', CASE WHEN v_valores THEN c.custo_unitario ELSE NULL END) ORDER BY i.ordem)
     FROM public.notas_transferencia_itens i LEFT JOIN public.notas_transferencia_custos c ON c.item_id = i.id WHERE i.nota_id = n.id), '[]'::jsonb));
END $$;

-- detalhe pelo código do QR (logado, mesmas regras de acesso)
CREATE OR REPLACE FUNCTION public.fn_nt_detalhe_por_codigo(p_codigo text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.notas_transferencia WHERE codigo_publico = p_codigo;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.fn_nt_detalhe(v_id);
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- registro de impressão (via: origem/destino/transporte; formato: a4/termica). Retorna o nº da impressão.
CREATE OR REPLACE FUNCTION public.fn_nt_registrar_impressao(p_id uuid, p_via text DEFAULT 'origem', p_formato text DEFAULT 'a4') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notas_transferencia; v_c integer;
BEGIN
  IF p_via NOT IN ('origem','destino','transporte') OR p_formato NOT IN ('a4','termica') THEN RAISE EXCEPTION 'Via ou formato inválido'; END IF;
  SELECT * INTO n FROM public.notas_transferencia WHERE id = p_id FOR UPDATE;
  IF n.id IS NULL OR NOT (public.fn__pode(n.origem_unidade_id,'nt.reimprimir') OR public.fn__pode(n.destino_unidade_id,'nt.reimprimir')
     OR public.fn__pode(n.origem_unidade_id,'nt.ver') OR public.fn__pode(n.destino_unidade_id,'nt.ver')) THEN
    RAISE EXCEPTION 'Sem permissão para imprimir esta nota';
  END IF;
  IF n.reimpressoes > 0 AND NOT (public.fn__pode(n.origem_unidade_id,'nt.reimprimir') OR public.fn__pode(n.destino_unidade_id,'nt.reimprimir')) THEN
    RAISE EXCEPTION 'Sem permissão para reimprimir esta nota';
  END IF;
  UPDATE public.notas_transferencia SET reimpressoes = reimpressoes + 1, ultima_reimpressao_em = now(),
    ultima_reimpressao_por = coalesce(public.fn__nome_usuario(),'') WHERE id = p_id RETURNING reimpressoes INTO v_c;
  PERFORM public.fn_audit('NT_IMPRESSA', 'notas_transferencia', p_id, n.origem_unidade_id, NULL,
    jsonb_build_object('impressao', v_c, 'via', p_via, 'formato', p_formato));
  RETURN v_c;
END $$;

REVOKE ALL ON FUNCTION public.fn_nt_detalhe_por_codigo(text), public.fn_nt_registrar_impressao(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_nt_detalhe_por_codigo(text), public.fn_nt_registrar_impressao(uuid,text,text) TO authenticated;