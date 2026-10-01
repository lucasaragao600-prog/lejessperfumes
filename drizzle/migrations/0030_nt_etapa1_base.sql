CREATE TABLE IF NOT EXISTS public.nt_sequencias (ano integer PRIMARY KEY, ultimo integer NOT NULL DEFAULT 0);
GRANT ALL ON public.nt_sequencias TO service_role;
ALTER TABLE public.nt_sequencias ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notas_transferencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  codigo_publico text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9),'hex'),
  revisao integer NOT NULL DEFAULT 1,
  nt_original_id uuid REFERENCES public.notas_transferencia(id),
  tipo_nota text NOT NULL DEFAULT 'normal' CHECK (tipo_nota IN ('normal','substituta','retificadora')),
  motivo_revisao text NOT NULL DEFAULT '',
  tipo_origem text NOT NULL CHECK (tipo_origem IN ('transferencia','reposicao','decant','manual')),
  origem_id uuid NOT NULL,
  origem_numero text NOT NULL DEFAULT '',
  origem_unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  destino_unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  origem_snapshot jsonb NOT NULL,
  destino_snapshot jsonb NOT NULL,
  cnpjs_diferentes boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA','RECEBIDA','RECEBIDA_COM_DIVERGENCIA','CANCELADA','SUBSTITUIDA')),
  separado_por_nome text NOT NULL DEFAULT '',
  emitido_por uuid,
  emitido_por_nome text NOT NULL DEFAULT '',
  emitido_em timestamptz NOT NULL DEFAULT now(),
  recebido_por uuid,
  recebido_por_nome text,
  recebido_em timestamptz,
  cancelado_por_nome text,
  cancelado_em timestamptz,
  cancelado_motivo text,
  reimpressoes integer NOT NULL DEFAULT 0,
  ultima_reimpressao_em timestamptz,
  ultima_reimpressao_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_origem, origem_id, revisao)
);
CREATE INDEX IF NOT EXISTS idx_nt_origem_un ON public.notas_transferencia (origem_unidade_id, emitido_em DESC);
CREATE INDEX IF NOT EXISTS idx_nt_destino_un ON public.notas_transferencia (destino_unidade_id, emitido_em DESC);

CREATE TABLE IF NOT EXISTS public.notas_transferencia_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.notas_transferencia(id),
  ordem integer NOT NULL DEFAULT 0,
  tipo_item text NOT NULL DEFAULT 'produto' CHECK (tipo_item IN ('produto','decant_pronto','decant_fechado','frasco')),
  referencia_id uuid,
  codigo text NOT NULL DEFAULT '',
  descricao text NOT NULL,
  unidade_medida text NOT NULL DEFAULT 'un' CHECK (unidade_medida IN ('un','ml')),
  quantidade_enviada numeric NOT NULL CHECK (quantidade_enviada >= 0),
  quantidade_recebida numeric CHECK (quantidade_recebida IS NULL OR quantidade_recebida >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nt_itens_nota ON public.notas_transferencia_itens (nota_id, ordem);

-- custos separados: sem acesso direto pela API, só via RPC com permissão
CREATE TABLE IF NOT EXISTS public.notas_transferencia_custos (
  item_id uuid PRIMARY KEY REFERENCES public.notas_transferencia_itens(id),
  custo_unitario numeric NOT NULL DEFAULT 0
);

GRANT SELECT ON public.notas_transferencia TO authenticated;
GRANT SELECT ON public.notas_transferencia_itens TO authenticated;
GRANT ALL ON public.notas_transferencia, public.notas_transferencia_itens, public.notas_transferencia_custos TO service_role;
ALTER TABLE public.notas_transferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_transferencia_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_transferencia_custos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nt_ver_por_unidade" ON public.notas_transferencia;
CREATE POLICY "nt_ver_por_unidade" ON public.notas_transferencia FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_unidade(origem_unidade_id) OR public.usuario_tem_acesso_unidade(destino_unidade_id));
DROP POLICY IF EXISTS "nt_itens_ver_por_unidade" ON public.notas_transferencia_itens;
CREATE POLICY "nt_itens_ver_por_unidade" ON public.notas_transferencia_itens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.notas_transferencia n WHERE n.id = nota_id
  AND (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id))));

