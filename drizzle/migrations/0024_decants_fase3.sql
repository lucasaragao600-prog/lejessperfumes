-- Decants Fase 3: estoque de decants prontos, movimentações, venda pelo PDV, cancelamento, devolução com quarentena,
-- inventário e transferência entre filiais. Aditiva. Reversão: supabase/rollback/0024_decants_fase3_down.sql

INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
 ('decant.vender','decants','Vender decants pelo PDV')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.decant_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  lote_id uuid REFERENCES public.decant_lotes(id),
  lote_chave uuid GENERATED ALWAYS AS (COALESCE(lote_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  custo_unit numeric(14,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sku_id, unidade_id, lote_chave)
);
GRANT SELECT ON public.decant_estoque TO authenticated;
GRANT ALL ON public.decant_estoque TO service_role;
ALTER TABLE public.decant_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_est_select ON public.decant_estoque FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_sku_unidade (
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  estoque_minimo integer NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  estoque_ideal integer NOT NULL DEFAULT 0 CHECK (estoque_ideal >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sku_id, unidade_id)
);
GRANT SELECT ON public.decant_sku_unidade TO authenticated;
GRANT ALL ON public.decant_sku_unidade TO service_role;
ALTER TABLE public.decant_sku_unidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_su_select ON public.decant_sku_unidade FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_un_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  lote_id uuid REFERENCES public.decant_lotes(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada_producao','venda','cancelamento','devolucao','ajuste','inventario',
    'transferencia_saida','transferencia_entrada','perda')),
  quantidade integer NOT NULL CHECK (quantidade <> 0),
  saldo_apos integer NOT NULL CHECK (saldo_apos >= 0),
  custo_unit numeric(14,6) NOT NULL DEFAULT 0,
  preco_unit numeric(12,2),
  canal text NOT NULL DEFAULT '',
  origem_unidade_id uuid,
  destino_unidade_id uuid,
  motivo text NOT NULL DEFAULT '',
  referencia_tipo text NOT NULL DEFAULT '',
  referencia_id uuid,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decant_unl_idx ON public.decant_un_ledger (unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decant_unl_sku_idx ON public.decant_un_ledger (sku_id, created_at DESC);
GRANT SELECT ON public.decant_un_ledger TO authenticated;
GRANT SELECT, INSERT ON public.decant_un_ledger TO service_role;
ALTER TABLE public.decant_un_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_unl_select ON public.decant_un_ledger FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));
CREATE OR REPLACE TRIGGER trg_decant_unl_imutavel BEFORE UPDATE OR DELETE ON public.decant_un_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_alteracao();

