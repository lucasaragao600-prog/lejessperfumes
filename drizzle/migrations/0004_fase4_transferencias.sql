-- FASE 4 — TRANSFERENCIAS ENTRE UNIDADES (aditivo e idempotente)

-- 1. Coluna de rastreio nas movimentacoes (aditiva, nullable)
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS transferencia_id uuid;
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS implantacao_id uuid;

-- 2. Sequencial anual seguro contra concorrencia
CREATE TABLE IF NOT EXISTS public.transferencia_sequencias (
  ano integer PRIMARY KEY,
  ultimo integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.transferencia_sequencias TO authenticated;
GRANT ALL ON public.transferencia_sequencias TO service_role;
ALTER TABLE public.transferencia_sequencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seq_leitura_autenticada" ON public.transferencia_sequencias;
CREATE POLICY "seq_leitura_autenticada" ON public.transferencia_sequencias
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_proximo_numero_transferencia()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Manaus'))::int;
  v_n integer;
BEGIN
  INSERT INTO public.transferencia_sequencias (ano, ultimo)
  VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = public.transferencia_sequencias.ultimo + 1
  RETURNING ultimo INTO v_n;
  RETURN 'TRF-' || v_ano::text || '-' || lpad(v_n::text, 6, '0');
END;
$$;

-- 3. Tabelas
CREATE TABLE IF NOT EXISTS public.transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  ano integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  origem_unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  destino_unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  implantacao_id uuid,
  status text NOT NULL DEFAULT 'RASCUNHO',
  observacao text NOT NULL DEFAULT '',
  transportador text NOT NULL DEFAULT '',
  criado_por uuid,
  criado_por_nome text NOT NULL DEFAULT '',
  separado_por uuid,
  separado_por_nome text,
  separado_em timestamptz,
  enviado_por uuid,
  enviado_por_nome text,
  enviado_em timestamptz,
  recebido_por uuid,
  recebido_por_nome text,
  recebido_em timestamptz,
  cancelado_motivo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_unidades_distintas CHECK (origem_unidade_id <> destino_unidade_id)
);

CREATE TABLE IF NOT EXISTS public.transferencia_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  produto_nome text NOT NULL DEFAULT '',
  quantidade_solicitada integer NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_separada integer,
  quantidade_enviada integer,
  quantidade_recebida integer,
  status text NOT NULL DEFAULT 'PENDENTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transferencia_id, produto_id)
);

CREATE TABLE IF NOT EXISTS public.transferencia_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhes text NOT NULL DEFAULT '',
  dados jsonb,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON public.transferencias(origem_unidade_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.transferencias(destino_unidade_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_status ON public.transferencias(status);
CREATE INDEX IF NOT EXISTS idx_transferencias_implantacao ON public.transferencias(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_itens_transf ON public.transferencia_itens(transferencia_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_eventos_transf ON public.transferencia_eventos(transferencia_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_transferencia ON public.movimentacoes(transferencia_id);

GRANT SELECT, INSERT, UPDATE ON public.transferencias TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transferencia_itens TO authenticated;
GRANT SELECT, INSERT ON public.transferencia_eventos TO authenticated;
GRANT ALL ON public.transferencias TO service_role;
GRANT ALL ON public.transferencia_itens TO service_role;
GRANT ALL ON public.transferencia_eventos TO service_role;

DROP TRIGGER IF EXISTS update_transferencias_updated_at ON public.transferencias;
CREATE TRIGGER update_transferencias_updated_at BEFORE UPDATE ON public.transferencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_transferencia_itens_updated_at ON public.transferencia_itens;
CREATE TRIGGER update_transferencia_itens_updated_at BEFORE UPDATE ON public.transferencia_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS por unidade
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transf_select" ON public.transferencias;
CREATE POLICY "transf_select" ON public.transferencias FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(origem_unidade_id) OR public.usuario_tem_acesso_unidade(destino_unidade_id));
DROP POLICY IF EXISTS "transf_insert" ON public.transferencias;
CREATE POLICY "transf_insert" ON public.transferencias FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_unidade(origem_unidade_id) OR public.usuario_tem_acesso_unidade(destino_unidade_id));
DROP POLICY IF EXISTS "transf_update" ON public.transferencias;
CREATE POLICY "transf_update" ON public.transferencias FOR UPDATE TO authenticated
  USING (public.usuario_tem_acesso_unidade(origem_unidade_id) OR public.usuario_tem_acesso_unidade(destino_unidade_id));

DROP POLICY IF EXISTS "transf_itens_all" ON public.transferencia_itens;
CREATE POLICY "transf_itens_all" ON public.transferencia_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transferencias t WHERE t.id = transferencia_id
    AND (public.usuario_tem_acesso_unidade(t.origem_unidade_id) OR public.usuario_tem_acesso_unidade(t.destino_unidade_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transferencias t WHERE t.id = transferencia_id
    AND (public.usuario_tem_acesso_unidade(t.origem_unidade_id) OR public.usuario_tem_acesso_unidade(t.destino_unidade_id))));

DROP POLICY IF EXISTS "transf_eventos_select" ON public.transferencia_eventos;
CREATE POLICY "transf_eventos_select" ON public.transferencia_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transferencias t WHERE t.id = transferencia_id
    AND (public.usuario_tem_acesso_unidade(t.origem_unidade_id) OR public.usuario_tem_acesso_unidade(t.destino_unidade_id))));
DROP POLICY IF EXISTS "transf_eventos_insert" ON public.transferencia_eventos;
CREATE POLICY "transf_eventos_insert" ON public.transferencia_eventos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transferencias t WHERE t.id = transferencia_id
    AND (public.usuario_tem_acesso_unidade(t.origem_unidade_id) OR public.usuario_tem_acesso_unidade(t.destino_unidade_id))));

