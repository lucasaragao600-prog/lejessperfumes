-- ===== Transferências: NT por gatilho na mesma transação das RPCs =====
CREATE OR REPLACE FUNCTION public.fn__nt_trg_transferencia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_itens jsonb; v_nt public.notas_transferencia; v_muda boolean; v_rec jsonb;
BEGIN
  IF NEW.status = 'EM_TRANSITO' THEN
    SELECT jsonb_agg(jsonb_build_object('tipo_item','produto','referencia_id',i.id,'codigo',coalesce(p.codigo,''),
      'descricao',i.produto_nome,'unidade_medida','un','quantidade',coalesce(i.quantidade_enviada,0),
      'custo_unitario',coalesce(p.custo_medio,p.custo,0)) ORDER BY i.produto_nome)
      INTO v_itens FROM public.transferencia_itens i LEFT JOIN public.perfumes p ON p.id = i.produto_id
     WHERE i.transferencia_id = NEW.id;
    PERFORM public.fn__nt_emitir('transferencia', NEW.id, NEW.numero, NEW.origem_unidade_id, NEW.destino_unidade_id,
      v_itens, coalesce(NEW.separado_por_nome,''));
  ELSIF NEW.status IN ('AGUARDANDO_TRATAMENTO','RECEBIDO') THEN
    SELECT * INTO v_nt FROM public.notas_transferencia WHERE tipo_origem='transferencia' AND origem_id=NEW.id
      AND status NOT IN ('CANCELADA','SUBSTITUIDA') ORDER BY revisao DESC LIMIT 1;
    IF v_nt.id IS NULL THEN RETURN NEW; END IF;
    SELECT EXISTS (SELECT 1 FROM public.transferencia_itens i JOIN public.notas_transferencia_itens n
      ON n.nota_id = v_nt.id AND n.referencia_id = i.id WHERE coalesce(i.quantidade_enviada,0) <> n.quantidade_enviada) INTO v_muda;
    IF v_muda THEN
      SELECT jsonb_agg(jsonb_build_object('tipo_item','produto','referencia_id',i.id,'codigo',coalesce(p.codigo,''),
        'descricao',i.produto_nome,'unidade_medida','un','quantidade',coalesce(i.quantidade_enviada,0),
        'custo_unitario',coalesce(p.custo_medio,p.custo,0)) ORDER BY i.produto_nome)
        INTO v_itens FROM public.transferencia_itens i LEFT JOIN public.perfumes p ON p.id = i.produto_id WHERE i.transferencia_id = NEW.id;
      PERFORM public.fn__nt_emitir('transferencia', NEW.id, NEW.numero, NEW.origem_unidade_id, NEW.destino_unidade_id,
        v_itens, coalesce(NEW.separado_por_nome,''), v_nt.revisao + 1, v_nt.id, 'retificadora', 'Correção de expedição na divergência');
    END IF;
    SELECT jsonb_agg(jsonb_build_object('referencia_id', id, 'quantidade', coalesce(quantidade_recebida,0)))
      INTO v_rec FROM public.transferencia_itens WHERE transferencia_id = NEW.id;
    PERFORM public.fn__nt_receber('transferencia', NEW.id, v_rec);
  ELSIF NEW.status = 'CANCELADA' THEN
    PERFORM public.fn__nt_cancelar('transferencia', NEW.id, coalesce(NEW.cancelado_motivo,''));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nt_transferencia ON public.transferencias;
CREATE TRIGGER trg_nt_transferencia AFTER UPDATE OF status ON public.transferencias
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.fn__nt_trg_transferencia();

