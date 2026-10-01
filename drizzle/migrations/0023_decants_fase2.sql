-- Decants Fase 2: SKUs, ficha técnica, lotes de produção com reserva/consumo por frasco e conferência. Aditiva.
-- Reversão: supabase/rollback/0023_decants_fase2_down.sql

CREATE OR REPLACE FUNCTION public.fn__fmt_ml(_v numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(CASE WHEN _v = trunc(_v) THEN trunc(_v)::text
    ELSE rtrim(rtrim(round(_v,3)::text,'0'),'.') END, '.', ',')
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_sku_codigo(_codigo_perfume text, _volume numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT 'DEC-' || COALESCE(NULLIF(trim(_codigo_perfume),''),'SEMCOD') || '-' ||
    CASE WHEN _volume = trunc(_volume) THEN lpad(trunc(_volume)::text, 3, '0')
      ELSE trunc(_volume)::text || 'P' || rtrim(split_part(round(_volume - trunc(_volume),3)::text,'.',2),'0') END
$$;

CREATE TABLE IF NOT EXISTS public.decant_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  tamanho_id uuid NOT NULL REFERENCES public.decant_tamanhos(id),
  sku text NOT NULL UNIQUE,
  preco_venda numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  custo_medio numeric(14,6) NOT NULL DEFAULT 0 CHECK (custo_medio >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, tamanho_id)
);
GRANT SELECT ON public.decant_skus TO authenticated;
GRANT ALL ON public.decant_skus TO service_role;
ALTER TABLE public.decant_skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_sku_select ON public.decant_skus FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'decant.ver'));

CREATE SEQUENCE IF NOT EXISTS public.decant_lote_seq;

CREATE TABLE IF NOT EXISTS public.decant_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  status text NOT NULL DEFAULT 'planejado'
    CHECK (status IN ('planejado','em_producao','aguardando_conferencia','concluido','cancelado')),
  volume_total_ml numeric(10,3) NOT NULL CHECK (volume_total_ml > 0),
  ml_consumido numeric(10,3) NOT NULL DEFAULT 0 CHECK (ml_consumido >= 0),
  perdas_ml numeric(10,3) NOT NULL DEFAULT 0 CHECK (perdas_ml >= 0),
  custo_liquido numeric(14,4) NOT NULL DEFAULT 0,
  custo_insumos numeric(14,4) NOT NULL DEFAULT 0,
  custo_total numeric(14,4) NOT NULL DEFAULT 0,
  responsavel_producao text NOT NULL DEFAULT '',
  responsavel_conferencia text NOT NULL DEFAULT '',
  conferido_por uuid,
  conferido_em timestamptz,
  observacao text NOT NULL DEFAULT '',
  motivo_cancelamento text NOT NULL DEFAULT '',
  fora_fifo boolean NOT NULL DEFAULT false,
  entrada_estoque_pendente boolean NOT NULL DEFAULT false,
  idempotency_key text UNIQUE,
  criado_por uuid,
  criado_por_nome text NOT NULL DEFAULT '',
  data_producao date NOT NULL DEFAULT public.fn__hoje_manaus(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decant_lotes_unidade_idx ON public.decant_lotes (unidade_id, created_at DESC);
GRANT SELECT ON public.decant_lotes TO authenticated;
GRANT ALL ON public.decant_lotes TO service_role;
ALTER TABLE public.decant_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_lote_select ON public.decant_lotes FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_lote_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.decant_lotes(id),
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  tamanho_id uuid NOT NULL REFERENCES public.decant_tamanhos(id),
  volume_ml numeric(8,3) NOT NULL CHECK (volume_ml > 0),
  qtd_planejada integer NOT NULL CHECK (qtd_planejada > 0),
  qtd_fisica integer CHECK (qtd_fisica >= 0),
  diferenca integer,
  motivo text NOT NULL DEFAULT '',
  justificativa text NOT NULL DEFAULT '',
  custo_insumo_unit numeric(12,4) NOT NULL DEFAULT 0,
  custo_unitario numeric(14,6) NOT NULL DEFAULT 0,
  UNIQUE (lote_id, tamanho_id)
);
GRANT SELECT ON public.decant_lote_itens TO authenticated;
GRANT ALL ON public.decant_lote_itens TO service_role;
ALTER TABLE public.decant_lote_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_li_select ON public.decant_lote_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decant_lotes l WHERE l.id = lote_id AND public.fn__pode(l.unidade_id,'decant.ver')));