CREATE TABLE IF NOT EXISTS public.decant_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_venda uuid NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unit numeric(12,2) NOT NULL CHECK (preco_unit >= 0),
  custo_unit numeric(14,6) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  canal text NOT NULL CHECK (canal IN ('loja_fisica','site','whatsapp','instagram','marketplace','outro')),
  status text NOT NULL CHECK (status IN ('concluida','pendente_producao','cancelada')),
  lote_producao_id uuid REFERENCES public.decant_lotes(id),
  sessao_caixa_id uuid,
  cliente_id uuid,
  vendedora text NOT NULL DEFAULT '',
  qtd_devolvida integer NOT NULL DEFAULT 0 CHECK (qtd_devolvida >= 0),
  motivo_cancelamento text NOT NULL DEFAULT '',
  cancelada_em timestamptz,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qtd_devolvida <= quantidade)
);
CREATE INDEX IF NOT EXISTS decant_vendas_idx ON public.decant_vendas (unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decant_vendas_grupo_idx ON public.decant_vendas (grupo_venda);
CREATE UNIQUE INDEX IF NOT EXISTS decant_vendas_idem_idx ON public.decant_vendas (idempotency_key, sku_id, status) WHERE idempotency_key IS NOT NULL;
GRANT SELECT ON public.decant_vendas TO authenticated;
GRANT ALL ON public.decant_vendas TO service_role;
ALTER TABLE public.decant_vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_vendas_select ON public.decant_vendas FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver') OR public.fn__pode(unidade_id,'decant.vender'));

CREATE TABLE IF NOT EXISTS public.decant_venda_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_venda uuid NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  forma text NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decant_vp_grupo_idx ON public.decant_venda_pagamentos (grupo_venda);
GRANT SELECT ON public.decant_venda_pagamentos TO authenticated;
GRANT ALL ON public.decant_venda_pagamentos TO service_role;
ALTER TABLE public.decant_venda_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_vp_select ON public.decant_venda_pagamentos FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver') OR public.fn__pode(unidade_id,'decant.vender'));

CREATE TABLE IF NOT EXISTS public.decant_quarentena (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.decant_vendas(id),
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  motivo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','descartado','retornado')),
  lacrado boolean,
  decisao_obs text NOT NULL DEFAULT '',
  registrado_por uuid,
  registrado_por_nome text NOT NULL DEFAULT '',
  decidido_por uuid,
  decidido_por_nome text NOT NULL DEFAULT '',
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decant_quarentena TO authenticated;
GRANT ALL ON public.decant_quarentena TO service_role;
ALTER TABLE public.decant_quarentena ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_q_select ON public.decant_quarentena FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_inventarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.decant_skus(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  saldo_sistema integer NOT NULL,
  contado integer NOT NULL CHECK (contado >= 0),
  diferenca integer NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','pendente','aprovado','rejeitado')),
  justificativa text NOT NULL DEFAULT '',
  executado_por uuid,
  executado_por_nome text NOT NULL DEFAULT '',
  aprovado_por uuid,
  aprovado_por_nome text NOT NULL DEFAULT '',
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decant_inventarios TO authenticated;
GRANT ALL ON public.decant_inventarios TO service_role;
ALTER TABLE public.decant_inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_inv_select ON public.decant_inventarios FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE SEQUENCE IF NOT EXISTS public.decant_transf_seq;
CREATE TABLE IF NOT EXISTS public.decant_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  origem_id uuid NOT NULL REFERENCES public.unidades(id),
  destino_id uuid NOT NULL REFERENCES public.unidades(id),
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','separada','em_transito','divergencia','finalizada','cancelada')),
  observacao text NOT NULL DEFAULT '',
  transportador text NOT NULL DEFAULT '',
  resolucao text NOT NULL DEFAULT '',
  criado_por uuid, criado_por_nome text NOT NULL DEFAULT '',
  separado_em timestamptz, enviado_em timestamptz, recebido_em timestamptz, recebido_por_nome text NOT NULL DEFAULT '',
  finalizado_em timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (origem_id <> destino_id)
);
GRANT SELECT ON public.decant_transferencias TO authenticated;
GRANT ALL ON public.decant_transferencias TO service_role;
ALTER TABLE public.decant_transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_tr_select ON public.decant_transferencias FOR SELECT TO authenticated
  USING (public.fn__pode(origem_id,'decant.ver') OR public.fn__pode(destino_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_transf_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES public.decant_transferencias(id),
  tipo text NOT NULL CHECK (tipo IN ('pronto','fechado','frasco')),
  sku_id uuid REFERENCES public.decant_skus(id),
  produto_id uuid REFERENCES public.perfumes(id),
  frasco_id uuid REFERENCES public.decant_frascos(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  custo_unit numeric(14,6) NOT NULL DEFAULT 0,
  qtd_recebida integer CHECK (qtd_recebida >= 0),
  diferenca integer
);
GRANT SELECT ON public.decant_transf_itens TO authenticated;
GRANT ALL ON public.decant_transf_itens TO service_role;
ALTER TABLE public.decant_transf_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_ti_select ON public.decant_transf_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decant_transferencias t WHERE t.id = transferencia_id
    AND (public.fn__pode(t.origem_id,'decant.ver') OR public.fn__pode(t.destino_id,'decant.ver'))));

CREATE OR REPLACE TRIGGER trg_decant_vendas_sem_delete BEFORE DELETE ON public.decant_vendas FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_q_sem_delete BEFORE DELETE ON public.decant_quarentena FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_inv_sem_delete BEFORE DELETE ON public.decant_inventarios FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_tr_sem_delete BEFORE DELETE ON public.decant_transferencias FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_ti_sem_delete BEFORE DELETE ON public.decant_transf_itens FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_exclusao();
CREATE OR REPLACE TRIGGER trg_decant_vp_imutavel BEFORE UPDATE OR DELETE ON public.decant_venda_pagamentos FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_alteracao();

CREATE OR REPLACE FUNCTION public.fn_decant_saldo_sku(p_sku uuid, p_unidade uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(quantidade),0)::integer FROM public.decant_estoque WHERE sku_id = p_sku AND unidade_id = p_unidade
$$;

CREATE OR REPLACE FUNCTION public.fn__decant_un_mov(_sku uuid, _unidade uuid, _lote uuid, _tipo text, _qtd integer,
  _custo numeric, _preco numeric, _canal text, _ref_tipo text, _ref uuid, _motivo text, _origem uuid, _destino uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_saldo integer; v_r record; v_resto integer; v_pega integer; v_custo_tot numeric := 0; v_user text := public.fn__nome_usuario();
  v_cm numeric; v_nome text;
BEGIN
  IF _qtd IS NULL OR _qtd = 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  PERFORM 1 FROM public.decant_skus WHERE id = _sku FOR UPDATE;
  v_saldo := public.fn_decant_saldo_sku(_sku, _unidade);
  IF _qtd > 0 THEN
    SELECT custo_medio INTO v_cm FROM public.decant_skus WHERE id = _sku;
    _custo := COALESCE(_custo, v_cm, 0);
    INSERT INTO public.decant_estoque AS e (sku_id, unidade_id, lote_id, quantidade, custo_unit)
    VALUES (_sku, _unidade, _lote, _qtd, _custo)
    ON CONFLICT (sku_id, unidade_id, lote_chave) DO UPDATE SET
      custo_unit = CASE WHEN e.quantidade + EXCLUDED.quantidade > 0
        THEN round((e.quantidade * e.custo_unit + EXCLUDED.quantidade * EXCLUDED.custo_unit) / (e.quantidade + EXCLUDED.quantidade), 6) ELSE e.custo_unit END,
      quantidade = e.quantidade + EXCLUDED.quantidade, updated_at = now();
    UPDATE public.decant_skus s SET custo_medio = COALESCE((SELECT round(sum(quantidade*custo_unit)/NULLIF(sum(quantidade),0),6)
      FROM public.decant_estoque WHERE sku_id = _sku), s.custo_medio), updated_at = now() WHERE s.id = _sku;
    INSERT INTO public.decant_un_ledger (sku_id, unidade_id, lote_id, tipo, quantidade, saldo_apos, custo_unit, preco_unit, canal,
      origem_unidade_id, destino_unidade_id, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
    VALUES (_sku, _unidade, _lote, _tipo, _qtd, v_saldo + _qtd, _custo, _preco, COALESCE(_canal,''), _origem, _destino,
      COALESCE(_motivo,''), COALESCE(_ref_tipo,''), _ref, auth.uid(), v_user);
    RETURN _custo;
  END IF;
  IF -_qtd > v_saldo THEN
    SELECT sku INTO v_nome FROM public.decant_skus WHERE id = _sku;
    RAISE EXCEPTION 'Estoque insuficiente de %: disponível %, solicitado %', v_nome, v_saldo, -_qtd;
  END IF;
  v_resto := -_qtd;
  FOR v_r IN SELECT * FROM public.decant_estoque WHERE sku_id = _sku AND unidade_id = _unidade AND quantidade > 0
             AND (_lote IS NULL OR lote_id = _lote) ORDER BY created_at, id FOR UPDATE LOOP
    EXIT WHEN v_resto <= 0;
    v_pega := LEAST(v_r.quantidade, v_resto);
    UPDATE public.decant_estoque SET quantidade = quantidade - v_pega, updated_at = now() WHERE id = v_r.id;
    v_saldo := v_saldo - v_pega;
    INSERT INTO public.decant_un_ledger (sku_id, unidade_id, lote_id, tipo, quantidade, saldo_apos, custo_unit, preco_unit, canal,
      origem_unidade_id, destino_unidade_id, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
    VALUES (_sku, _unidade, v_r.lote_id, _tipo, -v_pega, v_saldo, v_r.custo_unit, _preco, COALESCE(_canal,''), _origem, _destino,
      COALESCE(_motivo,''), COALESCE(_ref_tipo,''), _ref, auth.uid(), v_user);
    v_custo_tot := v_custo_tot + v_pega * v_r.custo_unit;
    v_resto := v_resto - v_pega;
  END LOOP;
  IF v_resto > 0 THEN RAISE EXCEPTION 'Estoque insuficiente no lote informado'; END IF;
  RETURN round(v_custo_tot / (-_qtd), 6);
END $$;

CREATE OR REPLACE FUNCTION public.fn__decant_lote_concluido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_i record; v_v record; v_c numeric;
BEGIN
  FOR v_i IN SELECT * FROM public.decant_lote_itens WHERE lote_id = NEW.id AND qtd_fisica > 0 LOOP
    PERFORM public.fn__decant_un_mov(v_i.sku_id, NEW.unidade_id, NEW.id, 'entrada_producao', v_i.qtd_fisica, v_i.custo_unitario,
      NULL, '', 'decant_lote', NEW.id, 'Entrada do lote ' || NEW.codigo, NULL, NULL);
  END LOOP;
  UPDATE public.decant_lotes SET entrada_estoque_pendente = false WHERE id = NEW.id;
  PERFORM public.fn__decant_lote_evento(NEW.id, 'entrada_estoque', '{}'::jsonb);
  FOR v_v IN SELECT * FROM public.decant_vendas WHERE lote_producao_id = NEW.id AND status = 'pendente_producao' ORDER BY created_at FOR UPDATE LOOP
    IF public.fn_decant_saldo_sku(v_v.sku_id, v_v.unidade_id) >= v_v.quantidade THEN
      v_c := public.fn__decant_un_mov(v_v.sku_id, v_v.unidade_id, NULL, 'venda', -v_v.quantidade, NULL, v_v.preco_unit, v_v.canal,
        'decant_venda', v_v.id, 'Venda sob demanda entregue', NULL, NULL);
      UPDATE public.decant_vendas SET status = 'concluida', custo_unit = v_c WHERE id = v_v.id;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER trg_decant_lote_concluido AFTER UPDATE OF status ON public.decant_lotes
  FOR EACH ROW WHEN (NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido')
  EXECUTE FUNCTION public.fn__decant_lote_concluido();

CREATE OR REPLACE FUNCTION public.fn_decant_vender(p_unidade_id uuid, p_itens jsonb, p_pagamentos jsonb, p_canal text,
  p_cliente_id uuid, p_vendedora text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_grupo uuid := gen_random_uuid(); v_sessao uuid; v_it jsonb; v_s public.decant_skus; v_q integer; v_saldo integer;
  v_pronto integer; v_falta integer; v_total numeric := 0; v_pag numeric := 0; v_p jsonb; v_c numeric; v_vid uuid;
  v_cfg jsonb := public.fn__decant_cfg(); v_lote jsonb; v_user text := public.fn__nome_usuario(); v_pend integer := 0;
BEGIN
  PERFORM public.fn__decant_exigir(p_unidade_id,'decant.vender');
  IF p_idempotency_key IS NOT NULL THEN
    SELECT grupo_venda INTO v_grupo FROM public.decant_vendas WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('grupo_venda', v_grupo, 'repetido', true); END IF;
    v_grupo := gen_random_uuid();
  END IF;
  IF COALESCE(p_canal,'') NOT IN ('loja_fisica','site','whatsapp','instagram','marketplace','outro') THEN RAISE EXCEPTION 'Canal inválido'; END IF;
  v_sessao := public.fn__caixa_aberto(p_unidade_id);
  IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa desta filial antes de vender'; END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_q := (v_it->>'quantidade')::integer;
    IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO v_s FROM public.decant_skus WHERE id = (v_it->>'sku_id')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'SKU de decant inválido ou inativo'; END IF;
    IF v_s.preco_venda <= 0 THEN RAISE EXCEPTION 'SKU % está sem preço de venda', v_s.sku; END IF;
    v_total := v_total + v_s.preco_venda * v_q;
  END LOOP;
  FOR v_p IN SELECT * FROM jsonb_array_elements(COALESCE(p_pagamentos,'[]'::jsonb)) LOOP
    IF COALESCE((v_p->>'valor')::numeric,0) <= 0 THEN RAISE EXCEPTION 'Valor de pagamento inválido'; END IF;
    v_pag := v_pag + (v_p->>'valor')::numeric;
  END LOOP;
  IF round(v_pag,2) <> round(v_total,2) THEN
    RAISE EXCEPTION 'Pagamentos (R$ %) diferentes do total (R$ %)', round(v_pag,2), round(v_total,2);
  END IF;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_q := (v_it->>'quantidade')::integer;
    SELECT * INTO v_s FROM public.decant_skus WHERE id = (v_it->>'sku_id')::uuid FOR UPDATE;
    v_saldo := public.fn_decant_saldo_sku(v_s.id, p_unidade_id);
    v_pronto := LEAST(v_saldo, v_q);
    v_falta := v_q - v_pronto;
    IF v_falta > 0 AND NOT COALESCE((v_cfg->>'venda_sob_demanda')::boolean, false) THEN
      RAISE EXCEPTION 'Estoque insuficiente de %: disponível %, solicitado %', v_s.sku, v_saldo, v_q;
    END IF;
    IF v_pronto > 0 THEN
      INSERT INTO public.decant_vendas (grupo_venda, unidade_id, sku_id, quantidade, preco_unit, total, canal, status, sessao_caixa_id,
        cliente_id, vendedora, usuario_id, usuario_nome, idempotency_key)
      VALUES (v_grupo, p_unidade_id, v_s.id, v_pronto, v_s.preco_venda, v_s.preco_venda * v_pronto, p_canal, 'concluida', v_sessao,
        p_cliente_id, COALESCE(p_vendedora,''), auth.uid(), v_user, p_idempotency_key) RETURNING id INTO v_vid;
      v_c := public.fn__decant_un_mov(v_s.id, p_unidade_id, NULL, 'venda', -v_pronto, NULL, v_s.preco_venda, p_canal,
        'decant_venda', v_vid, 'Venda', NULL, NULL);
      UPDATE public.decant_vendas SET custo_unit = v_c WHERE id = v_vid;
    END IF;
    IF v_falta > 0 THEN
      v_lote := public.fn_decant_lote_criar(v_s.produto_id, p_unidade_id,
        jsonb_build_array(jsonb_build_object('tamanho_id', v_s.tamanho_id, 'quantidade', v_falta)), NULL,
        'Venda sob demanda', 'Gerado pela venda ' || v_grupo::text, NULL);
      INSERT INTO public.decant_vendas (grupo_venda, unidade_id, sku_id, quantidade, preco_unit, total, canal, status, lote_producao_id,
        sessao_caixa_id, cliente_id, vendedora, usuario_id, usuario_nome, idempotency_key)
      VALUES (v_grupo, p_unidade_id, v_s.id, v_falta, v_s.preco_venda, v_s.preco_venda * v_falta, p_canal, 'pendente_producao',
        (v_lote->>'lote_id')::uuid, v_sessao, p_cliente_id, COALESCE(p_vendedora,''), auth.uid(), v_user, p_idempotency_key);
      v_pend := v_pend + v_falta;
    END IF;
  END LOOP;

  FOR v_p IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO public.decant_venda_pagamentos (grupo_venda, unidade_id, forma, valor) VALUES (v_grupo, p_unidade_id, v_p->>'forma', (v_p->>'valor')::numeric);
    IF v_p->>'forma' = 'Dinheiro' THEN
      INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
      VALUES (v_sessao, 'venda_decant', (v_p->>'valor')::numeric, 'Venda de decant ' || left(v_grupo::text, 8), v_user);
    END IF;
  END LOOP;
  PERFORM public.fn_audit('decant_venda','decant_vendas',v_grupo,p_unidade_id,NULL,
    jsonb_build_object('total',v_total,'canal',p_canal,'itens',p_itens,'pagamentos',p_pagamentos),'');
  RETURN jsonb_build_object('grupo_venda', v_grupo, 'total', v_total, 'pendentes_producao', v_pend, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_venda_cancelar(p_grupo uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_v record; v_un uuid; v_sessao uuid; v_din numeric; v_user text := public.fn__nome_usuario(); v_n integer := 0;
BEGIN
  SELECT unidade_id INTO v_un FROM public.decant_vendas WHERE grupo_venda = p_grupo LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda de decant não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_un,'decant.vender');
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  IF EXISTS (SELECT 1 FROM public.decant_vendas WHERE grupo_venda = p_grupo AND qtd_devolvida > 0) THEN
    RAISE EXCEPTION 'Venda já tem devolução; use a devolução'; END IF;
  FOR v_v IN SELECT * FROM public.decant_vendas WHERE grupo_venda = p_grupo AND status <> 'cancelada' ORDER BY id FOR UPDATE LOOP
    IF v_v.status = 'concluida' THEN
      PERFORM public.fn__decant_un_mov(v_v.sku_id, v_v.unidade_id, NULL, 'cancelamento', v_v.quantidade, v_v.custo_unit, v_v.preco_unit,
        v_v.canal, 'decant_venda', v_v.id, 'Cancelamento: ' || trim(p_motivo), NULL, NULL);
    ELSIF v_v.lote_producao_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.decant_lotes WHERE id = v_v.lote_producao_id AND status IN ('planejado','em_producao')) THEN
      PERFORM public.fn_decant_lote_cancelar(v_v.lote_producao_id, 'Venda sob demanda cancelada: ' || trim(p_motivo));
    END IF;
    UPDATE public.decant_vendas SET status = 'cancelada', cancelada_em = now(), motivo_cancelamento = trim(p_motivo) WHERE id = v_v.id;
    v_n := v_n + 1;
  END LOOP;
  IF v_n = 0 THEN RETURN jsonb_build_object('repetido', true); END IF;
  SELECT COALESCE(sum(valor),0) INTO v_din FROM public.decant_venda_pagamentos WHERE grupo_venda = p_grupo AND forma = 'Dinheiro';
  IF v_din > 0 THEN
    v_sessao := public.fn__caixa_aberto(v_un);
    IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa para devolver o dinheiro'; END IF;
    INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
    VALUES (v_sessao, 'estorno_decant', v_din, 'Cancelamento de decant ' || left(p_grupo::text, 8), v_user);
  END IF;
  PERFORM public.fn_audit('decant_venda_cancelar','decant_vendas',p_grupo,v_un,NULL,jsonb_build_object('motivo',trim(p_motivo)),'');
  RETURN jsonb_build_object('cancelados', v_n, 'estorno_dinheiro', v_din, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_devolver(p_venda_id uuid, p_quantidade integer, p_motivo text, p_estornar_dinheiro boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_v public.decant_vendas; v_q uuid; v_sessao uuid; v_user text := public.fn__nome_usuario();
BEGIN
  SELECT * INTO v_v FROM public.decant_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_v.unidade_id,'decant.vender');
  IF v_v.status <> 'concluida' THEN RAISE EXCEPTION 'Só vendas concluídas podem ter devolução'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_quantidade > v_v.quantidade - v_v.qtd_devolvida THEN
    RAISE EXCEPTION 'Quantidade de devolução inválida (máximo %)', v_v.quantidade - v_v.qtd_devolvida; END IF;
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da devolução'; END IF;
  UPDATE public.decant_vendas SET qtd_devolvida = qtd_devolvida + p_quantidade WHERE id = p_venda_id;
  INSERT INTO public.decant_quarentena (venda_id, sku_id, unidade_id, quantidade, motivo, registrado_por, registrado_por_nome)
  VALUES (p_venda_id, v_v.sku_id, v_v.unidade_id, p_quantidade, trim(p_motivo), auth.uid(), v_user) RETURNING id INTO v_q;
  IF COALESCE(p_estornar_dinheiro,false) THEN
    v_sessao := public.fn__caixa_aberto(v_v.unidade_id);
    IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa para devolver o dinheiro'; END IF;
    INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
    VALUES (v_sessao, 'estorno_decant', v_v.preco_unit * p_quantidade, 'Devolução de decant ' || left(v_v.grupo_venda::text, 8), v_user);
  END IF;
  PERFORM public.fn_audit('decant_devolucao','decant_quarentena',v_q,v_v.unidade_id,NULL,
    jsonb_build_object('venda_id',p_venda_id,'quantidade',p_quantidade,'motivo',trim(p_motivo)),'');
  RETURN jsonb_build_object('quarentena_id', v_q);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_quarentena_decidir(p_id uuid, p_acao text, p_lacrado boolean, p_obs text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q public.decant_quarentena; v_v public.decant_vendas;
BEGIN
  SELECT * INTO v_q FROM public.decant_quarentena WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_q.unidade_id,'decant.aprovar_divergencia');
  IF v_q.status <> 'pendente' THEN RETURN jsonb_build_object('status', v_q.status, 'repetido', true); END IF;
  IF p_acao NOT IN ('descartar','retornar') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  IF p_acao = 'retornar' AND NOT COALESCE(p_lacrado,false) THEN RAISE EXCEPTION 'Só volta ao estoque se estiver lacrado e íntegro'; END IF;
  SELECT * INTO v_v FROM public.decant_vendas WHERE id = v_q.venda_id;
  IF p_acao = 'retornar' THEN
    PERFORM public.fn__decant_un_mov(v_q.sku_id, v_q.unidade_id, NULL, 'devolucao', v_q.quantidade, v_v.custo_unit, NULL, '',
      'decant_quarentena', v_q.id, 'Devolução aprovada (lacrado): ' || COALESCE(p_obs,''), NULL, NULL);
  END IF;
  UPDATE public.decant_quarentena SET status = CASE WHEN p_acao='retornar' THEN 'retornado' ELSE 'descartado' END,
    lacrado = p_lacrado, decisao_obs = COALESCE(p_obs,''), decidido_por = auth.uid(), decidido_por_nome = public.fn__nome_usuario(),
    decidido_em = now() WHERE id = p_id;
  PERFORM public.fn_audit('decant_quarentena_decidir','decant_quarentena',p_id,v_q.unidade_id,to_jsonb(v_q),
    jsonb_build_object('acao',p_acao,'lacrado',p_lacrado,'obs',p_obs),'');
  RETURN jsonb_build_object('status', CASE WHEN p_acao='retornar' THEN 'retornado' ELSE 'descartado' END, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_inventario_contar(p_sku uuid, p_unidade uuid, p_contado integer, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_saldo integer; v_id uuid; v_st text;
BEGIN
  PERFORM public.fn__decant_exigir(p_unidade,'decant.conferir');
  IF p_contado IS NULL OR p_contado < 0 THEN RAISE EXCEPTION 'Contagem inválida'; END IF;
  PERFORM 1 FROM public.decant_skus WHERE id = p_sku FOR UPDATE;
  v_saldo := public.fn_decant_saldo_sku(p_sku, p_unidade);
  v_st := CASE WHEN p_contado = v_saldo THEN 'ok' ELSE 'pendente' END;
  IF v_st = 'pendente' AND length(trim(COALESCE(p_justificativa,''))) < 5 THEN RAISE EXCEPTION 'Justifique a diferença'; END IF;
  INSERT INTO public.decant_inventarios (sku_id, unidade_id, saldo_sistema, contado, diferenca, status, justificativa, executado_por, executado_por_nome)
  VALUES (p_sku, p_unidade, v_saldo, p_contado, p_contado - v_saldo, v_st, COALESCE(p_justificativa,''), auth.uid(), public.fn__nome_usuario())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'status', v_st, 'diferenca', p_contado - v_saldo);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_inventario_decidir(p_id uuid, p_aprovar boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_i public.decant_inventarios;
BEGIN
  SELECT * INTO v_i FROM public.decant_inventarios WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contagem não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_i.unidade_id,'decant.aprovar_divergencia');
  IF v_i.status <> 'pendente' THEN RETURN jsonb_build_object('status', v_i.status, 'repetido', true); END IF;
  IF p_aprovar THEN
    PERFORM 1 FROM public.decant_skus WHERE id = v_i.sku_id FOR UPDATE;
    IF public.fn_decant_saldo_sku(v_i.sku_id, v_i.unidade_id) <> v_i.saldo_sistema THEN
      RAISE EXCEPTION 'O estoque mudou desde a contagem; conte de novo'; END IF;
    PERFORM public.fn__decant_un_mov(v_i.sku_id, v_i.unidade_id, NULL, 'inventario', v_i.diferenca, NULL, NULL, '',
      'decant_inventario', v_i.id, 'Inventário aprovado: ' || v_i.justificativa, NULL, NULL);
  END IF;
  UPDATE public.decant_inventarios SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'rejeitado' END,
    aprovado_por = auth.uid(), aprovado_por_nome = public.fn__nome_usuario(), aprovado_em = now() WHERE id = p_id;
  PERFORM public.fn_audit('decant_inventario_decidir','decant_inventarios',p_id,v_i.unidade_id,to_jsonb(v_i),
    jsonb_build_object('aprovado',p_aprovar),'');
  RETURN jsonb_build_object('status', CASE WHEN p_aprovar THEN 'aprovado' ELSE 'rejeitado' END, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_sku_unidade_salvar(p_sku uuid, p_unidade uuid, p_minimo integer, p_ideal integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn__decant_exigir(p_unidade,'decant.editar');
  INSERT INTO public.decant_sku_unidade AS s (sku_id, unidade_id, estoque_minimo, estoque_ideal)
  VALUES (p_sku, p_unidade, GREATEST(COALESCE(p_minimo,0),0), GREATEST(COALESCE(p_ideal,0),0))
  ON CONFLICT (sku_id, unidade_id) DO UPDATE SET estoque_minimo = EXCLUDED.estoque_minimo, estoque_ideal = EXCLUDED.estoque_ideal, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_criar(p_origem uuid, p_destino uuid, p_itens jsonb, p_observacao text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev public.decant_transferencias; v_id uuid; v_cod text; v_it jsonb; v_tipo text; v_q integer; v_cfg jsonb := public.fn__decant_cfg();
BEGIN
  PERFORM public.fn__decant_exigir(p_origem,'decant.transferir');
  IF p_origem = p_destino THEN RAISE EXCEPTION 'Origem e destino iguais'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.decant_transferencias WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('id', v_prev.id, 'codigo', v_prev.codigo, 'repetido', true); END IF;
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Informe os itens'; END IF;
  v_cod := 'DEC-TR-' || lpad(nextval('public.decant_transf_seq')::text, 6, '0');
  INSERT INTO public.decant_transferencias (codigo, origem_id, destino_id, observacao, criado_por, criado_por_nome, idempotency_key)
  VALUES (v_cod, p_origem, p_destino, COALESCE(p_observacao,''), auth.uid(), public.fn__nome_usuario(), p_idempotency_key) RETURNING id INTO v_id;
  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_tipo := v_it->>'tipo'; v_q := COALESCE((v_it->>'quantidade')::integer, 1);
    IF v_tipo = 'pronto' THEN
      INSERT INTO public.decant_transf_itens (transferencia_id, tipo, sku_id, quantidade) VALUES (v_id, 'pronto', (v_it->>'sku_id')::uuid, v_q);
    ELSIF v_tipo = 'fechado' THEN
      INSERT INTO public.decant_transf_itens (transferencia_id, tipo, produto_id, quantidade) VALUES (v_id, 'fechado', (v_it->>'produto_id')::uuid, v_q);
    ELSIF v_tipo = 'frasco' THEN
      IF NOT COALESCE((v_cfg->>'transferir_frasco_aberto')::boolean, false) THEN
        RAISE EXCEPTION 'Transferência de frasco aberto está desligada nas configurações'; END IF;
      IF NOT (public.has_role(auth.uid(),'master') OR public.fn__pode(p_origem,'decant.aprovar_divergencia')) THEN
        RAISE EXCEPTION 'Frasco aberto exige autorização especial (Master)'; END IF;
      INSERT INTO public.decant_transf_itens (transferencia_id, tipo, frasco_id, produto_id, quantidade)
      SELECT v_id, 'frasco', f.id, f.produto_id, 1 FROM public.decant_frascos f WHERE f.id = (v_it->>'frasco_id')::uuid AND f.unidade_id = p_origem;
      IF NOT FOUND THEN RAISE EXCEPTION 'Frasco não está na filial de origem'; END IF;
    ELSE RAISE EXCEPTION 'Tipo de item inválido'; END IF;
  END LOOP;
  PERFORM public.fn_audit('decant_transf_criar','decant_transferencias',v_id,p_origem,NULL,jsonb_build_object('codigo',v_cod,'destino',p_destino,'itens',p_itens),'');
  RETURN jsonb_build_object('id', v_id, 'codigo', v_cod, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_separar(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.decant_transferencias; v_i record; v_c numeric; v_fech integer; v_user text := public.fn__nome_usuario();
BEGIN
  SELECT * INTO v_t FROM public.decant_transferencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_t.origem_id,'decant.transferir');
  IF v_t.status <> 'solicitada' THEN RETURN jsonb_build_object('status', v_t.status, 'repetido', true); END IF;
  FOR v_i IN SELECT * FROM public.decant_transf_itens WHERE transferencia_id = p_id ORDER BY id LOOP
    IF v_i.tipo = 'pronto' THEN
      v_c := public.fn__decant_un_mov(v_i.sku_id, v_t.origem_id, NULL, 'transferencia_saida', -v_i.quantidade, NULL, NULL, '',
        'decant_transferencia', p_id, 'Saída ' || v_t.codigo, v_t.origem_id, v_t.destino_id);
      UPDATE public.decant_transf_itens SET custo_unit = v_c WHERE id = v_i.id;
    ELSIF v_i.tipo = 'fechado' THEN
      SELECT quantidade INTO v_fech FROM public.decant_fechados_saldo WHERE produto_id = v_i.produto_id AND unidade_id = v_t.origem_id FOR UPDATE;
      IF COALESCE(v_fech,0) < v_i.quantidade THEN RAISE EXCEPTION 'Frascos fechados insuficientes na origem: disponível %', COALESCE(v_fech,0); END IF;
      UPDATE public.decant_fechados_saldo SET quantidade = quantidade - v_i.quantidade, updated_at = now()
       WHERE produto_id = v_i.produto_id AND unidade_id = v_t.origem_id;
      INSERT INTO public.decant_fechados_mov (produto_id, unidade_id, tipo, quantidade, saldo_apos, observacao, usuario_id, usuario_nome)
      VALUES (v_i.produto_id, v_t.origem_id, 'ajuste', -v_i.quantidade, v_fech - v_i.quantidade, 'Transferência ' || v_t.codigo || ' (saída)', auth.uid(), v_user);
    ELSE
      PERFORM 1 FROM public.decant_frascos WHERE id = v_i.frasco_id AND unidade_id = v_t.origem_id AND status = 'aberto' FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Frasco indisponível para transferência'; END IF;
      IF public.fn_decant_reservado_frasco(v_i.frasco_id) > 0 THEN RAISE EXCEPTION 'Frasco tem ml reservado para produção'; END IF;
      UPDATE public.decant_frascos SET status = 'bloqueado', updated_at = now() WHERE id = v_i.frasco_id;
    END IF;
  END LOOP;
  UPDATE public.decant_transferencias SET status = 'separada', separado_em = now(), updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('status','separada','repetido',false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_enviar(p_id uuid, p_transportador text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.decant_transferencias;
BEGIN
  SELECT * INTO v_t FROM public.decant_transferencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_t.origem_id,'decant.transferir');
  IF v_t.status = 'em_transito' THEN RETURN jsonb_build_object('status', v_t.status, 'repetido', true); END IF;
  IF v_t.status <> 'separada' THEN RAISE EXCEPTION 'Separe os itens antes de enviar'; END IF;
  UPDATE public.decant_transferencias SET status = 'em_transito', transportador = COALESCE(p_transportador,''), enviado_em = now(), updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('status','em_transito','repetido',false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_receber(p_id uuid, p_conferencias jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.decant_transferencias; v_i record; v_r integer; v_div boolean := false; v_fech integer; v_user text := public.fn__nome_usuario();
BEGIN
  SELECT * INTO v_t FROM public.decant_transferencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_t.destino_id,'decant.transferir');
  IF v_t.status IN ('finalizada','divergencia') THEN RETURN jsonb_build_object('status', v_t.status, 'repetido', true); END IF;
  IF v_t.status <> 'em_transito' THEN RAISE EXCEPTION 'Transferência não está em trânsito'; END IF;
  FOR v_i IN SELECT * FROM public.decant_transf_itens WHERE transferencia_id = p_id ORDER BY id FOR UPDATE LOOP
    SELECT (e->>'qtd_recebida')::integer INTO v_r FROM jsonb_array_elements(COALESCE(p_conferencias,'[]'::jsonb)) e WHERE (e->>'item_id')::uuid = v_i.id;
    IF v_r IS NULL OR v_r < 0 THEN RAISE EXCEPTION 'Informe a quantidade recebida de todos os itens'; END IF;
    IF v_r > v_i.quantidade THEN RAISE EXCEPTION 'Recebido maior que o enviado'; END IF;
    IF v_r > 0 THEN
      IF v_i.tipo = 'pronto' THEN
        PERFORM public.fn__decant_un_mov(v_i.sku_id, v_t.destino_id, NULL, 'transferencia_entrada', v_r, v_i.custo_unit, NULL, '',
          'decant_transferencia', p_id, 'Entrada ' || v_t.codigo, v_t.origem_id, v_t.destino_id);
      ELSIF v_i.tipo = 'fechado' THEN
        INSERT INTO public.decant_fechados_saldo AS s (produto_id, unidade_id, quantidade) VALUES (v_i.produto_id, v_t.destino_id, v_r)
        ON CONFLICT (produto_id, unidade_id) DO UPDATE SET quantidade = s.quantidade + EXCLUDED.quantidade, updated_at = now()
        RETURNING quantidade INTO v_fech;
        INSERT INTO public.decant_fechados_mov (produto_id, unidade_id, tipo, quantidade, saldo_apos, observacao, usuario_id, usuario_nome)
        VALUES (v_i.produto_id, v_t.destino_id, 'ajuste', v_r, v_fech, 'Transferência ' || v_t.codigo || ' (entrada)', auth.uid(), v_user);
      ELSE
        UPDATE public.decant_frascos SET unidade_id = v_t.destino_id, status = 'aberto', updated_at = now() WHERE id = v_i.frasco_id;
      END IF;
    END IF;
    UPDATE public.decant_transf_itens SET qtd_recebida = v_r, diferenca = v_r - quantidade WHERE id = v_i.id;
    IF v_r <> v_i.quantidade THEN v_div := true; END IF;
  END LOOP;
  UPDATE public.decant_transferencias SET status = CASE WHEN v_div THEN 'divergencia' ELSE 'finalizada' END, recebido_em = now(),
    recebido_por_nome = v_user, finalizado_em = CASE WHEN v_div THEN NULL ELSE now() END, updated_at = now() WHERE id = p_id;
  PERFORM public.fn_audit('decant_transf_receber','decant_transferencias',p_id,v_t.destino_id,NULL,jsonb_build_object('conferencias',p_conferencias,'divergencia',v_div),'');
  RETURN jsonb_build_object('status', CASE WHEN v_div THEN 'divergencia' ELSE 'finalizada' END, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_resolver(p_id uuid, p_resolucao text, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.decant_transferencias; v_i record; v_falta integer; v_fech integer; v_user text := public.fn__nome_usuario();
BEGIN
  SELECT * INTO v_t FROM public.decant_transferencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_t.origem_id,'decant.aprovar_divergencia');
  IF v_t.status <> 'divergencia' THEN RAISE EXCEPTION 'Transferência sem divergência pendente'; END IF;
  IF p_resolucao NOT IN ('retorno_origem','perda') THEN RAISE EXCEPTION 'Resolução inválida'; END IF;
  IF length(trim(COALESCE(p_justificativa,''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa'; END IF;
  IF p_resolucao = 'retorno_origem' THEN
    FOR v_i IN SELECT * FROM public.decant_transf_itens WHERE transferencia_id = p_id AND diferenca < 0 LOOP
      v_falta := -v_i.diferenca;
      IF v_i.tipo = 'pronto' THEN
        PERFORM public.fn__decant_un_mov(v_i.sku_id, v_t.origem_id, NULL, 'transferencia_entrada', v_falta, v_i.custo_unit, NULL, '',
          'decant_transferencia', p_id, 'Retorno de divergência ' || v_t.codigo, v_t.destino_id, v_t.origem_id);
      ELSIF v_i.tipo = 'fechado' THEN
        INSERT INTO public.decant_fechados_saldo AS s (produto_id, unidade_id, quantidade) VALUES (v_i.produto_id, v_t.origem_id, v_falta)
        ON CONFLICT (produto_id, unidade_id) DO UPDATE SET quantidade = s.quantidade + EXCLUDED.quantidade, updated_at = now()
        RETURNING quantidade INTO v_fech;
        INSERT INTO public.decant_fechados_mov (produto_id, unidade_id, tipo, quantidade, saldo_apos, observacao, usuario_id, usuario_nome)
        VALUES (v_i.produto_id, v_t.origem_id, 'ajuste', v_falta, v_fech, 'Retorno de divergência ' || v_t.codigo, auth.uid(), v_user);
      ELSE
        UPDATE public.decant_frascos SET status = 'aberto', updated_at = now() WHERE id = v_i.frasco_id;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.decant_transferencias SET status = 'finalizada', resolucao = p_resolucao || ': ' || trim(p_justificativa),
    finalizado_em = now(), updated_at = now() WHERE id = p_id;
  PERFORM public.fn_audit('decant_transf_resolver','decant_transferencias',p_id,v_t.origem_id,NULL,
    jsonb_build_object('resolucao',p_resolucao,'justificativa',trim(p_justificativa)),'');
  RETURN jsonb_build_object('status','finalizada');
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_cancelar(p_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.decant_transferencias;
BEGIN
  SELECT * INTO v_t FROM public.decant_transferencias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_t.origem_id,'decant.transferir');
  IF v_t.status <> 'solicitada' THEN RAISE EXCEPTION 'Só transferências ainda não separadas podem ser canceladas'; END IF;
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  UPDATE public.decant_transferencias SET status = 'cancelada', resolucao = 'Cancelada: ' || trim(p_motivo), updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('status','cancelada');
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_estoque_listar(p_unidade_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_custos boolean := public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.custos'); v_skus jsonb; v_pot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.marca, x.nome, x.volume_ml, x.unidade_nome), '[]'::jsonb) INTO v_skus FROM (
    SELECT s.id AS sku_id, s.sku, s.preco_venda, s.ativo, p.id AS produto_id, p.marca, p.nome, p.concentracao, t.volume_ml,
      u.id AS unidade_id, u.nome_exibicao AS unidade_nome,
      COALESCE(sum(e.quantidade),0)::int AS quantidade,
      CASE WHEN v_custos THEN s.custo_medio END AS custo_medio,
      COALESCE(su.estoque_minimo,0) AS estoque_minimo, COALESCE(su.estoque_ideal,0) AS estoque_ideal,
      COALESCE(jsonb_agg(jsonb_build_object('lote', l.codigo, 'quantidade', e.quantidade) ORDER BY e.created_at)
        FILTER (WHERE e.quantidade > 0), '[]'::jsonb) AS lotes,
      (SELECT COALESCE(sum(q.quantidade),0) FROM public.decant_quarentena q WHERE q.sku_id = s.id AND q.unidade_id = u.id AND q.status='pendente')::int AS quarentena,
      (SELECT COALESCE(sum(v.quantidade),0) FROM public.decant_vendas v WHERE v.sku_id = s.id AND v.unidade_id = u.id AND v.status='pendente_producao')::int AS sob_demanda_pendente
    FROM public.decant_skus s JOIN public.perfumes p ON p.id = s.produto_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
    CROSS JOIN public.unidades u
    LEFT JOIN public.decant_estoque e ON e.sku_id = s.id AND e.unidade_id = u.id
    LEFT JOIN public.decant_lotes l ON l.id = e.lote_id
    LEFT JOIN public.decant_sku_unidade su ON su.sku_id = s.id AND su.unidade_id = u.id
    WHERE (p_unidade_id IS NULL OR u.id = p_unidade_id) AND public.fn__pode(u.id,'decant.ver')
      AND (EXISTS (SELECT 1 FROM public.decant_estoque e2 WHERE e2.sku_id = s.id AND e2.unidade_id = u.id)
           OR su.sku_id IS NOT NULL OR (p_unidade_id IS NOT NULL AND s.ativo))
    GROUP BY s.id, p.id, t.volume_ml, u.id, su.sku_id, su.estoque_minimo, su.estoque_ideal
  ) x;
  SELECT COALESCE(jsonb_agg(to_jsonb(y) ORDER BY y.marca, y.nome), '[]'::jsonb) INTO v_pot FROM (
    SELECT f.produto_id, p.marca, p.nome, p.concentracao, f.unidade_id, u.nome_exibicao AS unidade_nome,
      sum(GREATEST(public.fn_decant_disponivel_frasco(f.id),0)) AS disponivel_ml
    FROM public.decant_frascos f JOIN public.perfumes p ON p.id = f.produto_id JOIN public.unidades u ON u.id = f.unidade_id
    WHERE f.status = 'aberto' AND (p_unidade_id IS NULL OR f.unidade_id = p_unidade_id) AND public.fn__pode(f.unidade_id,'decant.ver')
    GROUP BY f.produto_id, p.marca, p.nome, p.concentracao, f.unidade_id, u.nome_exibicao
  ) y;
  RETURN jsonb_build_object('skus', v_skus, 'potencial', v_pot,
    'tamanhos', (SELECT COALESCE(jsonb_agg(volume_ml ORDER BY volume_ml),'[]'::jsonb) FROM public.decant_tamanhos WHERE ativo));
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_movimentacoes_listar(p jsonb, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (SELECT NULLIF(p->>'unidade_id','')::uuid AS un, NULLIF(p->>'tipo','') AS tipo, NULLIF(p->>'de','')::date AS de,
    NULLIF(p->>'ate','')::date AS ate, lower(NULLIF(p->>'busca','')) AS busca),
  m AS (
    SELECT l.created_at AS em, l.tipo, p2.marca || ' - ' || p2.nome AS produto, fr.codigo AS frasco,
      (SELECT codigo FROM public.decant_lotes WHERE id = l.referencia_id AND l.referencia_tipo = 'decant_lote') AS lote,
      NULL::int AS quantidade, l.ml, u.nome_exibicao AS origem, NULL::text AS destino, l.unidade_id, l.usuario_nome AS usuario, l.motivo, 'ml' AS livro
    FROM public.decant_ml_ledger l JOIN public.decant_frascos fr ON fr.id = l.frasco_id JOIN public.perfumes p2 ON p2.id = fr.produto_id
    JOIN public.unidades u ON u.id = l.unidade_id
    UNION ALL
    SELECT l.created_at, l.tipo, s.sku || ' · ' || p2.marca || ' - ' || p2.nome, NULL, lo.codigo, l.quantidade, NULL,
      COALESCE(uo.nome_exibicao, u.nome_exibicao), ud.nome_exibicao, l.unidade_id, l.usuario_nome, l.motivo, 'un'
    FROM public.decant_un_ledger l JOIN public.decant_skus s ON s.id = l.sku_id JOIN public.perfumes p2 ON p2.id = s.produto_id
    JOIN public.unidades u ON u.id = l.unidade_id LEFT JOIN public.unidades uo ON uo.id = l.origem_unidade_id
    LEFT JOIN public.unidades ud ON ud.id = l.destino_unidade_id LEFT JOIN public.decant_lotes lo ON lo.id = l.lote_id
    UNION ALL
    SELECT m.created_at, CASE m.tipo WHEN 'destinacao' THEN 'entrada' WHEN 'abertura' THEN 'abertura' ELSE 'ajuste' END,
      p2.marca || ' - ' || p2.nome || ' (frasco fechado)', (SELECT codigo FROM public.decant_frascos WHERE id = m.frasco_id), NULL,
      m.quantidade, NULL, u.nome_exibicao, NULL, m.unidade_id, m.usuario_nome, m.observacao, 'fechado'
    FROM public.decant_fechados_mov m JOIN public.perfumes p2 ON p2.id = m.produto_id JOIN public.unidades u ON u.id = m.unidade_id
    UNION ALL
    SELECT q.created_at, 'devolucao_quarentena', s.sku || ' · ' || p2.marca || ' - ' || p2.nome, NULL, NULL, q.quantidade, NULL,
      u.nome_exibicao, NULL, q.unidade_id, q.registrado_por_nome, q.motivo || ' [' || q.status || ']', 'quarentena'
    FROM public.decant_quarentena q JOIN public.decant_skus s ON s.id = q.sku_id JOIN public.perfumes p2 ON p2.id = s.produto_id
    JOIN public.unidades u ON u.id = q.unidade_id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(z) ORDER BY z.em DESC), '[]'::jsonb) FROM (
    SELECT m.* FROM m, f
    WHERE (f.un IS NULL OR m.unidade_id = f.un) AND (f.tipo IS NULL OR m.tipo = f.tipo)
      AND (f.de IS NULL OR (m.em AT TIME ZONE 'America/Manaus')::date >= f.de)
      AND (f.ate IS NULL OR (m.em AT TIME ZONE 'America/Manaus')::date <= f.ate)
      AND (f.busca IS NULL OR lower(COALESCE(m.produto,'') || ' ' || COALESCE(m.frasco,'') || ' ' || COALESCE(m.lote,'') || ' ' || COALESCE(m.motivo,'')) LIKE '%' || f.busca || '%')
      AND public.fn__pode(m.unidade_id,'decant.ver')
    ORDER BY m.em DESC LIMIT LEAST(COALESCE(p_limite,30),5000) OFFSET COALESCE(p_offset,0)
  ) z
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_vendas_listar(p jsonb, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(z) ORDER BY z.created_at DESC), '[]'::jsonb) FROM (
    SELECT v.id, v.grupo_venda, v.created_at, v.canal, v.status, v.quantidade, v.qtd_devolvida, v.preco_unit, v.total, v.vendedora,
      v.usuario_nome, v.motivo_cancelamento, s.sku, p2.marca, p2.nome, u.nome_exibicao AS unidade_nome, v.unidade_id,
      lo.codigo AS lote_producao,
      CASE WHEN public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.custos') THEN v.custo_unit END AS custo_unit,
      CASE WHEN public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.margem')
        THEN CASE WHEN v.preco_unit > 0 THEN round((v.preco_unit - v.custo_unit) / v.preco_unit * 100, 2) END END AS margem_pct,
      (SELECT string_agg(forma || ' ' || valor::text, ' + ') FROM public.decant_venda_pagamentos pg WHERE pg.grupo_venda = v.grupo_venda) AS pagamentos
    FROM public.decant_vendas v JOIN public.decant_skus s ON s.id = v.sku_id JOIN public.perfumes p2 ON p2.id = s.produto_id
    JOIN public.unidades u ON u.id = v.unidade_id LEFT JOIN public.decant_lotes lo ON lo.id = v.lote_producao_id
    WHERE (NULLIF(p->>'unidade_id','') IS NULL OR v.unidade_id = (p->>'unidade_id')::uuid)
      AND (NULLIF(p->>'canal','') IS NULL OR v.canal = p->>'canal')
      AND (NULLIF(p->>'de','') IS NULL OR (v.created_at AT TIME ZONE 'America/Manaus')::date >= (p->>'de')::date)
      AND (NULLIF(p->>'ate','') IS NULL OR (v.created_at AT TIME ZONE 'America/Manaus')::date <= (p->>'ate')::date)
      AND (public.fn__pode(v.unidade_id,'decant.ver') OR public.fn__pode(v.unidade_id,'decant.vender'))
    ORDER BY v.created_at DESC LIMIT LEAST(COALESCE(p_limite,30),500) OFFSET COALESCE(p_offset,0)
  ) z
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_pdv_catalogo(p_unidade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.marca, x.nome, x.volume_ml), '[]'::jsonb) FROM (
    SELECT s.id AS sku_id, s.sku, s.preco_venda, p.marca, p.nome, p.concentracao, t.volume_ml,
      public.fn_decant_saldo_sku(s.id, p_unidade_id) AS saldo
    FROM public.decant_skus s JOIN public.perfumes p ON p.id = s.produto_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
    WHERE s.ativo AND s.preco_venda > 0 AND public.fn__pode(p_unidade_id,'decant.vender')
      AND (public.has_role(auth.uid(),'master') OR COALESCE((public.fn__decant_cfg()->>'ativo')::boolean,false))
  ) x
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_transf_listar(p_unidade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(z) ORDER BY z.created_at DESC), '[]'::jsonb) FROM (
    SELECT t.*, uo.nome_exibicao AS origem_nome, ud.nome_exibicao AS destino_nome,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'tipo',i.tipo,'quantidade',i.quantidade,'qtd_recebida',i.qtd_recebida,'diferenca',i.diferenca,
        'descricao', CASE i.tipo WHEN 'pronto' THEN (SELECT sku FROM public.decant_skus WHERE id = i.sku_id)
          WHEN 'fechado' THEN (SELECT marca || ' - ' || nome || ' (fechado)' FROM public.perfumes WHERE id = i.produto_id)
          ELSE (SELECT codigo FROM public.decant_frascos WHERE id = i.frasco_id) || ' (frasco aberto)' END) ORDER BY i.id),'[]'::jsonb)
        FROM public.decant_transf_itens i WHERE i.transferencia_id = t.id) AS itens
    FROM public.decant_transferencias t JOIN public.unidades uo ON uo.id = t.origem_id JOIN public.unidades ud ON ud.id = t.destino_id
    WHERE (p_unidade_id IS NULL OR t.origem_id = p_unidade_id OR t.destino_id = p_unidade_id)
      AND (public.fn__pode(t.origem_id,'decant.ver') OR public.fn__pode(t.destino_id,'decant.ver'))
    ORDER BY t.created_at DESC LIMIT 50
  ) z
$$;

REVOKE EXECUTE ON FUNCTION public.fn__decant_un_mov(uuid,uuid,uuid,text,integer,numeric,numeric,text,text,uuid,text,uuid,uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_decant_vender(uuid,jsonb,jsonb,text,uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_venda_cancelar(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_devolver(uuid,integer,text,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_quarentena_decidir(uuid,text,boolean,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_inventario_contar(uuid,uuid,integer,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_inventario_decidir(uuid,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_sku_unidade_salvar(uuid,uuid,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_criar(uuid,uuid,jsonb,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_separar(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_enviar(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_receber(uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_resolver(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_cancelar(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_estoque_listar(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_movimentacoes_listar(jsonb,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_vendas_listar(jsonb,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_pdv_catalogo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_transf_listar(uuid) FROM anon;