-- ===== Decants =====
CREATE OR REPLACE FUNCTION public.fn__nt_decant_itens(p_id uuid, p_recebido boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_agg(CASE
    WHEN i.tipo = 'frasco' THEN jsonb_build_object('tipo_item','frasco','referencia_id',i.id,'codigo',coalesce(f.codigo,''),
      'descricao','Frasco aberto ' || coalesce(pf.nome,''),'unidade_medida','ml',
      'quantidade', CASE WHEN p_recebido THEN (CASE WHEN coalesce(i.qtd_recebida,0) > 0 THEN public.fn_decant_saldo_frasco(i.frasco_id) ELSE 0 END)
                         ELSE public.fn_decant_saldo_frasco(i.frasco_id) END,
      'custo_unitario', coalesce(f.custo_ml,0))
    WHEN i.tipo = 'pronto' THEN jsonb_build_object('tipo_item','decant_pronto','referencia_id',i.id,'codigo',coalesce(s.sku,''),
      'descricao','Decant ' || coalesce(ps.nome,''),'unidade_medida','un',
      'quantidade', CASE WHEN p_recebido THEN coalesce(i.qtd_recebida,0) ELSE i.quantidade END,'custo_unitario',coalesce(i.custo_unit,0))
    ELSE jsonb_build_object('tipo_item','decant_fechado','referencia_id',i.id,'codigo',coalesce(pp.codigo,''),
      'descricao','Frasco fechado ' || coalesce(pp.nome,''),'unidade_medida','un',
      'quantidade', CASE WHEN p_recebido THEN coalesce(i.qtd_recebida,0) ELSE i.quantidade END,'custo_unitario',coalesce(i.custo_unit,0))
  END ORDER BY i.tipo, i.id)
  FROM public.decant_transf_itens i
  LEFT JOIN public.decant_frascos f ON f.id = i.frasco_id
  LEFT JOIN public.perfumes pf ON pf.id = f.produto_id
  LEFT JOIN public.decant_skus s ON s.id = i.sku_id
  LEFT JOIN public.perfumes ps ON ps.id = s.produto_id
  LEFT JOIN public.perfumes pp ON pp.id = i.produto_id
  WHERE i.transferencia_id = p_id;
$$;
REVOKE ALL ON FUNCTION public.fn__nt_decant_itens(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn__nt_trg_decant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec jsonb;
BEGIN
  IF NEW.status = 'em_transito' THEN
    PERFORM public.fn__nt_emitir('decant', NEW.id, NEW.codigo, NEW.origem_id, NEW.destino_id,
      public.fn__nt_decant_itens(NEW.id, false), '');
  ELSIF NEW.status IN ('divergencia','finalizada') AND OLD.status = 'em_transito' THEN
    SELECT jsonb_agg(jsonb_build_object('referencia_id', e->>'referencia_id', 'quantidade', e->'quantidade'))
      INTO v_rec FROM jsonb_array_elements(public.fn__nt_decant_itens(NEW.id, true)) e;
    PERFORM public.fn__nt_receber('decant', NEW.id, v_rec);
  ELSIF NEW.status = 'cancelada' THEN
    PERFORM public.fn__nt_cancelar('decant', NEW.id, coalesce(NEW.resolucao,''));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nt_decant ON public.decant_transferencias;
CREATE TRIGGER trg_nt_decant AFTER UPDATE OF status ON public.decant_transferencias
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.fn__nt_trg_decant();

-- ===== Transferência manual: 1 NT por chamada (fn_transferir), exceto quando suprimida por um fluxo maior =====
CREATE OR REPLACE FUNCTION public.fn_transferir(p_produto_id uuid, p_origem text, p_destino text, p_quantidade integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uo public.unidades;
  ud public.unidades;
  v_ok integer;
  v_g uuid; v_p public.perfumes;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida para transferência';
  END IF;

  SELECT * INTO uo FROM public.fn_unidade_por_texto(p_origem);
  SELECT * INTO ud FROM public.fn_unidade_por_texto(p_destino);
  IF uo.id IS NULL OR ud.id IS NULL THEN RAISE EXCEPTION 'Unidade de origem ou destino não encontrada'; END IF;
  IF uo.id = ud.id THEN RAISE EXCEPTION 'Origem e destino devem ser diferentes'; END IF;

  IF uo.status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO') THEN
    RAISE EXCEPTION 'Unidade % está em implantação e não pode enviar transferências.', uo.nome_exibicao;
  END IF;
  IF uo.status = 'INATIVA' OR ud.status = 'INATIVA' THEN
    RAISE EXCEPTION 'Unidade inativa não participa de transferências.';
  END IF;
  IF NOT uo.permite_transferencia OR NOT ud.permite_transferencia THEN
    RAISE EXCEPTION 'Transferência não permitida entre % e %.', uo.nome_exibicao, ud.nome_exibicao;
  END IF;

  UPDATE public.estoque_unidades
     SET quantidade = quantidade - p_quantidade,
         data_ultima_saida = now(),
         updated_at = now()
   WHERE produto_id = p_produto_id
     AND unidade_id = uo.id
     AND quantidade - quantidade_reservada >= p_quantidade
  RETURNING quantidade INTO v_ok;

  IF v_ok IS NULL THEN
    RAISE EXCEPTION 'Estoque insuficiente em % para transferir.', uo.nome_exibicao;
  END IF;

  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, data_ultima_entrada)
  VALUES (p_produto_id, ud.id, p_quantidade, now())
  ON CONFLICT (produto_id, unidade_id) DO UPDATE
    SET quantidade = public.estoque_unidades.quantidade + EXCLUDED.quantidade,
        data_ultima_entrada = now(),
        updated_at = now();

  PERFORM public.fn_sync_estoque_legado(p_produto_id, uo.id);
  PERFORM public.fn_sync_estoque_legado(p_produto_id, ud.id);

  IF coalesce(current_setting('lejess.nt_suprimir', true), '') <> '1' THEN
    v_g := gen_random_uuid();
    SELECT * INTO v_p FROM public.perfumes WHERE id = p_produto_id;
    IF public.fn__nt_emitir('manual', v_g, 'Transferência manual', uo.id, ud.id,
         jsonb_build_array(jsonb_build_object('tipo_item','produto','referencia_id',p_produto_id,'codigo',coalesce(v_p.codigo,''),
           'descricao',coalesce(v_p.nome,'Produto'),'quantidade',p_quantidade,'custo_unitario',coalesce(v_p.custo_medio,v_p.custo,0))), '') IS NOT NULL THEN
      PERFORM public.fn__nt_receber('manual', v_g, jsonb_build_array(jsonb_build_object('referencia_id',p_produto_id,'quantidade',p_quantidade)));
    END IF;
  END IF;
END;
$function$;

-- envio manual com vários produtos: 1 NT
CREATE OR REPLACE FUNCTION public.fn_transferencia_manual(p_origem uuid, p_destino uuid, p_itens jsonb, p_observacao text DEFAULT '', p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uo public.unidades; ud public.unidades; v_g uuid; v_it jsonb; v_p public.perfumes; v_q integer; v_nt uuid;
  v_itens jsonb := '[]'::jsonb; v_hoje date := public.fn__hoje_manaus(); v_nome text := coalesce(public.fn__nome_usuario(),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO uo FROM public.unidades WHERE id = p_origem;
  SELECT * INTO ud FROM public.unidades WHERE id = p_destino;
  IF uo.id IS NULL OR ud.id IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada'; END IF;
  IF NOT (public.has_role(auth.uid(),'master') OR public.fn__pode(uo.id,'estoque.transferir')) THEN
    RAISE EXCEPTION 'Sem permissão para transferir desta unidade.';
  END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Adicione ao menos um produto'; END IF;
  v_g := CASE WHEN coalesce(p_idempotency_key,'') = '' THEN gen_random_uuid() ELSE md5('manual:' || p_idempotency_key)::uuid END;
  PERFORM pg_advisory_xact_lock(hashtext('trf_manual:' || v_g));
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE acao = 'TRANSFERENCIA_MANUAL' AND entidade_id = v_g) THEN
    RETURN jsonb_build_object('repetido', true, 'nota_id', (SELECT id FROM public.notas_transferencia WHERE tipo_origem='manual' AND origem_id=v_g LIMIT 1));
  END IF;
  PERFORM set_config('lejess.nt_suprimir', '1', true);
  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_q := (v_it->>'quantidade')::integer;
    SELECT * INTO v_p FROM public.perfumes WHERE id = (v_it->>'produto_id')::uuid;
    IF v_p.id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    PERFORM public.fn_transferir(v_p.id, uo.nome, ud.nome, v_q);
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito_origem, deposito_destino, quantidade, observacao,
      registrado_por, unidade_origem_id, unidade_destino_id)
    VALUES (v_hoje, 'Transferência', v_p.id, v_p.nome, uo.nome, ud.nome, v_q, coalesce(nullif(p_observacao,''),'Envio manual'), v_nome, uo.id, ud.id);
    v_itens := v_itens || jsonb_build_object('tipo_item','produto','referencia_id',v_p.id,'codigo',coalesce(v_p.codigo,''),
      'descricao',v_p.nome,'quantidade',v_q,'custo_unitario',coalesce(v_p.custo_medio,v_p.custo,0));
  END LOOP;
  PERFORM set_config('lejess.nt_suprimir', '', true);
  v_nt := public.fn__nt_emitir('manual', v_g, 'Envio manual', uo.id, ud.id, v_itens, v_nome);
  IF v_nt IS NOT NULL THEN
    PERFORM public.fn__nt_receber('manual', v_g, (SELECT jsonb_agg(jsonb_build_object('referencia_id', e->>'referencia_id', 'quantidade', e->'quantidade')) FROM jsonb_array_elements(v_itens) e));
  END IF;
  PERFORM public.fn_audit('TRANSFERENCIA_MANUAL', 'movimentacoes', v_g, uo.id, NULL, jsonb_build_object('destino', ud.id, 'itens', jsonb_array_length(v_itens)));
  RETURN jsonb_build_object('repetido', false, 'nota_id', v_nt);
END $$;
REVOKE ALL ON FUNCTION public.fn_transferencia_manual(uuid,uuid,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_manual(uuid,uuid,jsonb,text,text) TO authenticated;

-- ===== Reposição: envio, finalização e cancelamento atômicos =====
CREATE OR REPLACE FUNCTION public.fn__reposicao_unidades(r public.reposicoes, OUT o uuid, OUT d uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  o := coalesce(r.unidade_origem_id, (SELECT id FROM public.fn_unidade_por_texto(r.origem)));
  d := coalesce(r.unidade_destino_id, (SELECT id FROM public.fn_unidade_por_texto(r.destino)));
  IF o IS NULL OR d IS NULL THEN RAISE EXCEPTION 'Unidade da reposição não encontrada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.fn__reposicao_unidades(public.reposicoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_reposicao_enviar(p_id uuid, p_enviados jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reposicoes; v_o uuid; v_d uuid; v_k text; v_nome text := coalesce(public.fn__nome_usuario(),''); v_itens jsonb; v_total integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO r FROM public.reposicoes WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reposição não encontrada'; END IF;
  SELECT o, d INTO v_o, v_d FROM public.fn__reposicao_unidades(r);
  IF NOT (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(v_o)) THEN RAISE EXCEPTION 'Sem acesso à unidade de origem.'; END IF;
  IF r.enviado_em IS NOT NULL AND r.status NOT IN ('rascunho','em_separacao','pronta_envio') THEN
    RETURN jsonb_build_object('repetido', true);
  END IF;
  IF r.status IN ('finalizada','cancelada') THEN RAISE EXCEPTION 'Reposição já encerrada.'; END IF;
  FOR v_k IN SELECT jsonb_object_keys(coalesce(p_enviados,'{}'::jsonb)) LOOP
    IF (p_enviados->>v_k)::integer < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    UPDATE public.reposicao_itens SET quantidade_enviada = (p_enviados->>v_k)::integer, updated_at = now()
     WHERE id = v_k::uuid AND reposicao_id = p_id;
    v_total := v_total + (p_enviados->>v_k)::integer;
  END LOOP;
  UPDATE public.reposicoes SET status = 'aguardando_conferencia', enviado_por = auth.uid(), enviado_por_nome = v_nome,
    enviado_em = now(), unidade_origem_id = v_o, unidade_destino_id = v_d, updated_at = now() WHERE id = p_id;
  INSERT INTO public.reposicao_historico (reposicao_id, usuario_id, usuario_nome, acao, detalhes)
  VALUES (p_id, auth.uid(), v_nome, 'Envio confirmado', v_total || ' unidade(s) enviada(s) para ' || r.destino);
  SELECT jsonb_agg(jsonb_build_object('tipo_item','produto','referencia_id',i.id,'codigo',coalesce(p.codigo,''),'descricao',i.produto_nome,
    'quantidade',coalesce(i.quantidade_enviada, i.quantidade_separada, i.quantidade_solicitada),'custo_unitario',coalesce(p.custo_medio,p.custo,0)) ORDER BY i.produto_nome)
    INTO v_itens FROM public.reposicao_itens i LEFT JOIN public.perfumes p ON p.id = i.produto_id WHERE i.reposicao_id = p_id;
  PERFORM public.fn__nt_emitir('reposicao', p_id, r.codigo, v_o, v_d, v_itens, coalesce(r.separado_por_nome,''));
  RETURN jsonb_build_object('repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_reposicao_finalizar(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reposicoes; v_o uuid; v_d uuid; it record; v_q integer; v_nome text := coalesce(public.fn__nome_usuario(),'');
  v_hoje date := public.fn__hoje_manaus(); v_rec jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO r FROM public.reposicoes WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reposição não encontrada'; END IF;
  IF r.status = 'finalizada' THEN RETURN jsonb_build_object('repetido', true); END IF;
  IF r.status = 'cancelada' THEN RAISE EXCEPTION 'Reposição cancelada.'; END IF;
  SELECT o, d INTO v_o, v_d FROM public.fn__reposicao_unidades(r);
  IF NOT (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(v_o) OR public.usuario_tem_acesso_unidade(v_d)) THEN
    RAISE EXCEPTION 'Sem acesso a esta reposição.';
  END IF;
  PERFORM set_config('lejess.nt_suprimir', '1', true);
  FOR it IN SELECT * FROM public.reposicao_itens WHERE reposicao_id = p_id ORDER BY produto_id FOR UPDATE LOOP
    v_q := coalesce(it.quantidade_recebida, it.quantidade_enviada, it.quantidade_solicitada);
    v_rec := v_rec || jsonb_build_object('referencia_id', it.id, 'quantidade', coalesce(it.quantidade_recebida, v_q, 0));
    IF coalesce(v_q,0) <= 0 THEN CONTINUE; END IF;
    PERFORM public.fn_transferir(it.produto_id, r.origem, r.destino, v_q);
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito_origem, deposito_destino, quantidade, observacao,
      registrado_por, unidade_origem_id, unidade_destino_id)
    VALUES (v_hoje, 'Transferência', it.produto_id, it.produto_nome, r.origem, r.destino, v_q, 'Reposição ' || r.codigo, v_nome, v_o, v_d);
  END LOOP;
  PERFORM set_config('lejess.nt_suprimir', '', true);
  UPDATE public.reposicao_itens SET status = 'recebido', updated_at = now() WHERE reposicao_id = p_id;
  UPDATE public.reposicoes SET status = 'finalizada', finalizado_por = auth.uid(), finalizado_por_nome = v_nome,
    finalizado_em = now(), updated_at = now() WHERE id = p_id;
  INSERT INTO public.reposicao_historico (reposicao_id, usuario_id, usuario_nome, acao, detalhes)
  VALUES (p_id, auth.uid(), v_nome, 'Movimentação de estoque realizada', 'Reposição ' || r.codigo || ' finalizada');
  PERFORM public.fn__nt_receber('reposicao', p_id, v_rec);
  RETURN jsonb_build_object('repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_reposicao_cancelar(p_id uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reposicoes; v_o uuid; v_d uuid; v_nome text := coalesce(public.fn__nome_usuario(),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO r FROM public.reposicoes WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reposição não encontrada'; END IF;
  IF r.status = 'cancelada' THEN RETURN jsonb_build_object('repetido', true); END IF;
  IF r.status = 'finalizada' THEN RAISE EXCEPTION 'Reposição finalizada não pode ser cancelada.'; END IF;
  IF coalesce(btrim(p_motivo),'') = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento.'; END IF;
  SELECT o, d INTO v_o, v_d FROM public.fn__reposicao_unidades(r);
  IF NOT (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(v_o) OR public.usuario_tem_acesso_unidade(v_d)) THEN
    RAISE EXCEPTION 'Sem acesso a esta reposição.';
  END IF;
  UPDATE public.reposicoes SET status = 'cancelada', cancelado_motivo = p_motivo, updated_at = now() WHERE id = p_id;
  INSERT INTO public.reposicao_historico (reposicao_id, usuario_id, usuario_nome, acao, detalhes)
  VALUES (p_id, auth.uid(), v_nome, 'Reposição cancelada', p_motivo);
  PERFORM public.fn__nt_cancelar('reposicao', p_id, p_motivo);
  RETURN jsonb_build_object('repetido', false);
END $$;

REVOKE ALL ON FUNCTION public.fn_reposicao_enviar(uuid,jsonb), public.fn_reposicao_finalizar(uuid), public.fn_reposicao_cancelar(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reposicao_enviar(uuid,jsonb), public.fn_reposicao_finalizar(uuid), public.fn_reposicao_cancelar(uuid,text) TO authenticated;