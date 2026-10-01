-- Decants Fase 1: frascos, ledger de ml, tamanhos, conferências. Aditiva.
-- Reversão: supabase/rollback/0022_decants_fase1_down.sql

INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
 ('decant.ver','decants','Visualizar decants'),
 ('decant.cadastrar','decants','Cadastrar perfumes e tamanhos de decant'),
 ('decant.editar','decants','Editar cadastros de decant'),
 ('decant.abrir','decants','Destinar e abrir frascos para decant'),
 ('decant.produzir','decants','Produzir decants'),
 ('decant.conferir','decants','Conferir frascos e produção'),
 ('decant.perda','decants','Registrar perdas de decant'),
 ('decant.ajustar','decants','Ajustar estoque de decant'),
 ('decant.aprovar_divergencia','decants','Aprovar divergências de decant'),
 ('decant.transferir','decants','Transferir decants e frascos abertos'),
 ('decant.custos','decants','Visualizar custos de decant'),
 ('decant.margem','decants','Visualizar margem de decant'),
 ('decant.preco','decants','Alterar preço de decant'),
 ('decant.etiquetas','decants','Imprimir etiquetas de decant'),
 ('decant.relatorios','decants','Acessar relatórios de decant'),
 ('decant.configurar','decants','Configurar módulo de decants')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.configuracoes (chave, valor)
SELECT 'decants', '{"ativo": false, "visivel_vendedor": false, "tolerancia_ml": 1, "rendimento_padrao": 100, "dias_aberto_alerta": 60, "conferencia_obrigatoria": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'decants');

CREATE OR REPLACE FUNCTION public.fn_decant_custo_ml(_custo numeric, _volume numeric, _rendimento numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN COALESCE(_volume,0) <= 0 OR COALESCE(_rendimento,0) <= 0 THEN 0
    ELSE round(_custo / (_volume * _rendimento / 100.0), 6) END
$$;

CREATE TABLE IF NOT EXISTS public.decant_perfume_config (
  produto_id uuid PRIMARY KEY REFERENCES public.perfumes(id),
  elegivel boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  estoque_minimo_ml numeric(10,3) NOT NULL DEFAULT 0 CHECK (estoque_minimo_ml >= 0),
  rendimento_util numeric(5,2) NOT NULL DEFAULT 100 CHECK (rendimento_util > 0 AND rendimento_util <= 100),
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.decant_perfume_config TO authenticated;
GRANT ALL ON public.decant_perfume_config TO service_role;
ALTER TABLE public.decant_perfume_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_pc_select ON public.decant_perfume_config FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'decant.ver'));
CREATE POLICY decant_pc_insert ON public.decant_perfume_config FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'decant.cadastrar'));
CREATE POLICY decant_pc_update ON public.decant_perfume_config FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'decant.editar') OR public.has_permission(auth.uid(),'decant.cadastrar'));

CREATE TABLE IF NOT EXISTS public.decant_tamanhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  volume_ml numeric(8,3) NOT NULL UNIQUE CHECK (volume_ml > 0),
  frasco_descricao text NOT NULL DEFAULT '',
  custo_frasco numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_frasco >= 0),
  custo_atomizador numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_atomizador >= 0),
  custo_etiqueta numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_etiqueta >= 0),
  custo_embalagem numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_embalagem >= 0),
  custo_adicional numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_adicional >= 0),
  custo_mao_obra numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_mao_obra >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.decant_tamanhos TO authenticated;
GRANT ALL ON public.decant_tamanhos TO service_role;
ALTER TABLE public.decant_tamanhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_tam_select ON public.decant_tamanhos FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'decant.ver'));
CREATE POLICY decant_tam_insert ON public.decant_tamanhos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'decant.cadastrar'));
CREATE POLICY decant_tam_update ON public.decant_tamanhos FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'decant.editar') OR public.has_permission(auth.uid(),'decant.cadastrar'));