CREATE TABLE IF NOT EXISTS public.decant_lote_frascos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.decant_lotes(id),
  frasco_id uuid NOT NULL REFERENCES public.decant_frascos(id),
  ml_reservado numeric(10,3) NOT NULL CHECK (ml_reservado > 0),
  ml_consumido numeric(10,3) CHECK (ml_consumido >= 0),
  custo_ml numeric(14,6) NOT NULL DEFAULT 0,
  ordem_fifo integer NOT NULL DEFAULT 0,
  UNIQUE (lote_id, frasco_id)
);
CREATE INDEX IF NOT EXISTS decant_lf_frasco_idx ON public.decant_lote_frascos (frasco_id);
GRANT SELECT ON public.decant_lote_frascos TO authenticated;
GRANT ALL ON public.decant_lote_frascos TO service_role;
ALTER TABLE public.decant_lote_frascos ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_lf_select ON public.decant_lote_frascos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decant_lotes l WHERE l.id = lote_id AND public.fn__pode(l.unidade_id,'decant.ver')));

CREATE TABLE IF NOT EXISTS public.decant_lote_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.decant_lotes(id),
  evento text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decant_le_lote_idx ON public.decant_lote_eventos (lote_id, created_at);
GRANT SELECT ON public.decant_lote_eventos TO authenticated;
GRANT SELECT, INSERT ON public.decant_lote_eventos TO service_role;
ALTER TABLE public.decant_lote_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_le_select ON public.decant_lote_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decant_lotes l WHERE l.id = lote_id AND public.fn__pode(l.unidade_id,'decant.ver')));
CREATE OR REPLACE TRIGGER trg_decant_le_imutavel BEFORE UPDATE OR DELETE ON public.decant_lote_eventos
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_alteracao();

CREATE OR REPLACE FUNCTION public.fn__decant_bloquear_exclusao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Registro de produção de decant não pode ser excluído; use cancelamento'; END $$;
CREATE OR REPLACE TRIGGER trg_decant_lote_sem_delete BEFORE DELETE ON public.decant_lotes
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_li_sem_delete BEFORE DELETE ON public.decant_lote_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_lf_sem_delete BEFORE DELETE ON public.decant_lote_frascos
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();

