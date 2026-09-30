-- Colunas aditivas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cancelada boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_vendas_grupo_venda ON public.vendas(grupo_venda);
CREATE INDEX IF NOT EXISTS idx_venda_pagamentos_grupo ON public.venda_pagamentos(grupo_venda);

-- Tabelas
CREATE TABLE IF NOT EXISTS public.venda_cancelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_venda uuid NOT NULL UNIQUE,
  unidade_id uuid REFERENCES public.unidades(id),
  motivo text NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  caixa_fechado boolean NOT NULL DEFAULT false,
  sessao_caixa_ajuste_id uuid REFERENCES public.caixa_sessoes(id),
  cancelado_por uuid,
  cancelado_por_nome text NOT NULL DEFAULT '',
  aprovado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venda_cancel_unidade ON public.venda_cancelamentos(unidade_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.devolucao_sequencias (
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  ano integer NOT NULL,
  ultimo integer NOT NULL DEFAULT 0,
  PRIMARY KEY (unidade_id, ano)
);

CREATE TABLE IF NOT EXISTS public.devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  ano integer NOT NULL,
  grupo_venda_origem uuid NOT NULL,
  grupo_venda_troca uuid,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  cliente_id uuid REFERENCES public.clientes(id),
  motivo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('devolucao','troca')),
  status text NOT NULL DEFAULT 'concluida',
  valor_total numeric NOT NULL DEFAULT 0,
  valor_troca numeric NOT NULL DEFAULT 0,
  diferenca numeric NOT NULL DEFAULT 0,
  forma_reembolso text CHECK (forma_reembolso IN ('dinheiro','estorno_cartao','pix','credito_loja','vale_troca')),
  fora_do_prazo boolean NOT NULL DEFAULT false,
  sessao_caixa_id uuid REFERENCES public.caixa_sessoes(id),
  registrado_por uuid,
  registrado_por_nome text NOT NULL DEFAULT '',
  aprovado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_devolucoes_origem ON public.devolucoes(grupo_venda_origem);
CREATE INDEX IF NOT EXISTS idx_devolucoes_unidade ON public.devolucoes(unidade_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.devolucao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id uuid NOT NULL REFERENCES public.devolucoes(id),
  venda_id uuid NOT NULL REFERENCES public.vendas(id),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  produto_nome text NOT NULL DEFAULT '',
  quantidade integer NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0,
  volta_ao_estoque boolean NOT NULL DEFAULT true,
  destino text NOT NULL DEFAULT 'estoque' CHECK (destino IN ('estoque','avaria','tester')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devolucao_itens_venda ON public.devolucao_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_devolucao_itens_dev ON public.devolucao_itens(devolucao_id);

CREATE TABLE IF NOT EXISTS public.credito_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id),
  saldo numeric NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  validade date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credito_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  unidade_id uuid REFERENCES public.unidades(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','uso')),
  valor numeric NOT NULL CHECK (valor > 0),
  saldo_apos numeric NOT NULL,
  devolucao_id uuid REFERENCES public.devolucoes(id),
  grupo_venda uuid,
  observacao text NOT NULL DEFAULT '',
  registrado_por uuid,
  registrado_por_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credito_mov_cliente ON public.credito_movimentos(cliente_id, created_at DESC);

-- Grants (escrita somente via RPC)
GRANT SELECT ON public.venda_cancelamentos, public.devolucoes, public.devolucao_itens, public.credito_cliente, public.credito_movimentos TO authenticated;
GRANT ALL ON public.venda_cancelamentos, public.devolucoes, public.devolucao_itens, public.credito_cliente, public.credito_movimentos, public.devolucao_sequencias TO service_role;

ALTER TABLE public.venda_cancelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucao_sequencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancelamentos por unidade" ON public.venda_cancelamentos;
CREATE POLICY "cancelamentos por unidade" ON public.venda_cancelamentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(unidade_id));
DROP POLICY IF EXISTS "devolucoes por unidade" ON public.devolucoes;
CREATE POLICY "devolucoes por unidade" ON public.devolucoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(unidade_id));
DROP POLICY IF EXISTS "devolucao itens por unidade" ON public.devolucao_itens;
CREATE POLICY "devolucao itens por unidade" ON public.devolucao_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devolucoes d WHERE d.id = devolucao_id
    AND (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(d.unidade_id))));