CREATE TABLE IF NOT EXISTS public.decant_fechados_saldo (
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (produto_id, unidade_id)
);
GRANT SELECT ON public.decant_fechados_saldo TO authenticated;
GRANT ALL ON public.decant_fechados_saldo TO service_role;
ALTER TABLE public.decant_fechados_saldo ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_fs_select ON public.decant_fechados_saldo FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_fechados_mov (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  tipo text NOT NULL CHECK (tipo IN ('destinacao','abertura','ajuste')),
  quantidade integer NOT NULL,
  saldo_apos integer NOT NULL CHECK (saldo_apos >= 0),
  frasco_id uuid,
  responsavel text NOT NULL DEFAULT '',
  data_operacao date NOT NULL DEFAULT public.fn__hoje_manaus(),
  observacao text NOT NULL DEFAULT '',
  idempotency_key text UNIQUE,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decant_fechados_mov TO authenticated;
GRANT ALL ON public.decant_fechados_mov TO service_role;
ALTER TABLE public.decant_fechados_mov ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_fm_select ON public.decant_fechados_mov FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE SEQUENCE IF NOT EXISTS public.decant_frasco_seq;

CREATE TABLE IF NOT EXISTS public.decant_frascos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  lote_fabricante text NOT NULL DEFAULT '',
  validade date,
  volume_nominal_ml numeric(10,3) NOT NULL CHECK (volume_nominal_ml > 0),
  volume_inicial_ml numeric(10,3) NOT NULL CHECK (volume_inicial_ml > 0),
  custo numeric(12,2) NOT NULL CHECK (custo >= 0),
  rendimento_util numeric(5,2) NOT NULL DEFAULT 100,
  custo_ml numeric(14,6) NOT NULL CHECK (custo_ml >= 0),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','bloqueado')),
  responsavel text NOT NULL DEFAULT '',
  aberto_em timestamptz NOT NULL DEFAULT now(),
  aberto_por uuid,
  aberto_por_nome text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decant_frascos TO authenticated;
GRANT ALL ON public.decant_frascos TO service_role;
ALTER TABLE public.decant_frascos ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_fr_select ON public.decant_frascos FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE TABLE IF NOT EXISTS public.decant_ml_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frasco_id uuid NOT NULL REFERENCES public.decant_frascos(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  tipo text NOT NULL CHECK (tipo IN ('abertura','producao','tester','uso_interno','vazamento','perda','amostra','ajuste','descarte')),
  ml numeric(10,3) NOT NULL CHECK (ml <> 0),
  saldo_apos numeric(10,3) NOT NULL CHECK (saldo_apos >= 0),
  motivo text NOT NULL DEFAULT '',
  referencia_tipo text NOT NULL DEFAULT '',
  referencia_id uuid,
  idempotency_key text UNIQUE,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decant_ml_ledger_frasco_idx ON public.decant_ml_ledger (frasco_id, created_at);
GRANT SELECT ON public.decant_ml_ledger TO authenticated;
GRANT SELECT, INSERT ON public.decant_ml_ledger TO service_role;
ALTER TABLE public.decant_ml_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_ml_select ON public.decant_ml_ledger FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE OR REPLACE FUNCTION public.fn__decant_bloquear_alteracao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Registro de movimentação de decant não pode ser alterado nem excluído';
END $$;
CREATE OR REPLACE TRIGGER trg_decant_ml_imutavel BEFORE UPDATE OR DELETE ON public.decant_ml_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_alteracao();
CREATE OR REPLACE TRIGGER trg_decant_fm_imutavel BEFORE UPDATE OR DELETE ON public.decant_fechados_mov
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_alteracao();

CREATE TABLE IF NOT EXISTS public.decant_conferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frasco_id uuid NOT NULL REFERENCES public.decant_frascos(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  saldo_teorico numeric(10,3) NOT NULL,
  saldo_fisico numeric(10,3) NOT NULL CHECK (saldo_fisico >= 0),
  diferenca numeric(10,3) NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','pendente','aprovada','rejeitada')),
  acao text NOT NULL DEFAULT 'nenhuma' CHECK (acao IN ('nenhuma','ajuste','perda','manter_pendente')),
  justificativa text NOT NULL DEFAULT '',
  executado_por uuid,
  executado_por_nome text NOT NULL DEFAULT '',
  aprovado_por uuid,
  aprovado_por_nome text NOT NULL DEFAULT '',
  aprovado_em timestamptz,
  decisao_obs text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decant_conferencias TO authenticated;
GRANT ALL ON public.decant_conferencias TO service_role;
ALTER TABLE public.decant_conferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY decant_conf_select ON public.decant_conferencias FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));

CREATE OR REPLACE FUNCTION public.fn__decant_cfg()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valor FROM public.configuracoes WHERE chave='decants'), '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.fn__decant_exigir(_unidade uuid, _perm text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(auth.uid(),'master') OR COALESCE((public.fn__decant_cfg()->>'ativo')::boolean,false)) THEN
    RAISE EXCEPTION 'Módulo de decants desligado';
  END IF;
  IF NOT public.fn__pode(_unidade, _perm) THEN RAISE EXCEPTION 'Sem permissão para esta operação'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_saldo_frasco(p_frasco_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(ml),0) FROM public.decant_ml_ledger WHERE frasco_id = p_frasco_id
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_destinar(p_produto_id uuid, p_unidade_id uuid, p_quantidade integer,
  p_responsavel text, p_data date, p_observacao text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_disp integer; v_saldo integer; v_nome text; v_user text := public.fn__nome_usuario(); v_prev public.decant_fechados_mov;
BEGIN
  PERFORM public.fn__decant_exigir(p_unidade_id,'decant.abrir');
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.decant_fechados_mov WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('saldo_fechados', v_prev.saldo_apos, 'repetido', true); END IF;
  END IF;
  SELECT quantidade - quantidade_reservada INTO v_disp FROM public.estoque_unidades
   WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id FOR UPDATE;
  IF COALESCE(v_disp,0) < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente: disponível %, solicitado %', COALESCE(v_disp,0), p_quantidade;
  END IF;
  UPDATE public.estoque_unidades SET quantidade = quantidade - p_quantidade, data_ultima_saida = now(), updated_at = now()
   WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id;
  PERFORM public.fn_sync_estoque_legado(p_produto_id, p_unidade_id);

  INSERT INTO public.decant_fechados_saldo AS s (produto_id, unidade_id, quantidade)
  VALUES (p_produto_id, p_unidade_id, p_quantidade)
  ON CONFLICT (produto_id, unidade_id) DO UPDATE SET quantidade = s.quantidade + EXCLUDED.quantidade, updated_at = now()
  RETURNING quantidade INTO v_saldo;

  SELECT nome INTO v_nome FROM public.perfumes WHERE id = p_produto_id;
  INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
  VALUES (COALESCE(p_data, public.fn__hoje_manaus()), 'decant_destinacao', p_produto_id, COALESCE(v_nome,''),
          (SELECT nome FROM public.unidades WHERE id = p_unidade_id), p_quantidade,
          'Destinado para decants. ' || COALESCE(p_observacao,''), v_user, p_unidade_id);

  INSERT INTO public.decant_fechados_mov (produto_id, unidade_id, tipo, quantidade, saldo_apos, responsavel, data_operacao,
    observacao, idempotency_key, usuario_id, usuario_nome)
  VALUES (p_produto_id, p_unidade_id, 'destinacao', p_quantidade, v_saldo, COALESCE(p_responsavel,''),
    COALESCE(p_data, public.fn__hoje_manaus()), COALESCE(p_observacao,''), p_idempotency_key, auth.uid(), v_user);

  PERFORM public.fn_audit('decant_destinar','perfumes',p_produto_id,p_unidade_id,NULL,
    jsonb_build_object('quantidade',p_quantidade,'saldo_fechados',v_saldo),'');
  RETURN jsonb_build_object('saldo_fechados', v_saldo, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_abrir_frasco(p_produto_id uuid, p_unidade_id uuid, p_lote_fabricante text,
  p_validade date, p_volume_inicial numeric, p_responsavel text, p_observacao text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fech integer; v_p public.perfumes; v_rend numeric; v_custo numeric; v_codigo text; v_id uuid;
  v_user text := public.fn__nome_usuario(); v_prev public.decant_frascos; v_ini numeric;
BEGIN
  PERFORM public.fn__decant_exigir(p_unidade_id,'decant.abrir');
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_prev FROM public.decant_frascos WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('frasco_id', v_prev.id, 'codigo', v_prev.codigo, 'repetido', true); END IF;
  END IF;
  SELECT quantidade INTO v_fech FROM public.decant_fechados_saldo
   WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id FOR UPDATE;
  IF COALESCE(v_fech,0) < 1 THEN RAISE EXCEPTION 'Não há frasco fechado destinado para decants nesta filial'; END IF;

  SELECT * INTO v_p FROM public.perfumes WHERE id = p_produto_id;
  IF COALESCE(v_p.volume,0) <= 0 THEN RAISE EXCEPTION 'Perfume sem volume cadastrado'; END IF;
  v_ini := COALESCE(p_volume_inicial, v_p.volume);
  IF v_ini <= 0 OR v_ini > v_p.volume THEN RAISE EXCEPTION 'Volume inicial inválido (máximo % ml)', v_p.volume; END IF;
  SELECT rendimento_util INTO v_rend FROM public.decant_perfume_config WHERE produto_id = p_produto_id;
  v_rend := COALESCE(v_rend, (public.fn__decant_cfg()->>'rendimento_padrao')::numeric, 100);
  v_custo := COALESCE(NULLIF(v_p.custo_medio,0), v_p.custo, 0);

  UPDATE public.decant_fechados_saldo SET quantidade = quantidade - 1, updated_at = now()
   WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id;

  v_codigo := 'FR-' || lpad(nextval('public.decant_frasco_seq')::text, 6, '0');
  INSERT INTO public.decant_frascos (codigo, produto_id, unidade_id, lote_fabricante, validade, volume_nominal_ml,
    volume_inicial_ml, custo, rendimento_util, custo_ml, responsavel, aberto_por, aberto_por_nome, observacao, idempotency_key)
  VALUES (v_codigo, p_produto_id, p_unidade_id, COALESCE(p_lote_fabricante,''), p_validade, v_p.volume, v_ini, v_custo,
    v_rend, public.fn_decant_custo_ml(v_custo, v_p.volume, v_rend), COALESCE(p_responsavel,''), auth.uid(), v_user,
    COALESCE(p_observacao,''), p_idempotency_key)
  RETURNING id INTO v_id;

  INSERT INTO public.decant_fechados_mov (produto_id, unidade_id, tipo, quantidade, saldo_apos, frasco_id, responsavel, observacao, usuario_id, usuario_nome)
  VALUES (p_produto_id, p_unidade_id, 'abertura', -1, v_fech - 1, v_id, COALESCE(p_responsavel,''), 'Aberto como ' || v_codigo, auth.uid(), v_user);

  INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, usuario_id, usuario_nome)
  VALUES (v_id, p_unidade_id, 'abertura', v_ini, v_ini, 'Abertura do frasco', auth.uid(), v_user);

  PERFORM public.fn_audit('decant_abrir_frasco','decant_frascos',v_id,p_unidade_id,NULL,
    jsonb_build_object('codigo',v_codigo,'volume_inicial',v_ini,'custo',v_custo),'');
  RETURN jsonb_build_object('frasco_id', v_id, 'codigo', v_codigo, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_registrar_saida(p_frasco_id uuid, p_tipo text, p_ml numeric, p_motivo text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f public.decant_frascos; v_saldo numeric; v_user text := public.fn__nome_usuario(); v_prev public.decant_ml_ledger;
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
  IF p_ml > v_saldo THEN RAISE EXCEPTION 'Saldo insuficiente no frasco: disponível % ml', v_saldo; END IF;
  INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, idempotency_key, usuario_id, usuario_nome)
  VALUES (p_frasco_id, v_f.unidade_id, p_tipo, -p_ml, v_saldo - p_ml, COALESCE(p_motivo,''), p_idempotency_key, auth.uid(), v_user);
  RETURN jsonb_build_object('saldo', v_saldo - p_ml, 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_conferir(p_frasco_id uuid, p_saldo_fisico numeric, p_justificativa text, p_acao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f public.decant_frascos; v_teo numeric; v_dif numeric; v_tol numeric; v_id uuid; v_user text := public.fn__nome_usuario();
  v_status text; v_acao text := COALESCE(p_acao,'manter_pendente');
BEGIN
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = p_frasco_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frasco não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_f.unidade_id,'decant.conferir');
  IF p_saldo_fisico IS NULL OR p_saldo_fisico < 0 THEN RAISE EXCEPTION 'Saldo físico inválido'; END IF;
  IF v_acao NOT IN ('ajuste','perda','manter_pendente') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  v_teo := public.fn_decant_saldo_frasco(p_frasco_id);
  IF v_acao = 'perda' AND p_saldo_fisico > v_teo THEN
    RAISE EXCEPTION 'Perda só se aplica quando o saldo físico é menor que o teórico';
  END IF;
  v_dif := p_saldo_fisico - v_teo;
  v_tol := COALESCE((public.fn__decant_cfg()->>'tolerancia_ml')::numeric, 0);

  IF v_dif = 0 THEN
    v_status := 'ok'; v_acao := 'nenhuma';
  ELSIF abs(v_dif) <= v_tol THEN
    v_status := 'aprovada'; v_acao := 'ajuste';
  ELSE
    IF COALESCE(trim(p_justificativa),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para divergência'; END IF;
    v_status := 'pendente';
  END IF;

  INSERT INTO public.decant_conferencias (frasco_id, unidade_id, saldo_teorico, saldo_fisico, diferenca, status, acao,
    justificativa, executado_por, executado_por_nome, aprovado_em, decisao_obs)
  VALUES (p_frasco_id, v_f.unidade_id, v_teo, p_saldo_fisico, v_dif, v_status, v_acao, COALESCE(p_justificativa,''),
    auth.uid(), v_user, CASE WHEN v_status='aprovada' THEN now() END,
    CASE WHEN v_status='aprovada' THEN 'Ajuste automático dentro da tolerância' ELSE '' END)
  RETURNING id INTO v_id;

  IF v_status = 'aprovada' THEN
    INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
    VALUES (p_frasco_id, v_f.unidade_id, 'ajuste', v_dif, p_saldo_fisico, 'Conferência dentro da tolerância', 'conferencia', v_id, auth.uid(), v_user);
  END IF;
  RETURN jsonb_build_object('conferencia_id', v_id, 'status', v_status, 'saldo_teorico', v_teo, 'diferenca', v_dif);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_decidir_conferencia(p_conferencia_id uuid, p_aprovar boolean, p_acao text, p_obs text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c public.decant_conferencias; v_saldo numeric; v_user text := public.fn__nome_usuario(); v_acao text;
BEGIN
  SELECT * INTO v_c FROM public.decant_conferencias WHERE id = p_conferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conferência não encontrada'; END IF;
  PERFORM public.fn__decant_exigir(v_c.unidade_id,'decant.aprovar_divergencia');
  IF v_c.status <> 'pendente' THEN RAISE EXCEPTION 'Conferência já decidida'; END IF;
  IF NOT p_aprovar THEN
    UPDATE public.decant_conferencias SET status='rejeitada', aprovado_por=auth.uid(), aprovado_por_nome=v_user,
      aprovado_em=now(), decisao_obs=COALESCE(p_obs,''), updated_at=now() WHERE id = v_c.id;
    RETURN jsonb_build_object('status','rejeitada');
  END IF;
  v_acao := COALESCE(NULLIF(p_acao,''), NULLIF(v_c.acao,'manter_pendente'), 'ajuste');
  IF v_acao NOT IN ('ajuste','perda') THEN RAISE EXCEPTION 'Escolha ajuste ou perda'; END IF;
  IF v_acao = 'perda' AND v_c.diferenca > 0 THEN RAISE EXCEPTION 'Perda só se aplica a diferença negativa'; END IF;
  PERFORM 1 FROM public.decant_frascos WHERE id = v_c.frasco_id FOR UPDATE;
  v_saldo := public.fn_decant_saldo_frasco(v_c.frasco_id);
  IF v_saldo + v_c.diferenca < 0 THEN RAISE EXCEPTION 'Ajuste deixaria o frasco com saldo negativo'; END IF;
  INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
  VALUES (v_c.frasco_id, v_c.unidade_id, v_acao, v_c.diferenca, v_saldo + v_c.diferenca,
    'Conferência aprovada: ' || v_c.justificativa, 'conferencia', v_c.id, auth.uid(), v_user);
  UPDATE public.decant_conferencias SET status='aprovada', acao=v_acao, aprovado_por=auth.uid(), aprovado_por_nome=v_user,
    aprovado_em=now(), decisao_obs=COALESCE(p_obs,''), updated_at=now() WHERE id = v_c.id;
  PERFORM public.fn_audit('decant_aprovar_conferencia','decant_conferencias',v_c.id,v_c.unidade_id,
    to_jsonb(v_c), jsonb_build_object('acao',v_acao,'saldo_apos',v_saldo + v_c.diferenca),'');
  RETURN jsonb_build_object('status','aprovada','saldo', v_saldo + v_c.diferenca);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_frascos_listar(p_unidade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.aberto_em), '[]'::jsonb) FROM (
    SELECT f.id, f.codigo, f.produto_id, p.codigo AS produto_codigo, p.marca, p.nome, p.concentracao, f.unidade_id,
      u.nome_exibicao AS unidade_nome, f.lote_fabricante, f.validade, f.volume_nominal_ml, f.volume_inicial_ml,
      f.custo, f.custo_ml, f.status, f.aberto_em, f.aberto_por_nome, f.responsavel,
      public.fn_decant_saldo_frasco(f.id) AS saldo_ml,
      (SELECT count(*) FROM public.decant_conferencias c WHERE c.frasco_id=f.id AND c.status='pendente') AS pendencias
    FROM public.decant_frascos f JOIN public.perfumes p ON p.id=f.produto_id JOIN public.unidades u ON u.id=f.unidade_id
    WHERE (p_unidade_id IS NULL OR f.unidade_id = p_unidade_id) AND public.fn__pode(f.unidade_id,'decant.ver')
  ) x
$$;

REVOKE EXECUTE ON FUNCTION public.fn_decant_destinar(uuid,uuid,integer,text,date,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_abrir_frasco(uuid,uuid,text,date,numeric,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_registrar_saida(uuid,text,numeric,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_conferir(uuid,numeric,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_decidir_conferencia(uuid,boolean,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_decant_frascos_listar(uuid) FROM anon;