-- Reserva ativa = ml de lotes planejados/em produção ainda não consumidos.
CREATE OR REPLACE FUNCTION public.fn_decant_reservado_frasco(p_frasco_id uuid, p_excluir_lote uuid DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(lf.ml_reservado),0) FROM public.decant_lote_frascos lf
  JOIN public.decant_lotes l ON l.id = lf.lote_id
  WHERE lf.frasco_id = p_frasco_id AND l.status IN ('planejado','em_producao') AND lf.ml_consumido IS NULL
    AND (p_excluir_lote IS NULL OR l.id <> p_excluir_lote)
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_disponivel_frasco(p_frasco_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_decant_saldo_frasco(p_frasco_id) - public.fn_decant_reservado_frasco(p_frasco_id)
$$;

CREATE OR REPLACE FUNCTION public.fn__decant_lote_evento(_lote uuid, _evento text, _dados jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.decant_lote_eventos (lote_id, evento, dados, usuario_id, usuario_nome)
  VALUES (_lote, _evento, COALESCE(_dados,'{}'::jsonb), auth.uid(), public.fn__nome_usuario())
$$;

-- Saída avulsa agora respeita reservas de produção (regra 2).
CREATE OR REPLACE FUNCTION public.fn_decant_registrar_saida(p_frasco_id uuid, p_tipo text, p_ml numeric, p_motivo text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f public.decant_frascos; v_saldo numeric; v_res numeric; v_user text := public.fn__nome_usuario(); v_prev public.decant_ml_ledger;
BEGIN
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = p_frasco_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frasco não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_f.unidade_id,'decant.perda');
  IF p_tipo NOT IN ('tester','uso_interno','vazamento','perda','amostra','descarte') THEN RAISE EXCEPTION 'Tipo de saída inválido'; END IF;
  IF p_ml IS NULL OR p_ml <= 0 THEN RAISE EXCEPTION 'Quantidade em ml deve ser maior que zero'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.decant_ml_ledger WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('saldo', v_prev.saldo_apos, 'repetido', true); END IF;
  END IF;
  IF v_f.status = 'bloqueado' THEN RAISE EXCEPTION 'Frasco bloqueado'; END IF;
  v_saldo := public.fn_decant_saldo_frasco(p_frasco_id);
  v_res := public.fn_decant_reservado_frasco(p_frasco_id);
  IF p_ml > v_saldo - v_res THEN
    RAISE EXCEPTION 'Saldo insuficiente no frasco: disponível % ml (% ml reservados para produção)',
      public.fn__fmt_ml(v_saldo - v_res), public.fn__fmt_ml(v_res);
  END IF;
  INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, idempotency_key, usuario_id, usuario_nome)
  VALUES (p_frasco_id, v_f.unidade_id, p_tipo, -p_ml, v_saldo - p_ml, COALESCE(p_motivo,''), p_idempotency_key, auth.uid(), v_user);
  RETURN jsonb_build_object('saldo', v_saldo - p_ml, 'repetido', false);
END $$;

-- SKU: cria ou edita (código, preço, ativo) com auditoria.
CREATE OR REPLACE FUNCTION public.fn_decant_sku_salvar(p_produto_id uuid, p_tamanho_id uuid, p_sku text, p_preco numeric, p_ativo boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.decant_skus; v_new public.decant_skus; v_cod text; v_vol numeric; v_sku text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.cadastrar')) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar SKU de decant'; END IF;
  SELECT codigo INTO v_cod FROM public.perfumes WHERE id = p_produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfume não encontrado'; END IF;
  SELECT volume_ml INTO v_vol FROM public.decant_tamanhos WHERE id = p_tamanho_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tamanho não encontrado'; END IF;
  IF p_preco IS NOT NULL AND p_preco < 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;
  v_sku := upper(trim(COALESCE(NULLIF(trim(p_sku),''), public.fn_decant_sku_codigo(v_cod, v_vol))));
  SELECT * INTO v_old FROM public.decant_skus WHERE produto_id = p_produto_id AND tamanho_id = p_tamanho_id FOR UPDATE;
  IF FOUND THEN
    IF p_preco IS NOT NULL AND p_preco <> v_old.preco_venda AND NOT (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.preco')) THEN
      RAISE EXCEPTION 'Sem permissão para alterar preço de decant'; END IF;
    UPDATE public.decant_skus SET sku = v_sku, preco_venda = COALESCE(p_preco, preco_venda),
      ativo = COALESCE(p_ativo, ativo), updated_at = now() WHERE id = v_old.id RETURNING * INTO v_new;
    PERFORM public.fn_audit('decant_sku_editar','decant_skus',v_new.id,NULL,to_jsonb(v_old),to_jsonb(v_new),'');
  ELSE
    INSERT INTO public.decant_skus (produto_id, tamanho_id, sku, preco_venda, ativo)
    VALUES (p_produto_id, p_tamanho_id, v_sku, COALESCE(p_preco,0), COALESCE(p_ativo,true)) RETURNING * INTO v_new;
    PERFORM public.fn_audit('decant_sku_criar','decant_skus',v_new.id,NULL,NULL,to_jsonb(v_new),'');
  END IF;
  RETURN to_jsonb(v_new);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SKU % já existe', v_sku;
END $$;

-- Ficha técnica: custos só para quem tem decant.custos; margem só com decant.margem.
CREATE OR REPLACE FUNCTION public.fn_decant_fichas_listar(p_produto_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_custos boolean; v_margem boolean; v_res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_permission(auth.uid(),'decant.ver') AND NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  v_custos := public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.custos');
  v_margem := public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.margem');
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.marca, x.nome, x.volume_ml), '[]'::jsonb) INTO v_res FROM (
    SELECT p.id AS produto_id, p.codigo AS produto_codigo, p.marca, p.nome, p.concentracao,
      t.id AS tamanho_id, t.nome AS tamanho_nome, t.volume_ml, s.id AS sku_id,
      COALESCE(s.sku, public.fn_decant_sku_codigo(p.codigo, t.volume_ml)) AS sku,
      COALESCE(s.preco_venda,0) AS preco_venda, COALESCE(s.ativo, false) AS ativo, (s.id IS NOT NULL) AS cadastrado,
      CASE WHEN v_custos THEN cm.custo_ml END AS custo_ml,
      CASE WHEN v_custos THEN t.custo_frasco END AS custo_frasco,
      CASE WHEN v_custos THEN t.custo_atomizador END AS custo_atomizador,
      CASE WHEN v_custos THEN t.custo_etiqueta END AS custo_etiqueta,
      CASE WHEN v_custos THEN t.custo_embalagem END AS custo_embalagem,
      CASE WHEN v_custos THEN t.custo_mao_obra END AS custo_mao_obra,
      CASE WHEN v_custos THEN t.custo_adicional END AS custo_adicional,
      v_custos AS ver_custos, v_margem AS ver_margem
    FROM public.decant_perfume_config c
    JOIN public.perfumes p ON p.id = c.produto_id
    CROSS JOIN public.decant_tamanhos t
    LEFT JOIN public.decant_skus s ON s.produto_id = p.id AND s.tamanho_id = t.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        (SELECT round(sum(f.custo_ml * public.fn_decant_saldo_frasco(f.id)) / NULLIF(sum(public.fn_decant_saldo_frasco(f.id)),0), 6)
           FROM public.decant_frascos f WHERE f.produto_id = p.id AND f.status = 'aberto'),
        public.fn_decant_custo_ml(COALESCE(NULLIF(p.custo_medio,0), p.custo, 0), p.volume, c.rendimento_util)) AS custo_ml
    ) cm ON true
    WHERE c.elegivel AND t.ativo AND (p_produto_id IS NULL OR p.id = p_produto_id)
  ) x;
  RETURN v_res;
