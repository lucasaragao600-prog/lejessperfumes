
-- Fase 2: condição física do item devolvido + quarentena de avarias (aditivo)

-- 1) Condição física no item devolvido
ALTER TABLE public.devolucao_itens ADD COLUMN IF NOT EXISTS condicao text NOT NULL DEFAULT 'novo_lacrado';
ALTER TABLE public.devolucao_itens DROP CONSTRAINT IF EXISTS devolucao_itens_condicao_check;
ALTER TABLE public.devolucao_itens ADD CONSTRAINT devolucao_itens_condicao_check
  CHECK (condicao IN ('novo_lacrado','novo_aberto','usado_parcial','avariado','vencido','incompleto'));

-- 2) Quarentena de itens devolvidos que exigem avaliação
CREATE TABLE IF NOT EXISTS public.devolucao_quarentena (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_item_id uuid NOT NULL REFERENCES public.devolucao_itens(id),
  devolucao_id uuid NOT NULL REFERENCES public.devolucoes(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  produto_nome text NOT NULL DEFAULT '',
  quantidade int NOT NULL CHECK (quantidade > 0),
  condicao text NOT NULL,
  motivo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','reintegrado','perda','tester')),
  decidido_por uuid,
  decidido_por_nome text NOT NULL DEFAULT '',
  decidido_em timestamptz,
  observacao_decisao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.devolucao_quarentena TO authenticated;
GRANT ALL ON public.devolucao_quarentena TO service_role;
ALTER TABLE public.devolucao_quarentena ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quarentena por unidade" ON public.devolucao_quarentena;
CREATE POLICY "quarentena por unidade" ON public.devolucao_quarentena FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(unidade_id));

INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
  ('devolucao.quarentena','devolucao','Decidir destino de itens em quarentena')
ON CONFLICT (chave) DO NOTHING;

-- 3) Core de devolução passa a registrar condição e enviar avarias à quarentena
CREATE OR REPLACE FUNCTION public.fn__devolucao_core(p_grupo uuid, p_itens jsonb, p_motivo text, p_tipo text,
  p_forma text, p_cliente uuid, OUT o_id uuid, OUT o_valor numeric, OUT o_unidade uuid, OUT o_numero text, OUT o_sessao uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first public.vendas; u public.unidades; v public.vendas; it jsonb;
  v_prazo int; v_fora boolean := false; v_ano int; v_seq int; v_qtd int; v_ja int;
  v_destino text; v_condicao text; v_valor_unit numeric; v_nome text := public.fn__nome_usuario(); v_perm text;
  v_marca text; v_custo numeric; v_tester uuid; v_item_id uuid;
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
    v_condicao := COALESCE(NULLIF(btrim(it->>'condicao'), ''),
      CASE WHEN v_destino = 'avaria' THEN 'avariado' ELSE 'novo_lacrado' END);
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    IF v_destino NOT IN ('estoque','avaria','tester') THEN RAISE EXCEPTION 'Destino inválido'; END IF;
    IF v_condicao NOT IN ('novo_lacrado','novo_aberto','usado_parcial','avariado','vencido','incompleto') THEN
      RAISE EXCEPTION 'Condição inválida'; END IF;
    IF v_condicao IN ('avariado','vencido','incompleto') THEN v_destino := 'avaria'; END IF;
    SELECT * INTO v FROM public.vendas WHERE id = (it->>'venda_id')::uuid AND grupo_venda = p_grupo FOR UPDATE;
    IF v.id IS NULL THEN RAISE EXCEPTION 'Item não pertence a esta venda'; END IF;
    SELECT COALESCE(sum(quantidade),0) INTO v_ja FROM public.devolucao_itens WHERE venda_id = v.id;
    IF v_ja + v_qtd > v.quantidade THEN
      RAISE EXCEPTION 'Quantidade maior que a vendida para "%": vendido %, já devolvido %', v.perfume_nome, v.quantidade, v_ja; END IF;
    v_valor_unit := round(v.total / NULLIF(v.quantidade,0), 2);
    INSERT INTO public.devolucao_itens (devolucao_id, venda_id, produto_id, produto_nome, quantidade, valor_unitario, volta_ao_estoque, destino, condicao)
    VALUES (o_id, v.id, v.perfume_id, v.perfume_nome, v_qtd, v_valor_unit, v_destino = 'estoque', v_destino, v_condicao)
    RETURNING id INTO v_item_id;
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
      ELSIF v_destino = 'avaria' THEN
        INSERT INTO public.devolucao_quarentena (devolucao_item_id, devolucao_id, unidade_id, produto_id, produto_nome, quantidade, condicao, motivo)
        VALUES (v_item_id, o_id, u.id, v.perfume_id, v.perfume_nome, v_qtd, v_condicao, btrim(p_motivo));
      END IF;
      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
      VALUES (public.fn__hoje_manaus(), 'Devolução', v.perfume_id, v.perfume_nome, v.deposito, v_qtd,
        o_numero || ' · destino: ' || v_destino || ' · condição: ' || v_condicao || ' · ' || btrim(p_motivo), v_nome, u.id);
    END IF;
  END LOOP;

  UPDATE public.devolucoes SET valor_total = o_valor WHERE id = o_id;

  UPDATE public.nfce_emissoes SET status = 'PENDENTE_DEVOLUCAO_FISCAL', updated_at = now()
   WHERE venda_grupo_venda = p_grupo AND lower(status) IN ('autorizada','emitida');
  o_unidade := u.id;
END $$;

-- 4) Listar quarentena (somente leitura, por filial)
CREATE OR REPLACE FUNCTION public.fn_devolucao_quarentena_listar(p_unidade_id uuid DEFAULT NULL, p_status text DEFAULT 'pendente')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(row_to_json(q) ORDER BY q.created_at DESC) FROM (
    SELECT q.id, q.devolucao_id, d.numero AS devolucao_numero, q.unidade_id, u.nome AS unidade_nome,
      q.produto_id, q.produto_nome, q.quantidade, q.condicao, q.motivo, q.status,
      q.decidido_por_nome, q.decidido_em, q.observacao_decisao, q.created_at
    FROM public.devolucao_quarentena q
    JOIN public.devolucoes d ON d.id = q.devolucao_id
    JOIN public.unidades u ON u.id = q.unidade_id
    WHERE (p_status IS NULL OR q.status = p_status)
      AND (p_unidade_id IS NULL OR q.unidade_id = p_unidade_id)
      AND (public.has_role(auth.uid(),'master') OR public.usuario_tem_acesso_unidade(q.unidade_id))
  ) q), '[]'::jsonb);