DROP POLICY IF EXISTS "credito usuarios com unidade" ON public.credito_cliente;
CREATE POLICY "credito usuarios com unidade" ON public.credito_cliente FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR EXISTS (SELECT 1 FROM public.usuario_unidades uu WHERE uu.usuario_id = auth.uid() AND uu.ativo));
DROP POLICY IF EXISTS "credito mov usuarios com unidade" ON public.credito_movimentos;
CREATE POLICY "credito mov usuarios com unidade" ON public.credito_movimentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR EXISTS (SELECT 1 FROM public.usuario_unidades uu WHERE uu.usuario_id = auth.uid() AND uu.ativo));

-- Permissões e configuração
INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
  ('venda.devolver','venda','Registrar devolução de itens'),
  ('venda.trocar','venda','Registrar troca de itens'),
  ('venda.cancelar_caixa_fechado','venda','Cancelar venda de caixa já fechado'),
  ('venda.devolver_fora_prazo','venda','Aprovar devolução fora do prazo'),
  ('credito.gerenciar','credito','Gerenciar crédito de clientes')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.configuracoes (chave, valor) VALUES
  ('devolucao_prazo_dias', '30'::jsonb),
  ('credito_validade_dias', '180'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Helpers internos
CREATE OR REPLACE FUNCTION public.fn__pode(_unidade_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.usuario_tem_permissao(_unidade_id, _perm)
    OR (public.usuario_tem_acesso_unidade(_unidade_id) AND public.has_permission(auth.uid(), _perm))
  );
$$;

CREATE OR REPLACE FUNCTION public.fn__nome_usuario()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), '');
$$;

CREATE OR REPLACE FUNCTION public.fn__hoje_manaus()
RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Manaus')::date $$;

CREATE OR REPLACE FUNCTION public.fn__estoque_entrada(_produto uuid, _unidade uuid, _qtd integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, data_ultima_entrada)
  VALUES (_produto, _unidade, _qtd, now())
  ON CONFLICT (produto_id, unidade_id) DO UPDATE
    SET quantidade = public.estoque_unidades.quantidade + EXCLUDED.quantidade,
        data_ultima_entrada = now(), updated_at = now();
  PERFORM public.fn_sync_estoque_legado(_produto, _unidade);
END $$;