-- imutabilidade
CREATE OR REPLACE FUNCTION public.fn__nt_bloquear() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_livres text[];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Nota de Transferência não pode ser excluída'; END IF;
  IF TG_TABLE_NAME = 'notas_transferencia' THEN
    v_livres := ARRAY['status','recebido_por','recebido_por_nome','recebido_em','cancelado_por_nome','cancelado_em','cancelado_motivo','reimpressoes','ultima_reimpressao_em','ultima_reimpressao_por'];
  ELSIF TG_TABLE_NAME = 'notas_transferencia_itens' THEN
    v_livres := ARRAY['quantidade_recebida'];
  ELSE
    v_livres := ARRAY[]::text[];
  END IF;
  IF (to_jsonb(OLD) - v_livres) IS DISTINCT FROM (to_jsonb(NEW) - v_livres) THEN
    RAISE EXCEPTION 'Nota de Transferência emitida é imutável';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nt_imutavel ON public.notas_transferencia;
CREATE TRIGGER trg_nt_imutavel BEFORE UPDATE OR DELETE ON public.notas_transferencia FOR EACH ROW EXECUTE FUNCTION public.fn__nt_bloquear();
DROP TRIGGER IF EXISTS trg_nt_itens_imutavel ON public.notas_transferencia_itens;
CREATE TRIGGER trg_nt_itens_imutavel BEFORE UPDATE OR DELETE ON public.notas_transferencia_itens FOR EACH ROW EXECUTE FUNCTION public.fn__nt_bloquear();
DROP TRIGGER IF EXISTS trg_nt_custos_imutavel ON public.notas_transferencia_custos;
CREATE TRIGGER trg_nt_custos_imutavel BEFORE UPDATE OR DELETE ON public.notas_transferencia_custos FOR EACH ROW EXECUTE FUNCTION public.fn__nt_bloquear();