END $$;

-- 5) Decidir destino do item em quarentena (atômico, com bloqueio)
CREATE OR REPLACE FUNCTION public.fn_devolucao_quarentena_decidir(p_id uuid, p_decisao text, p_observacao text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q public.devolucao_quarentena; u public.unidades; v_nome text := public.fn__nome_usuario();
  v_marca text; v_custo numeric; v_tester uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_decisao NOT IN ('reintegrar','perda','tester') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT * INTO q FROM public.devolucao_quarentena WHERE id = p_id FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Item de quarentena não encontrado'; END IF;
  IF q.status <> 'pendente' THEN RAISE EXCEPTION 'Este item já foi decidido'; END IF;
  IF NOT public.fn__pode(q.unidade_id, 'devolucao.quarentena') THEN
    RAISE EXCEPTION 'Sem permissão para decidir quarentena nesta unidade'; END IF;
  SELECT * INTO u FROM public.unidades WHERE id = q.unidade_id;

  IF p_decisao = 'reintegrar' THEN
    PERFORM public.fn_validar_operacao_unidade(u.id, 'entrada');
    PERFORM public.fn__estoque_entrada(q.produto_id, q.unidade_id, q.quantidade);
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
    VALUES (public.fn__hoje_manaus(), 'Entrada', q.produto_id, q.produto_nome, u.nome, q.quantidade,
      'Quarentena reintegrada · ' || COALESCE(NULLIF(btrim(p_observacao),''), q.motivo), v_nome, u.id);
  ELSIF p_decisao = 'perda' THEN
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
    VALUES (public.fn__hoje_manaus(), 'Perda', q.produto_id, q.produto_nome, u.nome, q.quantidade,
      'Quarentena baixada como perda (' || q.condicao || ') · ' || COALESCE(NULLIF(btrim(p_observacao),''), q.motivo), v_nome, u.id);
  ELSIF p_decisao = 'tester' THEN
    SELECT marca, custo INTO v_marca, v_custo FROM public.perfumes WHERE id = q.produto_id;
    SELECT id INTO v_tester FROM public.testers WHERE perfume_id = q.produto_id AND unidade_id = q.unidade_id ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF v_tester IS NULL THEN
      INSERT INTO public.testers (perfume_id, perfume_nome, marca, deposito, quantidade, custo, registrado_por, unidade_id)
      VALUES (q.produto_id, q.produto_nome, COALESCE(v_marca,''), u.nome, q.quantidade, COALESCE(v_custo,0), v_nome, q.unidade_id);
    ELSE
      UPDATE public.testers SET quantidade = quantidade + q.quantidade WHERE id = v_tester;
    END IF;
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
    VALUES (public.fn__hoje_manaus(), 'Saída Tester', q.produto_id, q.produto_nome, u.nome, q.quantidade,
      'Quarentena virou tester · ' || COALESCE(NULLIF(btrim(p_observacao),''), q.motivo), v_nome, u.id);
  END IF;

  UPDATE public.devolucao_quarentena
  SET status = CASE p_decisao WHEN 'reintegrar' THEN 'reintegrado' WHEN 'perda' THEN 'perda' ELSE 'tester' END,
      decidido_por = auth.uid(), decidido_por_nome = v_nome, decidido_em = now(), observacao_decisao = btrim(p_observacao)
  WHERE id = q.id;

  PERFORM public.fn_audit('DEVOLUCAO_QUARENTENA_DECIDIDA', 'devolucao_quarentena', q.id, q.unidade_id, NULL,
    jsonb_build_object('decisao', p_decisao, 'produto', q.produto_nome, 'quantidade', q.quantidade, 'condicao', q.condicao), '');
  RETURN jsonb_build_object('id', q.id, 'decisao', p_decisao);
END $$;