CREATE OR REPLACE FUNCTION public.fn__caixa_aberto(_unidade uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.caixa_sessoes WHERE unidade_id = _unidade AND status = 'aberto'
  ORDER BY (operador_id = auth.uid()) DESC, aberto_em DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn__credito_entrada(_cliente uuid, _unidade uuid, _valor numeric, _devolucao uuid, _obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dias int; v_saldo numeric;
BEGIN
  SELECT COALESCE((valor #>> '{}')::int, 180) INTO v_dias FROM public.configuracoes WHERE chave = 'credito_validade_dias';
  v_dias := COALESCE(v_dias, 180);
  INSERT INTO public.credito_cliente (cliente_id, saldo, validade)
  VALUES (_cliente, _valor, public.fn__hoje_manaus() + v_dias)
  ON CONFLICT (cliente_id) DO UPDATE SET saldo = public.credito_cliente.saldo + EXCLUDED.saldo,
    validade = GREATEST(COALESCE(public.credito_cliente.validade, EXCLUDED.validade), EXCLUDED.validade), updated_at = now()
  RETURNING saldo INTO v_saldo;
  INSERT INTO public.credito_movimentos (cliente_id, unidade_id, tipo, valor, saldo_apos, devolucao_id, observacao, registrado_por, registrado_por_nome)
  VALUES (_cliente, _unidade, 'entrada', _valor, v_saldo, _devolucao, _obs, auth.uid(), public.fn__nome_usuario());
END $$;

-- Núcleo de devolução (interno)
CREATE OR REPLACE FUNCTION public.fn__devolucao_core(p_grupo uuid, p_itens jsonb, p_motivo text, p_tipo text,
  p_forma text, p_cliente uuid, OUT o_id uuid, OUT o_valor numeric, OUT o_unidade uuid, OUT o_numero text, OUT o_sessao uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first public.vendas; u public.unidades; v public.vendas; it jsonb;
  v_prazo int; v_fora boolean := false; v_ano int; v_seq int; v_qtd int; v_ja int;
  v_destino text; v_valor_unit numeric; v_nome text := public.fn__nome_usuario(); v_perm text;
  v_marca text; v_custo numeric; v_tester uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um item'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('venda:' || p_grupo::text));
  SELECT * INTO v_first FROM public.vendas WHERE grupo_venda = p_grupo ORDER BY created_at LIMIT 1;
  IF v_first.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.vendas WHERE grupo_venda = p_grupo AND cancelada) THEN
    RAISE EXCEPTION 'Esta venda foi cancelada e não aceita devolução'; END IF;

  IF v_first.unidade_id IS NOT NULL THEN SELECT * INTO u FROM public.unidades WHERE id = v_first.unidade_id;
  ELSE SELECT * INTO u FROM public.fn_unidade_por_texto(v_first.deposito); END IF;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unidade da venda não encontrada'; END IF;

  v_perm := CASE WHEN p_tipo = 'troca' THEN 'venda.trocar' ELSE 'venda.devolver' END;
  IF NOT public.fn__pode(u.id, v_perm) THEN RAISE EXCEPTION 'Sem permissão para % nesta unidade', CASE WHEN p_tipo='troca' THEN 'trocar' ELSE 'devolver' END; END IF;
  PERFORM public.fn_validar_operacao_unidade(u.id, 'entrada');

  SELECT COALESCE((valor #>> '{}')::int, 30) INTO v_prazo FROM public.configuracoes WHERE chave = 'devolucao_prazo_dias';
  v_prazo := COALESCE(v_prazo, 30);
  IF public.fn__hoje_manaus() - v_first.data > v_prazo THEN
    v_fora := true;
    IF NOT public.fn__pode(u.id, 'venda.devolver_fora_prazo') THEN
      RAISE EXCEPTION 'Venda fora do prazo de % dias: exige aprovação de gerente', v_prazo; END IF;
  END IF;

  IF p_forma IN ('credito_loja','vale_troca') AND COALESCE(p_cliente, v_first.cliente_id) IS NULL THEN
    RAISE EXCEPTION 'Selecione o cliente para gerar crédito/vale-troca'; END IF;

  v_ano := extract(year FROM public.fn__hoje_manaus())::int;
  INSERT INTO public.devolucao_sequencias (unidade_id, ano, ultimo) VALUES (u.id, v_ano, 1)
  ON CONFLICT (unidade_id, ano) DO UPDATE SET ultimo = public.devolucao_sequencias.ultimo + 1
  RETURNING ultimo INTO v_seq;
  o_numero := 'DEV-' || v_ano || '-' || lpad(v_seq::text, 6, '0');
  o_sessao := public.fn__caixa_aberto(u.id);

  INSERT INTO public.devolucoes (numero, ano, grupo_venda_origem, unidade_id, cliente_id, motivo, tipo, forma_reembolso,
    fora_do_prazo, sessao_caixa_id, registrado_por, registrado_por_nome, aprovado_por)
  VALUES (o_numero, v_ano, p_grupo, u.id, COALESCE(p_cliente, v_first.cliente_id), btrim(p_motivo), p_tipo, p_forma,
    v_fora, o_sessao, auth.uid(), v_nome, CASE WHEN v_fora THEN auth.uid() END)
  RETURNING id INTO o_id;

  o_valor := 0;
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := (it->>'quantidade')::int;
    v_destino := COALESCE(it->>'destino', 'estoque');
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    IF v_destino NOT IN ('estoque','avaria','tester') THEN RAISE EXCEPTION 'Destino inválido'; END IF;
    SELECT * INTO v FROM public.vendas WHERE id = (it->>'venda_id')::uuid AND grupo_venda = p_grupo FOR UPDATE;
    IF v.id IS NULL THEN RAISE EXCEPTION 'Item não pertence a esta venda'; END IF;
    SELECT COALESCE(sum(quantidade),0) INTO v_ja FROM public.devolucao_itens WHERE venda_id = v.id;
    IF v_ja + v_qtd > v.quantidade THEN
      RAISE EXCEPTION 'Quantidade maior que a vendida para "%": vendido %, já devolvido %', v.perfume_nome, v.quantidade, v_ja; END IF;
    v_valor_unit := round(v.total / NULLIF(v.quantidade,0), 2);
    INSERT INTO public.devolucao_itens (devolucao_id, venda_id, produto_id, produto_nome, quantidade, valor_unitario, volta_ao_estoque, destino)
    VALUES (o_id, v.id, v.perfume_id, v.perfume_nome, v_qtd, v_valor_unit, v_destino = 'estoque', v_destino);
    o_valor := o_valor + v_valor_unit * v_qtd;

    IF NOT v.is_teste AND u.status <> 'EM_TESTE' THEN
      IF v_destino = 'estoque' THEN
        PERFORM public.fn__estoque_entrada(v.perfume_id, u.id, v_qtd);
      ELSIF v_destino = 'tester' THEN
        SELECT marca, custo INTO v_marca, v_custo FROM public.perfumes WHERE id = v.perfume_id;
        SELECT id INTO v_tester FROM public.testers WHERE perfume_id = v.perfume_id AND unidade_id = u.id ORDER BY created_at LIMIT 1 FOR UPDATE;
        IF v_tester IS NULL THEN
          INSERT INTO public.testers (perfume_id, perfume_nome, marca, deposito, quantidade, custo, registrado_por, unidade_id)
          VALUES (v.perfume_id, v.perfume_nome, COALESCE(v_marca,''), v.deposito, v_qtd, COALESCE(v_custo,0), v_nome, u.id);
        ELSE
          UPDATE public.testers SET quantidade = quantidade + v_qtd WHERE id = v_tester;
        END IF;
      END IF;
      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
      VALUES (public.fn__hoje_manaus(), 'Devolução', v.perfume_id, v.perfume_nome, v.deposito, v_qtd,
        o_numero || ' · destino: ' || v_destino || ' · ' || btrim(p_motivo), v_nome, u.id);
    END IF;
  END LOOP;

  UPDATE public.devolucoes SET valor_total = o_valor WHERE id = o_id;

  UPDATE public.nfce_emissoes SET status = 'PENDENTE_DEVOLUCAO_FISCAL', updated_at = now()
   WHERE venda_grupo_venda = p_grupo AND lower(status) IN ('autorizada','emitida');
  o_unidade := u.id;
END $$;

-- Aplicar reembolso (interno)
CREATE OR REPLACE FUNCTION public.fn__devolucao_reembolso(p_dev uuid, p_valor numeric, p_forma text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.devolucoes;
BEGIN
  IF p_valor <= 0 THEN RETURN; END IF;
  SELECT * INTO d FROM public.devolucoes WHERE id = p_dev;
  IF p_forma = 'dinheiro' THEN
    IF d.sessao_caixa_id IS NULL THEN RAISE EXCEPTION 'Abra o caixa da unidade para devolver em dinheiro'; END IF;
    INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
    VALUES (d.sessao_caixa_id, 'sangria', p_valor, 'Devolução ' || d.numero, d.registrado_por_nome);
  ELSIF p_forma IN ('credito_loja','vale_troca') THEN
    PERFORM public.fn__credito_entrada(d.cliente_id, d.unidade_id, p_valor, d.id,
      CASE WHEN p_forma='vale_troca' THEN 'Vale-troca ' ELSE 'Crédito ' END || d.numero);
  ELSIF p_forma NOT IN ('pix','estorno_cartao') THEN
    RAISE EXCEPTION 'Forma de reembolso inválida';
  END IF;
END $$;

-- RPC: devolução
CREATE OR REPLACE FUNCTION public.fn_devolucao_registrar(p_grupo_venda uuid, p_itens jsonb, p_motivo text,
  p_forma_reembolso text, p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF p_forma_reembolso IS NULL THEN RAISE EXCEPTION 'Informe a forma de reembolso'; END IF;
  SELECT * INTO r FROM public.fn__devolucao_core(p_grupo_venda, p_itens, p_motivo, 'devolucao', p_forma_reembolso, p_cliente_id);
  PERFORM public.fn__devolucao_reembolso(r.o_id, r.o_valor, p_forma_reembolso);
  PERFORM public.fn_audit('DEVOLUCAO_REGISTRADA', 'devolucoes', r.o_id, r.o_unidade, NULL,
    jsonb_build_object('numero', r.o_numero, 'grupo_venda', p_grupo_venda, 'valor', r.o_valor, 'forma', p_forma_reembolso, 'itens', p_itens), '');
  RETURN jsonb_build_object('id', r.o_id, 'numero', r.o_numero, 'valor', r.o_valor);
END $$;

-- RPC: troca
CREATE OR REPLACE FUNCTION public.fn_troca_registrar(p_grupo_venda uuid, p_itens_devolvidos jsonb, p_itens_novos jsonb,
  p_motivo text, p_pagamentos jsonb DEFAULT '[]'::jsonb, p_forma_diferenca text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL, p_vendedora text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; d public.devolucoes; it jsonb; p public.perfumes; v_grupo uuid := gen_random_uuid();
  v_novo numeric := 0; v_qtd int; v_preco numeric; v_dif numeric; v_pag numeric := 0; v_dep text; v_nome text := public.fn__nome_usuario();
  v_origem public.vendas;
BEGIN
  IF p_itens_novos IS NULL OR jsonb_array_length(p_itens_novos) = 0 THEN RAISE EXCEPTION 'Selecione os novos produtos da troca'; END IF;
  SELECT * INTO r FROM public.fn__devolucao_core(p_grupo_venda, p_itens_devolvidos, p_motivo, 'troca', NULL, p_cliente_id);
  SELECT * INTO d FROM public.devolucoes WHERE id = r.o_id;
  SELECT * INTO v_origem FROM public.vendas WHERE grupo_venda = p_grupo_venda ORDER BY created_at LIMIT 1;
  v_dep := v_origem.deposito;
  PERFORM public.fn_validar_operacao_unidade(r.o_unidade, 'venda');

  FOR it IN SELECT * FROM jsonb_array_elements(p_itens_novos) LOOP
    v_qtd := (it->>'quantidade')::int;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO p FROM public.perfumes WHERE id = (it->>'produto_id')::uuid;
    IF p.id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    v_preco := COALESCE((it->>'preco_unitario')::numeric, p.preco_venda);
    PERFORM public.fn_baixar_venda(p.id, r.o_unidade::text, v_qtd, false);
    INSERT INTO public.vendas (perfume_id, perfume_nome, deposito, quantidade, preco_unitario, desconto, total, vendedora,
      tipo_pagamento, bandeira, observacao, data, registrado_por, grupo_venda, cliente_id, sessao_caixa_id, unidade_id)
    VALUES (p.id, p.nome, v_dep, v_qtd, v_preco, 0, round(v_preco * v_qtd, 2), COALESCE(NULLIF(p_vendedora,''), v_origem.vendedora),
      'Vale-Troca', 'N/A', 'Troca ' || d.numero, public.fn__hoje_manaus(), v_nome, v_grupo, d.cliente_id, d.sessao_caixa_id, r.o_unidade);
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
    VALUES (public.fn__hoje_manaus(), 'Saída', p.id, p.nome, v_dep, v_qtd, 'Troca ' || d.numero, v_nome, r.o_unidade);
    v_novo := v_novo + round(v_preco * v_qtd, 2);
  END LOOP;

  v_dif := round(v_novo - r.o_valor, 2);
  -- parte coberta pelo valor devolvido
  INSERT INTO public.venda_pagamentos (grupo_venda, tipo_pagamento, bandeira, valor)
  VALUES (v_grupo, 'Vale-Troca', 'N/A', LEAST(v_novo, r.o_valor));

  IF v_dif > 0 THEN
    SELECT COALESCE(sum((x->>'valor')::numeric),0) INTO v_pag FROM jsonb_array_elements(COALESCE(p_pagamentos,'[]'::jsonb)) x;
    IF round(v_pag,2) <> v_dif THEN RAISE EXCEPTION 'Pagamento da diferença (R$ %) não confere com o valor a pagar (R$ %)', round(v_pag,2), v_dif; END IF;
    INSERT INTO public.venda_pagamentos (grupo_venda, tipo_pagamento, bandeira, valor, parcelas, valor_parcela)
    SELECT v_grupo, x->>'tipo_pagamento', COALESCE(x->>'bandeira','N/A'), (x->>'valor')::numeric,
      COALESCE((x->>'parcelas')::int,1), COALESCE((x->>'valor_parcela')::numeric,(x->>'valor')::numeric)
    FROM jsonb_array_elements(p_pagamentos) x;
  ELSIF v_dif < 0 THEN
    IF p_forma_diferenca IS NULL THEN RAISE EXCEPTION 'Informe como devolver a diferença ao cliente'; END IF;
    UPDATE public.devolucoes SET forma_reembolso = p_forma_diferenca WHERE id = d.id;
    PERFORM public.fn__devolucao_reembolso(d.id, -v_dif, p_forma_diferenca);
  END IF;

  UPDATE public.devolucoes SET grupo_venda_troca = v_grupo, valor_troca = v_novo, diferenca = v_dif WHERE id = d.id;
  PERFORM public.fn_audit('TROCA_REGISTRADA', 'devolucoes', d.id, r.o_unidade, NULL,
    jsonb_build_object('numero', d.numero, 'grupo_venda_origem', p_grupo_venda, 'grupo_venda_troca', v_grupo,
      'valor_devolvido', r.o_valor, 'valor_novo', v_novo, 'diferenca', v_dif), '');
  RETURN jsonb_build_object('id', d.id, 'numero', d.numero, 'valor_devolvido', r.o_valor, 'valor_novo', v_novo, 'diferenca', v_dif, 'grupo_venda_troca', v_grupo);
END $$;

-- RPC: cancelar venda
CREATE OR REPLACE FUNCTION public.fn_venda_cancelar(p_grupo_venda uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_first public.vendas; u public.unidades; v public.vendas; v_total numeric := 0; v_fechado boolean := false;
  v_sessao_atual uuid; v_dinheiro numeric := 0; v_nome text := public.fn__nome_usuario(); v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('venda:' || p_grupo_venda::text));

  SELECT * INTO v_first FROM public.vendas WHERE grupo_venda = p_grupo_venda ORDER BY created_at LIMIT 1;
  IF v_first.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.vendas WHERE grupo_venda = p_grupo_venda AND cancelada) THEN RAISE EXCEPTION 'Venda já cancelada'; END IF;
  IF EXISTS (SELECT 1 FROM public.devolucoes WHERE grupo_venda_origem = p_grupo_venda) THEN
    RAISE EXCEPTION 'Venda com devolução/troca registrada não pode ser cancelada'; END IF;

  IF v_first.unidade_id IS NOT NULL THEN SELECT * INTO u FROM public.unidades WHERE id = v_first.unidade_id;
  ELSE SELECT * INTO u FROM public.fn_unidade_por_texto(v_first.deposito); END IF;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unidade da venda não encontrada'; END IF;
  IF NOT public.fn__pode(u.id, 'venda.cancelar') THEN RAISE EXCEPTION 'Sem permissão para cancelar vendas nesta unidade'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.caixa_sessoes WHERE id = v_first.sessao_caixa_id AND status = 'fechado') INTO v_fechado;
  SELECT COALESCE(sum(valor),0) INTO v_dinheiro FROM public.venda_pagamentos WHERE grupo_venda = p_grupo_venda AND tipo_pagamento = 'Dinheiro';
  IF v_fechado THEN
    IF NOT public.fn__pode(u.id, 'venda.cancelar_caixa_fechado') THEN
      RAISE EXCEPTION 'O caixa desta venda já foi fechado: cancelamento exige permissão especial'; END IF;
    v_sessao_atual := public.fn__caixa_aberto(u.id);
    IF v_dinheiro > 0 AND v_sessao_atual IS NULL THEN
      RAISE EXCEPTION 'Abra o caixa da unidade para lançar o ajuste do cancelamento'; END IF;
  END IF;

  FOR v IN SELECT * FROM public.vendas WHERE grupo_venda = p_grupo_venda FOR UPDATE LOOP
    v_total := v_total + v.total;
    IF NOT v.is_teste AND u.status <> 'EM_TESTE' THEN
      PERFORM public.fn__estoque_entrada(v.perfume_id, u.id, v.quantidade);
      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
      VALUES (public.fn__hoje_manaus(), 'Cancelamento', v.perfume_id, v.perfume_nome, v.deposito, v.quantidade,
        'Cancelamento de venda · ' || btrim(p_motivo), v_nome, u.id);
    END IF;
  END LOOP;

  UPDATE public.vendas SET cancelada = true, cancelada_em = now(),
    nfce_status = CASE WHEN lower(COALESCE(nfce_status,'')) IN ('emitida','autorizada') THEN 'pendente_cancelamento' ELSE nfce_status END
   WHERE grupo_venda = p_grupo_venda;
  UPDATE public.nfce_emissoes SET status = 'PENDENTE_CANCELAMENTO', updated_at = now()
   WHERE venda_grupo_venda = p_grupo_venda AND lower(status) IN ('autorizada','emitida');

  IF v_fechado AND v_dinheiro > 0 THEN
    INSERT INTO public.caixa_movimentacoes (sessao_id, tipo, valor, motivo, registrado_por)
    VALUES (v_sessao_atual, 'sangria', v_dinheiro, 'Ajuste: cancelamento de venda de caixa fechado', v_nome);
  END IF;

  INSERT INTO public.venda_cancelamentos (grupo_venda, unidade_id, motivo, valor_total, caixa_fechado, sessao_caixa_ajuste_id, cancelado_por, cancelado_por_nome, aprovado_por)
  VALUES (p_grupo_venda, u.id, btrim(p_motivo), v_total, v_fechado, CASE WHEN v_fechado AND v_dinheiro > 0 THEN v_sessao_atual END,
    auth.uid(), v_nome, CASE WHEN v_fechado THEN auth.uid() END)
  RETURNING id INTO v_id;

  PERFORM public.fn_audit('VENDA_CANCELADA', 'vendas', v_id, u.id, NULL,
    jsonb_build_object('grupo_venda', p_grupo_venda, 'motivo', p_motivo, 'valor', v_total, 'caixa_fechado', v_fechado), '');
  RETURN jsonb_build_object('id', v_id, 'valor', v_total, 'caixa_fechado', v_fechado);
END $$;

-- RPC: usar crédito
CREATE OR REPLACE FUNCTION public.fn_credito_usar(p_cliente_id uuid, p_valor numeric, p_grupo_venda uuid DEFAULT NULL, p_unidade_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.credito_cliente;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF p_unidade_id IS NOT NULL AND NOT (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(p_unidade_id)) THEN
    RAISE EXCEPTION 'Sem acesso a esta unidade'; END IF;
  SELECT * INTO c FROM public.credito_cliente WHERE cliente_id = p_cliente_id FOR UPDATE;
  IF c.id IS NULL OR c.saldo <= 0 THEN RAISE EXCEPTION 'Cliente sem crédito disponível'; END IF;
  IF c.validade IS NOT NULL AND c.validade < public.fn__hoje_manaus() THEN RAISE EXCEPTION 'Crédito do cliente vencido'; END IF;
  IF round(p_valor,2) > c.saldo THEN RAISE EXCEPTION 'Crédito insuficiente: saldo R$ %', c.saldo; END IF;
  UPDATE public.credito_cliente SET saldo = saldo - round(p_valor,2), updated_at = now() WHERE id = c.id RETURNING * INTO c;
  INSERT INTO public.credito_movimentos (cliente_id, unidade_id, tipo, valor, saldo_apos, grupo_venda, observacao, registrado_por, registrado_por_nome)
  VALUES (p_cliente_id, p_unidade_id, 'uso', round(p_valor,2), c.saldo, p_grupo_venda, 'Uso em venda', auth.uid(), public.fn__nome_usuario());
  PERFORM public.fn_audit('CREDITO_USADO', 'credito_cliente', c.id, p_unidade_id, NULL,
    jsonb_build_object('valor', p_valor, 'grupo_venda', p_grupo_venda, 'saldo', c.saldo), '');
  RETURN c.saldo;
END $$;

-- Execução: internos sem acesso público; RPCs só para autenticados
REVOKE ALL ON FUNCTION public.fn__estoque_entrada(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__credito_entrada(uuid,uuid,numeric,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__devolucao_core(uuid,jsonb,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn__devolucao_reembolso(uuid,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_venda_cancelar(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_devolucao_registrar(uuid,jsonb,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_troca_registrar(uuid,jsonb,jsonb,text,jsonb,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_credito_usar(uuid,numeric,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_cancelar(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_devolucao_registrar(uuid,jsonb,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_troca_registrar(uuid,jsonb,jsonb,text,jsonb,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_credito_usar(uuid,numeric,uuid,uuid) TO authenticated;
