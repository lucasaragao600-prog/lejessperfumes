-- Fase 6: troca entre unidades (aditivo). A venda foi feita na loja A e a troca acontece na loja B:
-- os produtos devolvidos entram no estoque de B e os novos saem de B, tudo atômico e auditado.

-- 1) Colunas aditivas em devolucoes
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS unidade_origem_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS troca_entre_unidades boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_devolucoes_origem_unidade ON public.devolucoes(unidade_origem_id);

-- 2) Permissão específica
INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
  ('venda.trocar_entre_unidades','venda','Registrar troca de venda feita em outra unidade')
ON CONFLICT (chave) DO NOTHING;

-- 3) Busca de vendas em todas as unidades (somente com a permissão, para localizar a venda de origem)
CREATE OR REPLACE FUNCTION public.fn_venda_buscar_troca(p_unidade_operacao uuid, p_busca text DEFAULT '', p_limite int DEFAULT 30)
RETURNS TABLE (grupo_venda uuid, data date, deposito text, unidade_id uuid, unidade_nome text, cliente_nome text, total numeric, cancelada boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_busca text := btrim(COALESCE(p_busca,''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.fn__pode(p_unidade_operacao, 'venda.trocar_entre_unidades') THEN
    RAISE EXCEPTION 'Sem permissão para troca entre unidades'; END IF;
  RETURN QUERY
  SELECT v.grupo_venda, min(v.data) AS data, min(v.deposito) AS deposito, min(v.unidade_id) AS unidade_id,
    min(u.nome_exibicao) AS unidade_nome, min(c.nome) AS cliente_nome,
    sum(CASE WHEN v.cancelada THEN 0 ELSE v.total END)::numeric AS total,
    bool_or(v.cancelada) AS cancelada
  FROM public.vendas v
  LEFT JOIN public.unidades u ON u.id = v.unidade_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  WHERE NOT v.is_teste AND v.grupo_venda IS NOT NULL
    AND (v_busca = '' OR v.grupo_venda::text ILIKE v_busca || '%'
      OR c.nome ILIKE '%' || v_busca || '%' OR v.perfume_nome ILIKE '%' || v_busca || '%')
  GROUP BY v.grupo_venda
  ORDER BY min(v.created_at) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite,30), 100));
END $$;

-- 4) Detalhe da venda de outra unidade para o fluxo de troca (somente com a permissão)
CREATE OR REPLACE FUNCTION public.fn_grupo_venda_troca(p_grupo_venda uuid, p_unidade_operacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_first public.vendas; v_itens jsonb; v_devs jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.fn__pode(p_unidade_operacao, 'venda.trocar_entre_unidades') THEN
    RAISE EXCEPTION 'Sem permissão para troca entre unidades'; END IF;
  SELECT * INTO v_first FROM public.vendas WHERE grupo_venda = p_grupo_venda ORDER BY created_at LIMIT 1;
  IF v_first.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'id', v.id, 'perfume_id', v.perfume_id, 'perfume_nome', v.perfume_nome,
    'quantidade', v.quantidade, 'total', v.total,
    'ja_devolvido', (SELECT COALESCE(sum(di.quantidade),0) FROM public.devolucao_itens di WHERE di.venda_id = v.id)
  ) ORDER BY v.created_at) INTO v_itens
  FROM public.vendas v WHERE v.grupo_venda = p_grupo_venda;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'numero', d.numero, 'tipo', d.tipo, 'valor_total', d.valor_total, 'created_at', d.created_at) ORDER BY d.created_at), '[]'::jsonb)
  INTO v_devs FROM public.devolucoes d WHERE d.grupo_venda_origem = p_grupo_venda;
  RETURN jsonb_build_object(
    'grupo_venda', p_grupo_venda, 'data', v_first.data, 'deposito', v_first.deposito,
    'unidade_id', v_first.unidade_id, 'cliente_id', v_first.cliente_id, 'vendedora', v_first.vendedora,
    'cancelada', EXISTS (SELECT 1 FROM public.vendas v2 WHERE v2.grupo_venda = p_grupo_venda AND v2.cancelada),
    'itens', COALESCE(v_itens,'[]'::jsonb), 'devolucoes', v_devs);
END $$;