CREATE OR REPLACE FUNCTION public.fn__nt_cfg() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT valor FROM public.configuracoes WHERE chave = 'notas_transferencia'), '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.fn__nt_proximo_numero() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ano integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Manaus'))::int; v_n integer;
BEGIN
  INSERT INTO public.nt_sequencias (ano, ultimo) VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = public.nt_sequencias.ultimo + 1
  RETURNING ultimo INTO v_n;
  RETURN 'NT-' || v_ano || '-' || lpad(v_n::text, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION public.fn__nt_snapshot(p_un uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id',id,'nome',nome,'nome_exibicao',coalesce(nome_exibicao,nome),'cnpj',coalesce(cnpj,''),
    'inscricao_estadual',coalesce(inscricao_estadual,''),'telefone',coalesce(telefone,''),'cep',coalesce(cep,''),
    'logradouro',coalesce(logradouro,''),'numero',coalesce(numero,''),'complemento',coalesce(complemento,''),
    'bairro',coalesce(bairro,''),'cidade',coalesce(cidade,''),'uf',coalesce(uf,''))
  FROM public.unidades WHERE id = p_un;
$$;

-- emissão interna (chamada pelas RPCs dos fluxos, na mesma transação). Retorna NULL se a flag estiver desligada.
-- p_itens: [{tipo_item, referencia_id, codigo, descricao, unidade_medida, quantidade, custo_unitario}]
CREATE OR REPLACE FUNCTION public.fn__nt_emitir(
  p_tipo_origem text, p_origem_id uuid, p_origem_numero text, p_origem_un uuid, p_destino_un uuid,
  p_itens jsonb, p_separado_por_nome text DEFAULT '', p_revisao integer DEFAULT 1,
  p_original uuid DEFAULT NULL, p_tipo_nota text DEFAULT 'normal', p_motivo text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg jsonb := public.fn__nt_cfg(); v_id uuid; v_o jsonb; v_d jsonb; v_it jsonb; v_item uuid; v_i int := 0;
BEGIN
  IF coalesce((v_cfg->>'ativo')::boolean, false) = false THEN RETURN NULL; END IF;
  IF p_origem_un = p_destino_un AND coalesce((v_cfg->>'nt_mesma_unidade')::boolean, false) = false THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('nt:' || p_tipo_origem || ':' || p_origem_id || ':' || p_revisao));
  SELECT id INTO v_id FROM public.notas_transferencia WHERE tipo_origem = p_tipo_origem AND origem_id = p_origem_id AND revisao = p_revisao;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'NT sem itens'; END IF;
  v_o := public.fn__nt_snapshot(p_origem_un); v_d := public.fn__nt_snapshot(p_destino_un);
  IF v_o IS NULL OR v_d IS NULL THEN RAISE EXCEPTION 'Unidade da NT não encontrada'; END IF;
  INSERT INTO public.notas_transferencia (numero, revisao, nt_original_id, tipo_nota, motivo_revisao, tipo_origem, origem_id, origem_numero,
    origem_unidade_id, destino_unidade_id, origem_snapshot, destino_snapshot, cnpjs_diferentes, separado_por_nome, emitido_por, emitido_por_nome)
  VALUES (public.fn__nt_proximo_numero(), p_revisao, p_original, p_tipo_nota, coalesce(p_motivo,''), p_tipo_origem, p_origem_id, coalesce(p_origem_numero,''),
    p_origem_un, p_destino_un, v_o, v_d,
    (v_o->>'cnpj' = '' OR v_d->>'cnpj' = '' OR regexp_replace(v_o->>'cnpj','\D','','g') <> regexp_replace(v_d->>'cnpj','\D','','g')),
    coalesce(p_separado_por_nome,''), auth.uid(), coalesce(public.fn__nome_usuario(), ''))
  RETURNING id INTO v_id;
  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_i := v_i + 1;
    INSERT INTO public.notas_transferencia_itens (nota_id, ordem, tipo_item, referencia_id, codigo, descricao, unidade_medida, quantidade_enviada)
    VALUES (v_id, v_i, coalesce(v_it->>'tipo_item','produto'), nullif(v_it->>'referencia_id','')::uuid, coalesce(v_it->>'codigo',''),
      coalesce(v_it->>'descricao','—'), coalesce(v_it->>'unidade_medida','un'), (v_it->>'quantidade')::numeric)
    RETURNING id INTO v_item;
    INSERT INTO public.notas_transferencia_custos (item_id, custo_unitario) VALUES (v_item, coalesce((v_it->>'custo_unitario')::numeric, 0));
  END LOOP;
  IF p_original IS NOT NULL AND p_tipo_nota = 'substituta' THEN
    UPDATE public.notas_transferencia SET status = 'SUBSTITUIDA' WHERE id = p_original AND status <> 'CANCELADA';
  END IF;
  PERFORM public.fn_audit('NT_EMITIDA', 'notas_transferencia', v_id, p_origem_un, NULL,
    jsonb_build_object('tipo_origem', p_tipo_origem, 'origem_id', p_origem_id, 'revisao', p_revisao, 'tipo_nota', p_tipo_nota));
  RETURN v_id;
END $$;

-- recebimento interno: p_itens [{referencia_id, quantidade}] ou [{item_id, quantidade}]
CREATE OR REPLACE FUNCTION public.fn__nt_receber(p_tipo_origem text, p_origem_id uuid, p_itens jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_it jsonb; v_div boolean;
BEGIN
  SELECT id INTO v_id FROM public.notas_transferencia WHERE tipo_origem = p_tipo_origem AND origem_id = p_origem_id
    AND status NOT IN ('CANCELADA','SUBSTITUIDA') ORDER BY revisao DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  FOR v_it IN SELECT * FROM jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) LOOP
    UPDATE public.notas_transferencia_itens SET quantidade_recebida = (v_it->>'quantidade')::numeric
    WHERE nota_id = v_id AND (id = nullif(v_it->>'item_id','')::uuid OR referencia_id = nullif(v_it->>'referencia_id','')::uuid);
  END LOOP;
  SELECT bool_or(coalesce(quantidade_recebida, 0) <> quantidade_enviada) INTO v_div FROM public.notas_transferencia_itens WHERE nota_id = v_id;
  UPDATE public.notas_transferencia SET status = CASE WHEN v_div THEN 'RECEBIDA_COM_DIVERGENCIA' ELSE 'RECEBIDA' END,
    recebido_por = auth.uid(), recebido_por_nome = coalesce(public.fn__nome_usuario(),''), recebido_em = now()
  WHERE id = v_id;
  PERFORM public.fn_audit('NT_RECEBIDA', 'notas_transferencia', v_id, NULL, NULL, jsonb_build_object('divergencia', v_div));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn__nt_cancelar(p_tipo_origem text, p_origem_id uuid, p_motivo text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.notas_transferencia SET status = 'CANCELADA', cancelado_em = now(),
    cancelado_por_nome = coalesce(public.fn__nome_usuario(),''), cancelado_motivo = coalesce(p_motivo,'')
  WHERE tipo_origem = p_tipo_origem AND origem_id = p_origem_id AND status NOT IN ('CANCELADA','SUBSTITUIDA');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN PERFORM public.fn_audit('NT_CANCELADA', 'notas_transferencia', p_origem_id, NULL, NULL, jsonb_build_object('tipo_origem', p_tipo_origem, 'motivo', p_motivo)); END IF;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.fn__nt_emitir(text,uuid,text,uuid,uuid,jsonb,text,integer,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__nt_receber(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__nt_cancelar(text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__nt_proximo_numero() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__nt_snapshot(uuid) FROM PUBLIC, anon, authenticated;

-- leitura: lista
CREATE OR REPLACE FUNCTION public.fn_nt_listar(p_status text DEFAULT NULL, p_unidade uuid DEFAULT NULL, p_busca text DEFAULT NULL,
  p_limite integer DEFAULT 30, p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT n.* FROM public.notas_transferencia n
    WHERE (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id))
      AND (p_status IS NULL OR p_status = '' OR n.status = p_status)
      AND (p_unidade IS NULL OR n.origem_unidade_id = p_unidade OR n.destino_unidade_id = p_unidade)
      AND (p_busca IS NULL OR p_busca = '' OR n.numero ILIKE '%'||p_busca||'%' OR n.origem_numero ILIKE '%'||p_busca||'%')
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM base), 'itens', coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',b.id,'numero',b.numero,'revisao',b.revisao,'tipo_nota',b.tipo_nota,'tipo_origem',b.tipo_origem,
      'origem_numero',b.origem_numero,'status',b.status,'origem_nome',b.origem_snapshot->>'nome_exibicao','destino_nome',b.destino_snapshot->>'nome_exibicao',
      'emitido_em',b.emitido_em,'emitido_por_nome',b.emitido_por_nome,'cnpjs_diferentes',b.cnpjs_diferentes,
      'total_itens',(SELECT count(*) FROM public.notas_transferencia_itens i WHERE i.nota_id=b.id)) ORDER BY b.emitido_em DESC)
    FROM (SELECT * FROM base ORDER BY emitido_em DESC LIMIT least(greatest(p_limite,1),100) OFFSET greatest(p_offset,0)) b), '[]'::jsonb));