-- 5. Helpers
CREATE OR REPLACE FUNCTION public.fn_transf_evento(p_transferencia_id uuid, p_evento text, p_detalhes text DEFAULT '', p_dados jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.transferencia_eventos (transferencia_id, evento, detalhes, dados, usuario_id, usuario_nome)
  VALUES (p_transferencia_id, p_evento, COALESCE(p_detalhes, ''), p_dados, auth.uid(), COALESCE(v_nome, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_transf_validar_rota(p_origem uuid, p_destino uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uo public.unidades; ud public.unidades;
BEGIN
  SELECT * INTO uo FROM public.unidades WHERE id = p_origem;
  SELECT * INTO ud FROM public.unidades WHERE id = p_destino;
  IF uo.id IS NULL OR ud.id IS NULL THEN RAISE EXCEPTION 'Unidade de origem ou destino não encontrada'; END IF;
  IF uo.id = ud.id THEN RAISE EXCEPTION 'Origem e destino devem ser diferentes'; END IF;
  IF uo.status = 'INATIVA' OR ud.status = 'INATIVA' THEN
    RAISE EXCEPTION 'Unidade inativa não participa de transferências.';
  END IF;
  IF uo.status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO') THEN
    RAISE EXCEPTION 'Unidade % está em implantação e não pode enviar transferências.', uo.nome_exibicao;
  END IF;
  IF NOT uo.permite_transferencia OR NOT ud.permite_transferencia THEN
    RAISE EXCEPTION 'Transferência não permitida entre % e %.', uo.nome_exibicao, ud.nome_exibicao;
  END IF;
END;
$$;

-- 6. Criar transferencia (RASCUNHO)
CREATE OR REPLACE FUNCTION public.fn_transferencia_criar(
  p_origem uuid, p_destino uuid, p_itens jsonb,
  p_observacao text DEFAULT '', p_implantacao_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid; v_nome text; v_item jsonb;
BEGIN
  IF NOT public.usuario_tem_permissao(p_origem, 'estoque.transferir') THEN
    RAISE EXCEPTION 'Sem permissão para transferir estoque nesta unidade.';
  END IF;
  PERFORM public.fn_transf_validar_rota(p_origem, p_destino);
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um produto na transferência.';
  END IF;

  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.transferencias (numero, ano, origem_unidade_id, destino_unidade_id, implantacao_id, status, observacao, criado_por, criado_por_nome)
  VALUES (public.fn_proximo_numero_transferencia(),
          EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Manaus'))::int,
          p_origem, p_destino, p_implantacao_id, 'RASCUNHO', COALESCE(p_observacao,''), auth.uid(), COALESCE(v_nome,''))
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    INSERT INTO public.transferencia_itens (transferencia_id, produto_id, produto_nome, quantidade_solicitada)
    VALUES (v_id, (v_item->>'produto_id')::uuid,
            COALESCE(v_item->>'produto_nome', ''), (v_item->>'quantidade')::int)
    ON CONFLICT (transferencia_id, produto_id) DO UPDATE
      SET quantidade_solicitada = public.transferencia_itens.quantidade_solicitada + EXCLUDED.quantidade_solicitada;
  END LOOP;

  PERFORM public.fn_transf_evento(v_id, 'CRIADA', 'Transferência criada em rascunho');
  RETURN v_id;
END;
$$;

-- 7. Confirmar para separacao (reserva estoque)
CREATE OR REPLACE FUNCTION public.fn_transferencia_confirmar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias; it record; v_disp integer; v_ok uuid;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  IF t.status <> 'RASCUNHO' THEN RAISE EXCEPTION 'Somente rascunhos podem ser confirmados.'; END IF;
  IF NOT public.usuario_tem_permissao(t.origem_unidade_id, 'estoque.transferir') THEN
    RAISE EXCEPTION 'Sem permissão para transferir estoque nesta unidade.';
  END IF;
  PERFORM public.fn_transf_validar_rota(t.origem_unidade_id, t.destino_unidade_id);

  FOR it IN SELECT * FROM public.transferencia_itens WHERE transferencia_id = p_id LOOP
    UPDATE public.estoque_unidades
       SET quantidade_reservada = quantidade_reservada + it.quantidade_solicitada,
           updated_at = now()
     WHERE produto_id = it.produto_id
       AND unidade_id = t.origem_unidade_id
       AND quantidade - quantidade_reservada >= it.quantidade_solicitada
    RETURNING id INTO v_ok;

    IF v_ok IS NULL THEN
      SELECT COALESCE(quantidade - quantidade_reservada, 0) INTO v_disp
        FROM public.estoque_unidades WHERE produto_id = it.produto_id AND unidade_id = t.origem_unidade_id;
      RAISE EXCEPTION 'Quantidade superior ao estoque disponível na unidade de origem. Disponível: % unidades.', COALESCE(v_disp, 0);
    END IF;
    v_ok := NULL;
  END LOOP;

  UPDATE public.transferencias SET status = 'AGUARDANDO_SEPARACAO' WHERE id = p_id;
  PERFORM public.fn_transf_evento(p_id, 'CONFIRMADA', 'Estoque reservado na origem');
END;
$$;

-- 8. Separacao
CREATE OR REPLACE FUNCTION public.fn_transferencia_separar_item(p_item_id uuid, p_quantidade integer, p_autorizado boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE it public.transferencia_itens; t public.transferencias; v_nome text;
BEGIN
  SELECT * INTO it FROM public.transferencia_itens WHERE id = p_item_id FOR UPDATE;
  IF it.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  SELECT * INTO t FROM public.transferencias WHERE id = it.transferencia_id FOR UPDATE;
  IF t.status NOT IN ('AGUARDANDO_SEPARACAO','EM_SEPARACAO') THEN
    RAISE EXCEPTION 'Transferência não está em separação.';
  END IF;
  IF NOT public.usuario_tem_permissao(t.origem_unidade_id, 'reposicao.separar') THEN
    RAISE EXCEPTION 'Sem permissão para separar nesta unidade.';
  END IF;
  IF p_quantidade < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF p_quantidade > it.quantidade_solicitada AND NOT p_autorizado THEN
    RAISE EXCEPTION 'Quantidade separada acima do solicitado (%). Necessária autorização.', it.quantidade_solicitada;
  END IF;

  UPDATE public.transferencia_itens
     SET quantidade_separada = p_quantidade,
         status = CASE WHEN p_quantidade = 0 THEN 'PENDENTE' ELSE 'SEPARADO' END
   WHERE id = p_item_id;

  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  UPDATE public.transferencias
     SET status = 'EM_SEPARACAO', separado_por = auth.uid(), separado_por_nome = COALESCE(v_nome,''), separado_em = now()
   WHERE id = t.id AND status = 'AGUARDANDO_SEPARACAO';

  PERFORM public.fn_transf_evento(t.id, 'ITEM_SEPARADO', it.produto_nome || ': ' || p_quantidade::text,
    jsonb_build_object('item_id', p_item_id, 'quantidade', p_quantidade));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_transferencia_finalizar_separacao(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias; v_pend integer;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.status NOT IN ('AGUARDANDO_SEPARACAO','EM_SEPARACAO') THEN RAISE EXCEPTION 'Transferência não está em separação.'; END IF;
  IF NOT public.usuario_tem_permissao(t.origem_unidade_id, 'reposicao.separar') THEN
    RAISE EXCEPTION 'Sem permissão para separar nesta unidade.';
  END IF;
  SELECT count(*) INTO v_pend FROM public.transferencia_itens WHERE transferencia_id = p_id AND quantidade_separada IS NULL;
  IF v_pend > 0 THEN RAISE EXCEPTION 'Existem % itens sem separação registrada.', v_pend; END IF;
  UPDATE public.transferencias SET status = 'PRONTO_PARA_ENVIO' WHERE id = p_id;
  PERFORM public.fn_transf_evento(p_id, 'SEPARACAO_CONCLUIDA', 'Separação concluída');
END;
$$;

-- 9. Expedicao
CREATE OR REPLACE FUNCTION public.fn_transferencia_enviar(p_id uuid, p_transportador text DEFAULT '', p_observacao text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias; v_nome text; it record; v_delta integer;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.status <> 'PRONTO_PARA_ENVIO' THEN RAISE EXCEPTION 'Transferência não está pronta para envio.'; END IF;
  IF NOT public.usuario_tem_permissao(t.origem_unidade_id, 'reposicao.enviar') THEN
    RAISE EXCEPTION 'Sem permissão para enviar nesta unidade.';
  END IF;

  -- ajusta reservas para a quantidade realmente enviada
  FOR it IN SELECT * FROM public.transferencia_itens WHERE transferencia_id = p_id LOOP
    v_delta := COALESCE(it.quantidade_separada, 0) - it.quantidade_solicitada;
    IF v_delta <> 0 THEN
      UPDATE public.estoque_unidades
         SET quantidade_reservada = GREATEST(quantidade_reservada + v_delta, 0), updated_at = now()
       WHERE produto_id = it.produto_id AND unidade_id = t.origem_unidade_id
         AND (v_delta < 0 OR quantidade - quantidade_reservada >= v_delta);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Estoque disponível insuficiente para enviar % acima do reservado.', it.produto_nome;
      END IF;
    END IF;
    UPDATE public.transferencia_itens
       SET quantidade_enviada = COALESCE(it.quantidade_separada, 0), status = 'ENVIADO'
     WHERE id = it.id;
  END LOOP;

  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  UPDATE public.transferencias
     SET status = 'EM_TRANSITO', enviado_por = auth.uid(), enviado_por_nome = COALESCE(v_nome,''), enviado_em = now(),
         transportador = COALESCE(NULLIF(p_transportador,''), transportador),
         observacao = CASE WHEN COALESCE(p_observacao,'') = '' THEN observacao ELSE observacao || E'\n' || p_observacao END
   WHERE id = p_id;
  PERFORM public.fn_transf_evento(p_id, 'ENVIADA', 'Transferência despachada', jsonb_build_object('transportador', p_transportador));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_transferencia_iniciar_conferencia(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.status <> 'EM_TRANSITO' THEN RAISE EXCEPTION 'Transferência não está em trânsito.'; END IF;
  IF NOT public.usuario_tem_permissao(t.destino_unidade_id, 'reposicao.receber') THEN
    RAISE EXCEPTION 'Sem permissão para receber nesta unidade.';
  END IF;
  UPDATE public.transferencias SET status = 'AGUARDANDO_CONFERENCIA' WHERE id = p_id;
  PERFORM public.fn_transf_evento(p_id, 'CONFERENCIA_INICIADA', 'Chegada registrada no destino');
END;
$$;

-- 10. Conclusao transacional interna
CREATE OR REPLACE FUNCTION public.fn_transf_concluir_interna(p_id uuid, p_modo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.transferencias; it record; v_nome text;
  v_baixa integer; v_entrada integer; v_perda integer; v_ok uuid;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

  FOR it IN SELECT * FROM public.transferencia_itens WHERE transferencia_id = p_id LOOP
    v_entrada := COALESCE(it.quantidade_recebida, 0);
    IF p_modo = 'PERDA' THEN
      v_baixa := COALESCE(it.quantidade_enviada, 0);
      v_perda := v_baixa - v_entrada;
    ELSE
      v_baixa := v_entrada;
      v_perda := 0;
    END IF;

    -- origem: baixa fisica + liberacao total da reserva do item
    UPDATE public.estoque_unidades
       SET quantidade = quantidade - v_baixa,
           quantidade_reservada = GREATEST(quantidade_reservada - COALESCE(it.quantidade_enviada, 0), 0),
           data_ultima_saida = CASE WHEN v_baixa > 0 THEN now() ELSE data_ultima_saida END,
           updated_at = now()
     WHERE produto_id = it.produto_id AND unidade_id = t.origem_unidade_id
       AND quantidade >= v_baixa
    RETURNING id INTO v_ok;
    IF v_ok IS NULL THEN
      RAISE EXCEPTION 'Estoque insuficiente na origem para concluir a transferência (%).', it.produto_nome;
    END IF;
    v_ok := NULL;

    IF v_entrada > 0 THEN
      INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, data_ultima_entrada)
      VALUES (it.produto_id, t.destino_unidade_id, v_entrada, now())
      ON CONFLICT (produto_id, unidade_id) DO UPDATE
        SET quantidade = public.estoque_unidades.quantidade + EXCLUDED.quantidade,
            data_ultima_entrada = now(), updated_at = now();

      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito_origem, deposito_destino,
        quantidade, observacao, registrado_por, unidade_origem_id, unidade_destino_id, unidade_id, transferencia_id, implantacao_id)
      SELECT (now() AT TIME ZONE 'America/Manaus')::date, 'TRANSFERENCIA_SAIDA', it.produto_id, it.produto_nome,
             uo.codigo_legado, ud.codigo_legado, v_baixa, t.numero, COALESCE(v_nome,''),
             t.origem_unidade_id, t.destino_unidade_id, t.origem_unidade_id, t.id, t.implantacao_id
        FROM public.unidades uo, public.unidades ud
       WHERE uo.id = t.origem_unidade_id AND ud.id = t.destino_unidade_id AND v_baixa > 0;

      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito_origem, deposito_destino,
        quantidade, observacao, registrado_por, unidade_origem_id, unidade_destino_id, unidade_id, transferencia_id, implantacao_id)
      SELECT (now() AT TIME ZONE 'America/Manaus')::date, 'TRANSFERENCIA_ENTRADA', it.produto_id, it.produto_nome,
             uo.codigo_legado, ud.codigo_legado, v_entrada, t.numero, COALESCE(v_nome,''),
             t.origem_unidade_id, t.destino_unidade_id, t.destino_unidade_id, t.id, t.implantacao_id
        FROM public.unidades uo, public.unidades ud
       WHERE uo.id = t.origem_unidade_id AND ud.id = t.destino_unidade_id;
    END IF;

    IF v_perda > 0 THEN
      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao,
        registrado_por, unidade_id, unidade_origem_id, transferencia_id, implantacao_id)
      SELECT (now() AT TIME ZONE 'America/Manaus')::date, 'PERDA_TRANSFERENCIA', it.produto_id, it.produto_nome,
             uo.codigo_legado, v_perda, t.numero || ' - perda em trânsito', COALESCE(v_nome,''),
             t.origem_unidade_id, t.origem_unidade_id, t.id, t.implantacao_id
        FROM public.unidades uo WHERE uo.id = t.origem_unidade_id;
    END IF;

    PERFORM public.fn_sync_estoque_legado(it.produto_id, t.origem_unidade_id);
    PERFORM public.fn_sync_estoque_legado(it.produto_id, t.destino_unidade_id);

    UPDATE public.transferencia_itens SET status = 'RECEBIDO' WHERE id = it.id;
  END LOOP;

  UPDATE public.transferencias
     SET status = 'RECEBIDO', recebido_por = auth.uid(), recebido_por_nome = COALESCE(v_nome,''), recebido_em = now()
   WHERE id = p_id;
END;
$$;

-- 11. Recebimento com conferencia
CREATE OR REPLACE FUNCTION public.fn_transferencia_receber(p_id uuid, p_conferencias jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias; v_item jsonb; v_div integer;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  IF t.status NOT IN ('EM_TRANSITO','AGUARDANDO_CONFERENCIA') THEN
    RAISE EXCEPTION 'Transferência não está disponível para conferência.';
  END IF;
  IF NOT public.usuario_tem_permissao(t.destino_unidade_id, 'reposicao.receber') THEN
    RAISE EXCEPTION 'Sem permissão para receber nesta unidade.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_conferencias) LOOP
    UPDATE public.transferencia_itens
       SET quantidade_recebida = GREATEST((v_item->>'quantidade')::int, 0),
           status = 'CONFERIDO'
     WHERE id = (v_item->>'item_id')::uuid AND transferencia_id = p_id;
  END LOOP;

  UPDATE public.transferencia_itens SET quantidade_recebida = 0, status = 'CONFERIDO'
   WHERE transferencia_id = p_id AND quantidade_recebida IS NULL;

  SELECT count(*) INTO v_div FROM public.transferencia_itens
   WHERE transferencia_id = p_id AND COALESCE(quantidade_recebida,0) <> COALESCE(quantidade_enviada,0);

  IF v_div > 0 THEN
    UPDATE public.transferencias SET status = 'AGUARDANDO_TRATAMENTO' WHERE id = p_id;
    PERFORM public.fn_transf_evento(p_id, 'DIVERGENCIA_CRIADA', v_div::text || ' item(ns) com diferença');
    RETURN 'AGUARDANDO_TRATAMENTO';
  END IF;

  PERFORM public.fn_transf_concluir_interna(p_id, 'NORMAL');
  PERFORM public.fn_transf_evento(p_id, 'RECEBIDA', 'Recebida sem divergência');
  RETURN 'RECEBIDO';
END;
$$;

-- 12. Resolucao de divergencia
CREATE OR REPLACE FUNCTION public.fn_transferencia_resolver_divergencia(p_id uuid, p_resolucao text, p_justificativa text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias; v_novo uuid; v_itens jsonb; it record;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  IF t.status <> 'AGUARDANDO_TRATAMENTO' THEN RAISE EXCEPTION 'Transferência não possui divergência em aberto.'; END IF;
  IF NOT public.usuario_tem_permissao(t.destino_unidade_id, 'reposicao.aprovar_divergencia') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar divergências.';
  END IF;
  IF COALESCE(btrim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'Justificativa é obrigatória.'; END IF;

  IF p_resolucao = 'RECONTAR' THEN
    UPDATE public.transferencias SET status = 'AGUARDANDO_CONFERENCIA' WHERE id = p_id;
    UPDATE public.transferencia_itens SET quantidade_recebida = NULL, status = 'ENVIADO' WHERE transferencia_id = p_id;
    PERFORM public.fn_transf_evento(p_id, 'DIVERGENCIA_RESOLVIDA', 'RECONTAR: ' || p_justificativa);
    RETURN 'AGUARDANDO_CONFERENCIA';

  ELSIF p_resolucao = 'CORRIGIR_EXPEDICAO' THEN
    UPDATE public.transferencia_itens SET quantidade_enviada = COALESCE(quantidade_recebida, 0) WHERE transferencia_id = p_id;
    PERFORM public.fn_transf_concluir_interna(p_id, 'NORMAL');
    PERFORM public.fn_transf_evento(p_id, 'DIVERGENCIA_RESOLVIDA', 'CORRIGIR_EXPEDICAO: ' || p_justificativa);
    RETURN 'RECEBIDO';

  ELSIF p_resolucao = 'CONFIRMAR_DIFERENCA' THEN
    PERFORM public.fn_transf_concluir_interna(p_id, 'NORMAL');
    PERFORM public.fn_transf_evento(p_id, 'DIVERGENCIA_RESOLVIDA', 'CONFIRMAR_DIFERENCA: ' || p_justificativa);
    RETURN 'RECEBIDO';

  ELSIF p_resolucao = 'REGISTRAR_PERDA' THEN
    PERFORM public.fn_transf_concluir_interna(p_id, 'PERDA');
    PERFORM public.fn_transf_evento(p_id, 'DIVERGENCIA_RESOLVIDA', 'REGISTRAR_PERDA: ' || p_justificativa);
    RETURN 'RECEBIDO';

  ELSIF p_resolucao = 'DEVOLVER_ITEM' THEN
    SELECT jsonb_agg(jsonb_build_object('produto_id', produto_id, 'produto_nome', produto_nome,
                                        'quantidade', COALESCE(quantidade_recebida,0) - COALESCE(quantidade_enviada,0)))
      INTO v_itens
      FROM public.transferencia_itens
     WHERE transferencia_id = p_id AND COALESCE(quantidade_recebida,0) > COALESCE(quantidade_enviada,0);

    PERFORM public.fn_transf_concluir_interna(p_id, 'NORMAL');
    PERFORM public.fn_transf_evento(p_id, 'DIVERGENCIA_RESOLVIDA', 'DEVOLVER_ITEM: ' || p_justificativa);

    IF v_itens IS NOT NULL THEN
      v_novo := public.fn_transferencia_criar(t.destino_unidade_id, t.origem_unidade_id, v_itens,
                 'Devolução referente à ' || t.numero, t.implantacao_id);
      PERFORM public.fn_transf_evento(p_id, 'DEVOLUCAO_GERADA', 'Transferência inversa criada',
        jsonb_build_object('transferencia_devolucao', v_novo));
    END IF;
    RETURN 'RECEBIDO';
  END IF;

  RAISE EXCEPTION 'Resolução inválida: %', p_resolucao;
END;
$$;

-- 13. Cancelamento (libera reservas)
CREATE OR REPLACE FUNCTION public.fn_transferencia_cancelar(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t public.transferencias; it record;
BEGIN
  SELECT * INTO t FROM public.transferencias WHERE id = p_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Transferência não encontrada'; END IF;
  IF t.status IN ('RECEBIDO','CANCELADA') THEN RAISE EXCEPTION 'Transferência já finalizada.'; END IF;
  IF NOT public.usuario_tem_permissao(t.origem_unidade_id, 'estoque.transferir') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta transferência.';
  END IF;
  IF COALESCE(btrim(p_motivo), '') = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento.'; END IF;

  IF t.status <> 'RASCUNHO' THEN
    FOR it IN SELECT * FROM public.transferencia_itens WHERE transferencia_id = p_id LOOP
      UPDATE public.estoque_unidades
         SET quantidade_reservada = GREATEST(quantidade_reservada - COALESCE(it.quantidade_enviada, it.quantidade_solicitada), 0),
             updated_at = now()
       WHERE produto_id = it.produto_id AND unidade_id = t.origem_unidade_id;
    END LOOP;
  END IF;

  UPDATE public.transferencias SET status = 'CANCELADA', cancelado_motivo = p_motivo WHERE id = p_id;
  PERFORM public.fn_transf_evento(p_id, 'CANCELADA', p_motivo);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_proximo_numero_transferencia() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transf_evento(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transf_validar_rota(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transf_concluir_interna(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_criar(uuid, uuid, jsonb, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_confirmar(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_separar_item(uuid, integer, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_finalizar_separacao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_enviar(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_iniciar_conferencia(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_receber(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_resolver_divergencia(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_transferencia_cancelar(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_transferencia_criar(uuid, uuid, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_confirmar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_separar_item(uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_finalizar_separacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_enviar(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_iniciar_conferencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_receber(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_resolver_divergencia(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferencia_cancelar(uuid, text) TO authenticated;