-- 5) Troca entre unidades: devolução e novos itens movimentam o estoque da unidade onde a troca acontece
CREATE OR REPLACE FUNCTION public.fn_troca_registrar_unidade(p_grupo_venda uuid, p_unidade_operacao uuid,
  p_itens_devolvidos jsonb, p_itens_novos jsonb, p_motivo text,
  p_pagamentos jsonb DEFAULT '[]'::jsonb, p_forma_diferenca text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL, p_vendedora text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first public.vendas; u_origem public.unidades; u_op public.unidades; v public.vendas; it jsonb; p public.perfumes;
  v_prazo int; v_fora boolean := false; v_ano int; v_seq int; v_qtd int; v_ja int;
  v_destino text; v_condicao text; v_valor_unit numeric; v_nome text := public.fn__nome_usuario();
  v_marca text; v_custo numeric; v_tester uuid; v_item_id uuid;
  v_dev_id uuid; v_numero text; v_sessao uuid; v_valor numeric := 0;
  v_grupo uuid := gen_random_uuid(); v_novo numeric := 0; v_preco numeric; v_dif numeric; v_pag numeric := 0;
  v_dep_op text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  IF p_itens_devolvidos IS NULL OR jsonb_typeof(p_itens_devolvidos) <> 'array' OR jsonb_array_length(p_itens_devolvidos) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um item'; END IF;
  IF p_itens_novos IS NULL OR jsonb_array_length(p_itens_novos) = 0 THEN RAISE EXCEPTION 'Selecione os novos produtos da troca'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('venda:' || p_grupo_venda::text));
  SELECT * INTO v_first FROM public.vendas WHERE grupo_venda = p_grupo_venda ORDER BY created_at LIMIT 1;
  IF v_first.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.vendas WHERE grupo_venda = p_grupo_venda AND cancelada) THEN
    RAISE EXCEPTION 'Esta venda foi cancelada e não aceita troca'; END IF;

  IF v_first.unidade_id IS NOT NULL THEN SELECT * INTO u_origem FROM public.unidades WHERE id = v_first.unidade_id;
  ELSE SELECT * INTO u_origem FROM public.fn_unidade_por_texto(v_first.deposito); END IF;
  IF u_origem.id IS NULL THEN RAISE EXCEPTION 'Unidade da venda não encontrada'; END IF;

  SELECT * INTO u_op FROM public.unidades WHERE id = p_unidade_operacao;
  IF u_op.id IS NULL THEN RAISE EXCEPTION 'Unidade de operação não encontrada'; END IF;
  IF u_op.id = u_origem.id THEN RAISE EXCEPTION 'A venda é desta mesma unidade: use a troca normal'; END IF;

  IF NOT public.fn__pode(u_op.id, 'venda.trocar') THEN RAISE EXCEPTION 'Sem permissão para trocar nesta unidade'; END IF;
  IF NOT public.fn__pode(u_op.id, 'venda.trocar_entre_unidades') THEN RAISE EXCEPTION 'Sem permissão para troca entre unidades'; END IF;
  PERFORM public.fn_validar_operacao_unidade(u_op.id, 'venda');

  SELECT COALESCE((valor #>> '{}')::int, 30) INTO v_prazo FROM public.configuracoes WHERE chave = 'devolucao_prazo_dias';
  v_prazo := COALESCE(v_prazo, 30);
  IF public.fn__hoje_manaus() - v_first.data > v_prazo THEN
    v_fora := true;
    IF NOT public.fn__pode(u_op.id, 'venda.devolver_fora_prazo') THEN
      RAISE EXCEPTION 'Venda fora do prazo de % dias: exige aprovação de gerente', v_prazo; END IF;
  END IF;

  IF p_forma_diferenca IN ('credito_loja','vale_troca') AND COALESCE(p_cliente_id, v_first.cliente_id) IS NULL THEN
    RAISE EXCEPTION 'Selecione o cliente para gerar crédito/vale-troca'; END IF;

  v_ano := extract(year FROM public.fn__hoje_manaus())::int;
  INSERT INTO public.devolucao_sequencias (unidade_id, ano, ultimo) VALUES (u_op.id, v_ano, 1)
  ON CONFLICT (unidade_id, ano) DO UPDATE SET ultimo = public.devolucao_sequencias.ultimo + 1
  RETURNING ultimo INTO v_seq;
  v_numero := 'DEV-' || v_ano || '-' || lpad(v_seq::text, 6, '0');
  v_sessao := public.fn__caixa_aberto(u_op.id);

  INSERT INTO public.devolucoes (numero, ano, grupo_venda_origem, unidade_id, unidade_origem_id, troca_entre_unidades,
    cliente_id, motivo, tipo, forma_reembolso, fora_do_prazo, sessao_caixa_id, registrado_por, registrado_por_nome, aprovado_por)
  VALUES (v_numero, v_ano, p_grupo_venda, u_op.id, u_origem.id, true,
    COALESCE(p_cliente_id, v_first.cliente_id), btrim(p_motivo), 'troca', NULL,
    v_fora, v_sessao, auth.uid(), v_nome, CASE WHEN v_fora THEN auth.uid() END)
  RETURNING id INTO v_dev_id;

  -- Itens devolvidos: entram no estoque da unidade onde a troca acontece
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens_devolvidos) LOOP
    v_qtd := (it->>'quantidade')::int;
    v_destino := COALESCE(it->>'destino', 'estoque');
    v_condicao := COALESCE(NULLIF(btrim(it->>'condicao'), ''),
      CASE WHEN v_destino = 'avaria' THEN 'avariado' ELSE 'novo_lacrado' END);
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    IF v_destino NOT IN ('estoque','avaria','tester') THEN RAISE EXCEPTION 'Destino inválido'; END IF;
    IF v_condicao NOT IN ('novo_lacrado','novo_aberto','usado_parcial','avariado','vencido','incompleto') THEN
      RAISE EXCEPTION 'Condição inválida'; END IF;
    IF v_condicao IN ('avariado','vencido','incompleto') THEN v_destino := 'avaria'; END IF;
    SELECT * INTO v FROM public.vendas WHERE id = (it->>'venda_id')::uuid AND grupo_venda = p_grupo_venda FOR UPDATE;
    IF v.id IS NULL THEN RAISE EXCEPTION 'Item não pertence a esta venda'; END IF;
    SELECT COALESCE(sum(quantidade),0) INTO v_ja FROM public.devolucao_itens WHERE venda_id = v.id;
    IF v_ja + v_qtd > v.quantidade THEN
      RAISE EXCEPTION 'Quantidade maior que a vendida para "%": vendido %, já devolvido %', v.perfume_nome, v.quantidade, v_ja; END IF;
    v_valor_unit := round(v.total / NULLIF(v.quantidade,0), 2);
    INSERT INTO public.devolucao_itens (devolucao_id, venda_id, produto_id, produto_nome, quantidade, valor_unitario, volta_ao_estoque, destino, condicao)
    VALUES (v_dev_id, v.id, v.perfume_id, v.perfume_nome, v_qtd, v_valor_unit, v_destino = 'estoque', v_destino, v_condicao)
    RETURNING id INTO v_item_id;
    v_valor := v_valor + v_valor_unit * v_qtd;

    IF NOT v.is_teste AND u_op.status <> 'EM_TESTE' THEN
      IF v_destino = 'estoque' THEN
        PERFORM public.fn__estoque_entrada(v.perfume_id, u_op.id, v_qtd);
      ELSIF v_destino = 'tester' THEN
        SELECT marca, custo INTO v_marca, v_custo FROM public.perfumes WHERE id = v.perfume_id;
        SELECT id INTO v_tester FROM public.testers WHERE perfume_id = v.perfume_id AND unidade_id = u_op.id ORDER BY created_at LIMIT 1 FOR UPDATE;
        IF v_tester IS NULL THEN
          INSERT INTO public.testers (perfume_id, perfume_nome, marca, deposito, quantidade, custo, registrado_por, unidade_id)
          VALUES (v.perfume_id, v.perfume_nome, COALESCE(v_marca,''), COALESCE(NULLIF(u_op.codigo_legado,''), u_op.codigo), v_qtd, COALESCE(v_custo,0), v_nome, u_op.id);
        ELSE
          UPDATE public.testers SET quantidade = quantidade + v_qtd WHERE id = v_tester;
        END IF;
      ELSIF v_destino = 'avaria' THEN
        INSERT INTO public.devolucao_quarentena (devolucao_item_id, devolucao_id, unidade_id, produto_id, produto_nome, quantidade, condicao, motivo)
        VALUES (v_item_id, v_dev_id, u_op.id, v.perfume_id, v.perfume_nome, v_qtd, v_condicao, btrim(p_motivo));
      END IF;
      INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
      VALUES (public.fn__hoje_manaus(), 'Devolução', v.perfume_id, v.perfume_nome, COALESCE(NULLIF(u_op.codigo_legado,''), u_op.codigo), v_qtd,
        v_numero || ' · troca entre lojas · origem: ' || u_origem.nome_exibicao || ' · destino: ' || v_destino || ' · condição: ' || v_condicao || ' · ' || btrim(p_motivo), v_nome, u_op.id);
    END IF;
  END LOOP;

  UPDATE public.devolucoes SET valor_total = v_valor WHERE id = v_dev_id;

  -- Novos itens: saem do estoque da unidade onde a troca acontece
  v_dep_op := COALESCE(NULLIF(u_op.codigo_legado,''), u_op.codigo);
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens_novos) LOOP
    v_qtd := (it->>'quantidade')::int;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO p FROM public.perfumes WHERE id = (it->>'produto_id')::uuid;
    IF p.id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    v_preco := COALESCE((it->>'preco_unitario')::numeric, p.preco_venda);
    PERFORM public.fn_baixar_venda(p.id, u_op.id::text, v_qtd, false);
    INSERT INTO public.vendas (perfume_id, perfume_nome, deposito, quantidade, preco_unitario, desconto, total, vendedora,
      tipo_pagamento, bandeira, observacao, data, registrado_por, grupo_venda, cliente_id, sessao_caixa_id, unidade_id)
    VALUES (p.id, p.nome, v_dep_op, v_qtd, v_preco, 0, round(v_preco * v_qtd, 2), COALESCE(NULLIF(p_vendedora,''), v_first.vendedora),
      'Vale-Troca', 'N/A', 'Troca ' || v_numero || ' (entre lojas)', public.fn__hoje_manaus(), v_nome, v_grupo,
      COALESCE(p_cliente_id, v_first.cliente_id), v_sessao, u_op.id);
    INSERT INTO public.movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, quantidade, observacao, registrado_por, unidade_id)
    VALUES (public.fn__hoje_manaus(), 'Saída', p.id, p.nome, v_dep_op, v_qtd, 'Troca ' || v_numero || ' (entre lojas)', v_nome, u_op.id);
    v_novo := v_novo + round(v_preco * v_qtd, 2);
  END LOOP;

  v_dif := round(v_novo - v_valor, 2);
  INSERT INTO public.venda_pagamentos (grupo_venda, tipo_pagamento, bandeira, valor)
  VALUES (v_grupo, 'Vale-Troca', 'N/A', LEAST(v_novo, v_valor));

  IF v_dif > 0 THEN
    SELECT COALESCE(sum((x->>'valor')::numeric),0) INTO v_pag FROM jsonb_array_elements(COALESCE(p_pagamentos,'[]'::jsonb)) x;
    IF round(v_pag,2) <> v_dif THEN RAISE EXCEPTION 'Pagamento da diferença (R$ %) não confere com o valor a pagar (R$ %)', round(v_pag,2), v_dif; END IF;
    INSERT INTO public.venda_pagamentos (grupo_venda, tipo_pagamento, bandeira, valor, parcelas, valor_parcela)
    SELECT v_grupo, x->>'tipo_pagamento', COALESCE(x->>'bandeira','N/A'), (x->>'valor')::numeric,
      COALESCE((x->>'parcelas')::int,1), COALESCE((x->>'valor_parcela')::numeric,(x->>'valor')::numeric)
    FROM jsonb_array_elements(p_pagamentos) x;
  ELSIF v_dif < 0 THEN
    IF p_forma_diferenca IS NULL THEN RAISE EXCEPTION 'Informe como devolver a diferença ao cliente'; END IF;
    UPDATE public.devolucoes SET forma_reembolso = p_forma_diferenca WHERE id = v_dev_id;
    PERFORM public.fn__devolucao_reembolso(v_dev_id, -v_dif, p_forma_diferenca);
  END IF;

  UPDATE public.devolucoes SET grupo_venda_troca = v_grupo, valor_troca = v_novo, diferenca = v_dif WHERE id = v_dev_id;

  UPDATE public.nfce_emissoes SET status = 'PENDENTE_DEVOLUCAO_FISCAL', updated_at = now()
   WHERE venda_grupo_venda = p_grupo_venda AND lower(status) IN ('autorizada','emitida');

  PERFORM public.fn_audit('TROCA_ENTRE_UNIDADES', 'devolucoes', v_dev_id, u_op.id, NULL,
    jsonb_build_object('numero', v_numero, 'grupo_venda_origem', p_grupo_venda, 'grupo_venda_troca', v_grupo,
      'unidade_origem_id', u_origem.id, 'unidade_operacao_id', u_op.id,
      'valor_devolvido', v_valor, 'valor_novo', v_novo, 'diferenca', v_dif), '');
  RETURN jsonb_build_object('id', v_dev_id, 'numero', v_numero, 'valor_devolvido', v_valor, 'valor_novo', v_novo,
    'diferenca', v_dif, 'grupo_venda_troca', v_grupo, 'unidade_origem_id', u_origem.id, 'unidade_operacao_id', u_op.id);
END $$;

-- 6) Execução: só autenticados
REVOKE ALL ON FUNCTION public.fn_venda_buscar_troca(uuid,text,int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_grupo_venda_troca(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_troca_registrar_unidade(uuid,uuid,jsonb,jsonb,text,jsonb,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_buscar_troca(uuid,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_grupo_venda_troca(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_troca_registrar_unidade(uuid,uuid,jsonb,jsonb,text,jsonb,text,uuid,text) TO authenticated;