$$;

-- leitura: detalhe (valores só com permissão + config; conferência cega na reposição ainda não recebida)
CREATE OR REPLACE FUNCTION public.fn_nt_detalhe(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notas_transferencia; v_valores boolean; v_cega boolean;
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
  RETURN jsonb_build_object(
    'id',n.id,'numero',n.numero,'codigo_publico',n.codigo_publico,'revisao',n.revisao,'tipo_nota',n.tipo_nota,'motivo_revisao',n.motivo_revisao,
    'nt_original_numero',(SELECT numero FROM public.notas_transferencia WHERE id = n.nt_original_id),
    'tipo_origem',n.tipo_origem,'origem_numero',n.origem_numero,'status',n.status,
    'origem',n.origem_snapshot,'destino',n.destino_snapshot,'cnpjs_diferentes',n.cnpjs_diferentes,
    'separado_por_nome',n.separado_por_nome,'emitido_por_nome',n.emitido_por_nome,'emitido_em',n.emitido_em,
    'recebido_por_nome',n.recebido_por_nome,'recebido_em',n.recebido_em,
    'cancelado_por_nome',n.cancelado_por_nome,'cancelado_em',n.cancelado_em,'cancelado_motivo',n.cancelado_motivo,
    'reimpressoes',n.reimpressoes,'mostrar_valores',v_valores,'conferencia_cega',v_cega,
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'tipo_item',i.tipo_item,'codigo',i.codigo,'descricao',i.descricao,
       'unidade_medida',i.unidade_medida,
       'quantidade_enviada', CASE WHEN v_cega THEN NULL ELSE i.quantidade_enviada END,
       'quantidade_recebida', i.quantidade_recebida,
       'custo_unitario', CASE WHEN v_valores THEN c.custo_unitario ELSE NULL END) ORDER BY i.ordem)
     FROM public.notas_transferencia_itens i LEFT JOIN public.notas_transferencia_custos c ON c.item_id = i.id WHERE i.nota_id = n.id), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.fn_nt_reimprimir(p_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notas_transferencia; v_c integer;
BEGIN
  SELECT * INTO n FROM public.notas_transferencia WHERE id = p_id FOR UPDATE;
  IF n.id IS NULL OR NOT (public.fn__pode(n.origem_unidade_id,'nt.reimprimir') OR public.fn__pode(n.destino_unidade_id,'nt.reimprimir')) THEN
    RAISE EXCEPTION 'Sem permissão para reimprimir esta nota';
  END IF;
  UPDATE public.notas_transferencia SET reimpressoes = reimpressoes + 1, ultima_reimpressao_em = now(),
    ultima_reimpressao_por = coalesce(public.fn__nome_usuario(),'') WHERE id = p_id RETURNING reimpressoes INTO v_c;
  PERFORM public.fn_audit('NT_REIMPRESSA', 'notas_transferencia', p_id, n.origem_unidade_id, NULL, jsonb_build_object('via', v_c + 1));
  RETURN v_c;
END $$;

CREATE OR REPLACE FUNCTION public.fn_nt_scan_publico(p_codigo text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('numero',n.numero,'status',n.status,'revisao',n.revisao,
    'origem',n.origem_snapshot->>'nome_exibicao','destino',n.destino_snapshot->>'nome_exibicao',
    'emitido_em',n.emitido_em,'recebido_em',n.recebido_em,
    'total_itens',(SELECT count(*) FROM public.notas_transferencia_itens i WHERE i.nota_id=n.id))
  FROM public.notas_transferencia n WHERE n.codigo_publico = p_codigo;
$$;

REVOKE ALL ON FUNCTION public.fn_nt_listar(text,uuid,text,integer,integer), public.fn_nt_detalhe(uuid), public.fn_nt_reimprimir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_nt_listar(text,uuid,text,integer,integer), public.fn_nt_detalhe(uuid), public.fn_nt_reimprimir(uuid), public.fn__nt_cfg() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_nt_scan_publico(text) TO anon, authenticated;