END $$;

-- Cria lote planejado e reserva ml (FIFO se frascos não informados).
CREATE OR REPLACE FUNCTION public.fn_decant_lote_criar(p_produto_id uuid, p_unidade_id uuid, p_itens jsonb, p_frascos jsonb,
  p_responsavel text, p_observacao text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev public.decant_lotes; v_need numeric := 0; v_disp_total numeric := 0; v_lote uuid; v_codigo text;
  v_it jsonb; v_t public.decant_tamanhos; v_qtd integer; v_sku jsonb; v_fr record; v_resto numeric; v_pega numeric;
  v_soma numeric := 0; v_ml numeric; v_disp numeric; v_fifo uuid[]; v_escolha uuid[] := '{}'; v_fora boolean := false;
  v_user text := public.fn__nome_usuario(); v_ord integer := 0;
BEGIN
  PERFORM public.fn__decant_exigir(p_unidade_id,'decant.produzir');
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.decant_lotes WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('lote_id', v_prev.id, 'codigo', v_prev.codigo, 'repetido', true); END IF;
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um tamanho e quantidade'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.decant_perfume_config WHERE produto_id = p_produto_id AND elegivel AND ativo) THEN
    RAISE EXCEPTION 'Perfume não está habilitado para decants'; END IF;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := (v_it->>'quantidade')::integer;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO v_t FROM public.decant_tamanhos WHERE id = (v_it->>'tamanho_id')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tamanho inválido ou inativo'; END IF;
    v_need := v_need + v_t.volume_ml * v_qtd;
  END LOOP;

  -- Bloqueia todos os frascos abertos do perfume na filial (ordem FIFO estável) para evitar uso concorrente do mesmo ml.
  SELECT array_agg(id ORDER BY aberto_em, codigo) INTO v_fifo FROM (
    SELECT id, aberto_em, codigo FROM public.decant_frascos
     WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id AND status = 'aberto'
     ORDER BY aberto_em, codigo FOR UPDATE) s;
  IF v_fifo IS NULL THEN RAISE EXCEPTION 'Volume insuficiente. Necessário: % ml. Disponível: 0 ml.', public.fn__fmt_ml(v_need); END IF;
  SELECT COALESCE(sum(GREATEST(public.fn_decant_disponivel_frasco(x),0)),0) INTO v_disp_total FROM unnest(v_fifo) x;
  IF v_need > v_disp_total THEN
    RAISE EXCEPTION 'Volume insuficiente. Necessário: % ml. Disponível: % ml.', public.fn__fmt_ml(v_need), public.fn__fmt_ml(v_disp_total);
  END IF;

  v_codigo := 'DEC-LOTE-' || lpad(nextval('public.decant_lote_seq')::text, 6, '0');
  INSERT INTO public.decant_lotes (codigo, produto_id, unidade_id, volume_total_ml, responsavel_producao, observacao,
    idempotency_key, criado_por, criado_por_nome)
  VALUES (v_codigo, p_produto_id, p_unidade_id, v_need, COALESCE(p_responsavel,''), COALESCE(p_observacao,''),
    p_idempotency_key, auth.uid(), v_user) RETURNING id INTO v_lote;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO v_t FROM public.decant_tamanhos WHERE id = (v_it->>'tamanho_id')::uuid;
    SELECT to_jsonb(s) INTO v_sku FROM public.decant_skus s WHERE produto_id = p_produto_id AND tamanho_id = v_t.id;
    IF v_sku IS NULL THEN
      INSERT INTO public.decant_skus (produto_id, tamanho_id, sku)
      VALUES (p_produto_id, v_t.id, public.fn_decant_sku_codigo((SELECT codigo FROM public.perfumes WHERE id = p_produto_id), v_t.volume_ml))
      RETURNING to_jsonb(decant_skus.*) INTO v_sku;
    END IF;
    INSERT INTO public.decant_lote_itens (lote_id, sku_id, tamanho_id, volume_ml, qtd_planejada, custo_insumo_unit)
    VALUES (v_lote, (v_sku->>'id')::uuid, v_t.id, v_t.volume_ml, (v_it->>'quantidade')::integer,
      v_t.custo_frasco + v_t.custo_atomizador + v_t.custo_etiqueta + v_t.custo_embalagem + v_t.custo_mao_obra + v_t.custo_adicional);
  END LOOP;

  IF p_frascos IS NOT NULL AND jsonb_typeof(p_frascos) = 'array' AND jsonb_array_length(p_frascos) > 0 THEN
    FOR v_it IN SELECT * FROM jsonb_array_elements(p_frascos) LOOP
      v_ml := (v_it->>'ml')::numeric;
      IF v_ml IS NULL OR v_ml <= 0 THEN CONTINUE; END IF;
      IF NOT ((v_it->>'frasco_id')::uuid = ANY(v_fifo)) THEN RAISE EXCEPTION 'Frasco não pertence a este perfume/filial ou está bloqueado'; END IF;
      v_disp := public.fn_decant_disponivel_frasco((v_it->>'frasco_id')::uuid);
      IF v_ml > v_disp THEN
        RAISE EXCEPTION 'Frasco % tem só % ml disponíveis', (SELECT codigo FROM public.decant_frascos WHERE id = (v_it->>'frasco_id')::uuid), public.fn__fmt_ml(v_disp);
      END IF;
      v_ord := array_position(v_fifo, (v_it->>'frasco_id')::uuid);
      INSERT INTO public.decant_lote_frascos (lote_id, frasco_id, ml_reservado, custo_ml, ordem_fifo)
      SELECT v_lote, f.id, v_ml, f.custo_ml, v_ord FROM public.decant_frascos f WHERE f.id = (v_it->>'frasco_id')::uuid;
      v_soma := v_soma + v_ml;
      v_escolha := v_escolha || (v_it->>'frasco_id')::uuid;
    END LOOP;
    IF v_soma <> v_need THEN
      RAISE EXCEPTION 'A soma dos frascos (% ml) precisa ser igual ao volume necessário (% ml)', public.fn__fmt_ml(v_soma), public.fn__fmt_ml(v_need);
    END IF;
  ELSE
    v_resto := v_need;
    FOR v_fr IN SELECT x AS id, ord FROM unnest(v_fifo) WITH ORDINALITY AS u(x, ord) ORDER BY ord LOOP
      EXIT WHEN v_resto <= 0;
      v_disp := public.fn_decant_disponivel_frasco(v_fr.id);
      CONTINUE WHEN v_disp <= 0;
      v_pega := LEAST(v_disp, v_resto);
      INSERT INTO public.decant_lote_frascos (lote_id, frasco_id, ml_reservado, custo_ml, ordem_fifo)
      SELECT v_lote, f.id, v_pega, f.custo_ml, v_fr.ord FROM public.decant_frascos f WHERE f.id = v_fr.id;
      v_resto := v_resto - v_pega;
      v_escolha := v_escolha || v_fr.id;
    END LOOP;
  END IF;

  -- Fora do FIFO: algum frasco mais antigo com saldo disponível ficou sem ser usado antes de um mais novo.
  SELECT EXISTS (
    SELECT 1 FROM unnest(v_fifo) WITH ORDINALITY a(id, ord)
    WHERE NOT (a.id = ANY(v_escolha))
      AND public.fn_decant_disponivel_frasco(a.id) > 0
      AND a.ord < (SELECT max(array_position(v_fifo, e)) FROM unnest(v_escolha) e)
  ) INTO v_fora;
  UPDATE public.decant_lotes SET fora_fifo = v_fora WHERE id = v_lote;

  PERFORM public.fn__decant_lote_evento(v_lote, 'criado', jsonb_build_object('volume_ml', v_need, 'itens', p_itens,
    'frascos', (SELECT jsonb_agg(jsonb_build_object('frasco_id', frasco_id, 'ml', ml_reservado)) FROM public.decant_lote_frascos WHERE lote_id = v_lote),
    'fora_fifo', v_fora));
  PERFORM public.fn_audit('decant_lote_criar','decant_lotes',v_lote,p_unidade_id,NULL,
    jsonb_build_object('codigo',v_codigo,'volume_ml',v_need,'fora_fifo',v_fora),'');
  RETURN jsonb_build_object('lote_id', v_lote, 'codigo', v_codigo, 'volume_ml', v_need, 'fora_fifo', v_fora, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_lote_iniciar(p_lote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes;
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_l.unidade_id,'decant.produzir');
  IF v_l.status = 'em_producao' THEN RETURN jsonb_build_object('status', v_l.status, 'repetido', true); END IF;
  IF v_l.status <> 'planejado' THEN RAISE EXCEPTION 'Só lotes planejados podem iniciar produção'; END IF;
  UPDATE public.decant_lotes SET status = 'em_producao', updated_at = now() WHERE id = p_lote_id;
  PERFORM public.fn__decant_lote_evento(p_lote_id, 'iniciado', '{}'::jsonb);
  RETURN jsonb_build_object('status','em_producao','repetido',false);
END $$;

-- Conferência: planejado × físico, motivo obrigatório para diferença, perdas absorvidas no custo do lote.
CREATE OR REPLACE FUNCTION public.fn_decant_lote_conferir(p_lote_id uuid, p_itens jsonb, p_responsavel text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes; v_i public.decant_lote_itens; v_e jsonb; v_fis integer; v_mot text; v_just text;
  v_insumos numeric := 0; v_perdas numeric := 0; v_boas_ml numeric := 0; v_total numeric;
  v_motivos text[] := ARRAY['vazamento','quebra','erro_envase','perda','volume_insuficiente','erro_operacional','outro'];
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_l.unidade_id,'decant.conferir');
  IF v_l.status = 'concluido' THEN RETURN jsonb_build_object('status','concluido','repetido',true); END IF;
  IF v_l.status <> 'aguardando_conferencia' THEN RAISE EXCEPTION 'Lote não está aguardando conferência'; END IF;

  FOR v_i IN SELECT * FROM public.decant_lote_itens WHERE lote_id = p_lote_id FOR UPDATE LOOP
    SELECT e INTO v_e FROM jsonb_array_elements(COALESCE(p_itens,'[]'::jsonb)) e WHERE (e->>'item_id')::uuid = v_i.id;
    IF v_e IS NULL THEN RAISE EXCEPTION 'Informe a quantidade física de todos os tamanhos'; END IF;
    v_fis := (v_e->>'qtd_fisica')::integer;
    IF v_fis IS NULL OR v_fis < 0 THEN RAISE EXCEPTION 'Quantidade física inválida'; END IF;
    IF v_fis > v_i.qtd_planejada THEN RAISE EXCEPTION 'Quantidade física não pode passar da planejada (% un de % ml)', v_i.qtd_planejada, public.fn__fmt_ml(v_i.volume_ml); END IF;
    v_mot := COALESCE(v_e->>'motivo',''); v_just := trim(COALESCE(v_e->>'justificativa',''));
    IF v_fis <> v_i.qtd_planejada THEN
      IF NOT (v_mot = ANY(v_motivos)) THEN RAISE EXCEPTION 'Escolha o motivo da diferença em % ml', public.fn__fmt_ml(v_i.volume_ml); END IF;
      IF length(v_just) < 5 THEN RAISE EXCEPTION 'Escreva a justificativa da diferença em % ml', public.fn__fmt_ml(v_i.volume_ml); END IF;
    END IF;
    UPDATE public.decant_lote_itens SET qtd_fisica = v_fis, diferenca = v_fis - qtd_planejada,
      motivo = CASE WHEN v_fis <> qtd_planejada THEN v_mot ELSE '' END, justificativa = v_just WHERE id = v_i.id;
    v_insumos := v_insumos + v_i.custo_insumo_unit * v_i.qtd_planejada;
    v_perdas := v_perdas + v_i.volume_ml * (v_i.qtd_planejada - v_fis);
    v_boas_ml := v_boas_ml + v_i.volume_ml * v_fis;
  END LOOP;

  v_total := v_l.custo_liquido + v_insumos;
  -- Rateio: custo total do lote dividido pelas unidades boas, proporcional ao volume de cada tamanho.
  UPDATE public.decant_lote_itens SET custo_unitario = CASE WHEN v_boas_ml > 0 THEN round(v_total * volume_ml / v_boas_ml, 6) ELSE 0 END
   WHERE lote_id = p_lote_id;

  UPDATE public.decant_lotes SET status = 'concluido', custo_insumos = round(v_insumos,4), custo_total = round(v_total,4),
    perdas_ml = GREATEST(v_perdas,0) + GREATEST(ml_consumido - volume_total_ml, 0),
    responsavel_conferencia = COALESCE(p_responsavel,''), conferido_por = auth.uid(), conferido_em = now(),
    concluido_em = now(), entrada_estoque_pendente = true, updated_at = now() WHERE id = p_lote_id;

  PERFORM public.fn__decant_lote_evento(p_lote_id, 'conferido', jsonb_build_object('itens', p_itens, 'custo_total', round(v_total,4)));
  IF v_perdas > 0 THEN
    PERFORM public.fn__decant_lote_evento(p_lote_id, 'perda_producao', jsonb_build_object('ml', v_perdas,
      'itens', (SELECT jsonb_agg(jsonb_build_object('volume_ml', volume_ml, 'unidades', -diferenca, 'motivo', motivo, 'justificativa', justificativa))
                FROM public.decant_lote_itens WHERE lote_id = p_lote_id AND diferenca < 0)));
  END IF;
  -- Gancho da Fase 3: entrada no estoque de decants (unidades boas por SKU com custo unitário).
  PERFORM public.fn__decant_lote_evento(p_lote_id, 'entrada_estoque_pendente',
    (SELECT jsonb_build_object('itens', jsonb_agg(jsonb_build_object('sku_id', sku_id, 'quantidade', qtd_fisica, 'custo_unitario', custo_unitario)))
       FROM public.decant_lote_itens WHERE lote_id = p_lote_id AND qtd_fisica > 0));
  PERFORM public.fn_audit('decant_lote_conferir','decant_lotes',p_lote_id,v_l.unidade_id,NULL,
    jsonb_build_object('custo_total',round(v_total,4),'perdas_ml',v_perdas),'');
  RETURN jsonb_build_object('status','concluido','custo_total',round(v_total,4),'perdas_ml',v_perdas,'repetido',false);
END $$;

-- Encerra o envase: grava consumo real por frasco no ledger e libera a reserva.
CREATE OR REPLACE FUNCTION public.fn_decant_lote_finalizar(p_lote_id uuid, p_consumo jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes; v_lf record; v_ml numeric; v_saldo numeric; v_outras numeric; v_total numeric := 0;
  v_custo numeric := 0; v_user text := public.fn__nome_usuario(); v_cfg jsonb := public.fn__decant_cfg(); v_r jsonb;
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_l.unidade_id,'decant.produzir');
  IF v_l.status IN ('aguardando_conferencia','concluido') THEN RETURN jsonb_build_object('status', v_l.status, 'repetido', true); END IF;
  IF v_l.status <> 'em_producao' THEN RAISE EXCEPTION 'Inicie a produção antes de finalizar'; END IF;

  FOR v_lf IN SELECT lf.*, f.codigo FROM public.decant_lote_frascos lf JOIN public.decant_frascos f ON f.id = lf.frasco_id
              WHERE lf.lote_id = p_lote_id ORDER BY f.id FOR UPDATE OF f LOOP
    v_ml := v_lf.ml_reservado;
    IF p_consumo IS NOT NULL THEN
      SELECT (e->>'ml')::numeric INTO v_ml FROM jsonb_array_elements(p_consumo) e WHERE (e->>'frasco_id')::uuid = v_lf.frasco_id;
      v_ml := COALESCE(v_ml, v_lf.ml_reservado);
    END IF;
    IF v_ml < 0 THEN RAISE EXCEPTION 'Consumo inválido'; END IF;
    v_saldo := public.fn_decant_saldo_frasco(v_lf.frasco_id);
    v_outras := public.fn_decant_reservado_frasco(v_lf.frasco_id, p_lote_id);
    IF v_ml > v_saldo - v_outras THEN
      RAISE EXCEPTION 'Frasco % tem só % ml disponíveis para este lote', v_lf.codigo, public.fn__fmt_ml(v_saldo - v_outras);
    END IF;
    IF v_ml > 0 THEN
      INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
      VALUES (v_lf.frasco_id, v_l.unidade_id, 'producao', -v_ml, v_saldo - v_ml, 'Produção ' || v_l.codigo, 'decant_lote', p_lote_id, auth.uid(), v_user);
    END IF;
    UPDATE public.decant_lote_frascos SET ml_consumido = v_ml WHERE id = v_lf.id;
    v_total := v_total + v_ml;
    v_custo := v_custo + v_ml * v_lf.custo_ml;
  END LOOP;

  UPDATE public.decant_lotes SET status = 'aguardando_conferencia', ml_consumido = v_total,
    custo_liquido = round(v_custo, 4), updated_at = now() WHERE id = p_lote_id;
  PERFORM public.fn__decant_lote_evento(p_lote_id, 'envase_finalizado', jsonb_build_object('ml_consumido', v_total, 'custo_liquido', round(v_custo,4)));

  IF NOT COALESCE((v_cfg->>'conferencia_obrigatoria')::boolean, true) THEN
    SELECT jsonb_agg(jsonb_build_object('item_id', id, 'qtd_fisica', qtd_planejada)) INTO v_r FROM public.decant_lote_itens WHERE lote_id = p_lote_id;
    RETURN public.fn_decant_lote_conferir(p_lote_id, v_r, 'Conferência dispensada nas configurações');
  END IF;
  RETURN jsonb_build_object('status','aguardando_conferencia','ml_consumido',v_total,'repetido',false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_lote_cancelar(p_lote_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes;
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_l.unidade_id,'decant.produzir');
  IF v_l.status = 'cancelado' THEN RETURN jsonb_build_object('status','cancelado','repetido',true); END IF;
  IF v_l.status NOT IN ('planejado','em_producao') THEN RAISE EXCEPTION 'Só lotes planejados ou em produção podem ser cancelados'; END IF;
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  UPDATE public.decant_lotes SET status = 'cancelado', motivo_cancelamento = trim(p_motivo), updated_at = now() WHERE id = p_lote_id;
  PERFORM public.fn__decant_lote_evento(p_lote_id, 'cancelado', jsonb_build_object('motivo', trim(p_motivo)));
  PERFORM public.fn_audit('decant_lote_cancelar','decant_lotes',p_lote_id,v_l.unidade_id,to_jsonb(v_l),
    jsonb_build_object('status','cancelado','motivo',trim(p_motivo)),'');
  RETURN jsonb_build_object('status','cancelado','repetido',false);
END $$;

-- Edição de lote: campos descritivos; concluído sempre gera auditoria com antes/depois.
CREATE OR REPLACE FUNCTION public.fn_decant_lote_editar(p_lote_id uuid, p_observacao text, p_responsavel_producao text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes; v_n public.decant_lotes;
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_l.unidade_id, CASE WHEN v_l.status = 'concluido' THEN 'decant.ajustar' ELSE 'decant.produzir' END);
  IF v_l.status = 'concluido' AND length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da edição'; END IF;
  UPDATE public.decant_lotes SET observacao = COALESCE(p_observacao, observacao),
    responsavel_producao = COALESCE(p_responsavel_producao, responsavel_producao), updated_at = now()
   WHERE id = p_lote_id RETURNING * INTO v_n;
  PERFORM public.fn__decant_lote_evento(p_lote_id, 'editado', jsonb_build_object('motivo', COALESCE(p_motivo,''),
    'antes', jsonb_build_object('observacao', v_l.observacao, 'responsavel_producao', v_l.responsavel_producao),
    'depois', jsonb_build_object('observacao', v_n.observacao, 'responsavel_producao', v_n.responsavel_producao)));
  PERFORM public.fn_audit('decant_lote_editar','decant_lotes',p_lote_id,v_l.unidade_id,to_jsonb(v_l),to_jsonb(v_n),'');
  RETURN to_jsonb(v_n);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_lotes_listar(p_unidade_id uuid, p_status text DEFAULT NULL, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
    SELECT l.*, p.codigo AS produto_codigo, p.marca, p.nome, p.concentracao, u.nome_exibicao AS unidade_nome,
      CASE WHEN public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.custos') THEN true ELSE false END AS ver_custos,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'sku',s.sku,'volume_ml',i.volume_ml,'qtd_planejada',i.qtd_planejada,
          'qtd_fisica',i.qtd_fisica,'diferenca',i.diferenca,'motivo',i.motivo,'justificativa',i.justificativa,'custo_unitario',i.custo_unitario)
          ORDER BY i.volume_ml),'[]'::jsonb)
         FROM public.decant_lote_itens i JOIN public.decant_skus s ON s.id = i.sku_id WHERE i.lote_id = l.id) AS itens,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('frasco_id',lf.frasco_id,'codigo',f.codigo,'ml_reservado',lf.ml_reservado,
          'ml_consumido',lf.ml_consumido,'custo_ml',lf.custo_ml) ORDER BY lf.ordem_fifo),'[]'::jsonb)
         FROM public.decant_lote_frascos lf JOIN public.decant_frascos f ON f.id = lf.frasco_id WHERE lf.lote_id = l.id) AS frascos,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('evento',e.evento,'dados',e.dados,'usuario',e.usuario_nome,'em',e.created_at) ORDER BY e.created_at),'[]'::jsonb)
         FROM public.decant_lote_eventos e WHERE e.lote_id = l.id) AS eventos
    FROM public.decant_lotes l JOIN public.perfumes p ON p.id = l.produto_id JOIN public.unidades u ON u.id = l.unidade_id
    WHERE (p_unidade_id IS NULL OR l.unidade_id = p_unidade_id) AND (p_status IS NULL OR l.status = p_status)
      AND public.fn__pode(l.unidade_id,'decant.ver')
    ORDER BY l.created_at DESC LIMIT LEAST(COALESCE(p_limite,30),100) OFFSET COALESCE(p_offset,0)
  ) x
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_frascos_disponiveis(p_produto_id uuid, p_unidade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.aberto_em, x.codigo), '[]'::jsonb) FROM (
    SELECT f.id, f.codigo, f.aberto_em, f.custo_ml, public.fn_decant_saldo_frasco(f.id) AS saldo_ml,
      public.fn_decant_reservado_frasco(f.id) AS reservado_ml, public.fn_decant_disponivel_frasco(f.id) AS disponivel_ml
    FROM public.decant_frascos f
    WHERE f.produto_id = p_produto_id AND f.unidade_id = p_unidade_id AND f.status = 'aberto'
      AND public.fn__pode(f.unidade_id,'decant.ver')
  ) x
$$;

REVOKE EXECUTE ON FUNCTION public.fn_decant_sku_salvar(uuid,uuid,text,numeric,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_fichas_listar(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lote_criar(uuid,uuid,jsonb,jsonb,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lote_iniciar(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lote_finalizar(uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lote_conferir(uuid,jsonb,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lote_cancelar(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lote_editar(uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_lotes_listar(uuid,text,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_frascos_disponiveis(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn__decant_lote_evento(uuid,text,jsonb) FROM anon, authenticated;