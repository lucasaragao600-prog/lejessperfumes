CREATE OR REPLACE FUNCTION public.fn__estoque_filtrado(p jsonb)
 RETURNS TABLE(produto_id uuid, qtd bigint, estoques jsonb, testers jsonb, tester_qtd bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uni uuid;
  v_chave text;
  v_busca text := nullif(trim(coalesce(p->>'busca', '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF nullif(p->>'unidade', '') IS NOT NULL THEN
    SELECT u.id, coalesce(nullif(u.codigo_legado, ''), u.codigo) INTO v_uni, v_chave
    FROM unidades u
    WHERE coalesce(nullif(u.codigo_legado, ''), u.codigo) = p->>'unidade' OR u.nome = p->>'unidade'
    LIMIT 1;
    IF v_uni IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada'; END IF;
    IF NOT usuario_tem_acesso_unidade(v_uni) THEN RAISE EXCEPTION 'Sem acesso a esta unidade'; END IF;
  END IF;

  RETURN QUERY
  WITH uni AS (
    SELECT u.id, coalesce(nullif(u.codigo_legado, ''), u.codigo) AS chave
    FROM unidades u WHERE usuario_tem_acesso_unidade(u.id)
  ),
  est AS (
    SELECT e.produto_id AS pid,
           jsonb_object_agg(uni.chave, e.quantidade) AS j,
           sum(e.quantidade) AS tot,
           sum(e.quantidade) FILTER (WHERE e.unidade_id = v_uni) AS qu
    FROM estoque_unidades e JOIN uni ON uni.id = e.unidade_id
    GROUP BY e.produto_id
  ),
  tst0 AS (
    SELECT t.perfume_id AS pid,
           coalesce(nullif(u.codigo_legado, ''), u.codigo, t.deposito) AS chave,
           (t.unidade_id = v_uni OR (t.unidade_id IS NULL AND t.deposito = v_chave)) AS na_unidade,
           sum(t.quantidade) AS q
    FROM testers t LEFT JOIN unidades u ON u.id = t.unidade_id
    WHERE t.unidade_id IS NULL OR usuario_tem_acesso_unidade(t.unidade_id)
    GROUP BY 1, 2, 3
  ),
  tst AS (
    SELECT pid, jsonb_object_agg(chave, q) AS j, sum(q) AS tot,
           sum(q) FILTER (WHERE na_unidade) AS qu
    FROM (SELECT pid, chave, bool_or(na_unidade) AS na_unidade, sum(q) AS q FROM tst0 GROUP BY 1, 2) x
    GROUP BY pid
  ),
  base AS (
    SELECT pf.id, pf.nome, pf.custo, pf.preco_venda, pf.estoque_minimo, pf.codigo_barras,
           coalesce(est.j, '{}'::jsonb) AS ej,
           coalesce(CASE WHEN v_uni IS NULL THEN est.tot ELSE est.qu END, 0)::bigint AS q,
           coalesce(tst.j, '{}'::jsonb) AS tj,
           coalesce(CASE WHEN v_uni IS NULL THEN tst.tot ELSE tst.qu END, 0)::bigint AS tq,
           coalesce(tst.tot, 0) AS tq_total
    FROM perfumes pf
    LEFT JOIN est ON est.pid = pf.id
    LEFT JOIN tst ON tst.pid = pf.id
    WHERE (v_busca IS NULL
           OR pf.nome ILIKE '%' || v_busca || '%'
           OR pf.codigo ILIKE '%' || v_busca || '%'
           OR pf.marca ILIKE '%' || v_busca || '%'
           OR pf.codigo_barras ILIKE '%' || v_busca || '%'
           OR pf.concentracao ILIKE '%' || v_busca || '%'
           OR pf.tamanho ILIKE '%' || v_busca || '%'
           OR pf.volume::text LIKE '%' || v_busca || '%'
           OR EXISTS (SELECT 1 FROM produto_gtins g WHERE g.produto_id = pf.id AND g.gtin ILIKE '%' || v_busca || '%'))
      AND (nullif(p->>'tipo', '') IS NULL OR pf.tipo = p->>'tipo')
      AND (nullif(p->>'classificacao', '') IS NULL OR coalesce(nullif(pf.classificacao, ''), 'Compartilhável') = p->>'classificacao')
      AND (nullif(p->>'custo_min', '') IS NULL OR pf.custo >= (p->>'custo_min')::numeric)
      AND (nullif(p->>'custo_max', '') IS NULL OR pf.custo <= (p->>'custo_max')::numeric)
      AND (nullif(p->>'venda_min', '') IS NULL OR pf.preco_venda >= (p->>'venda_min')::numeric)
      AND (nullif(p->>'venda_max', '') IS NULL OR pf.preco_venda <= (p->>'venda_max')::numeric)
      AND (v_uni IS NULL
           OR est.qu > 0
           OR EXISTS (SELECT 1 FROM movimentacoes m WHERE m.perfume_id = pf.id
                      AND (m.unidade_id = v_uni OR m.unidade_origem_id = v_uni OR m.unidade_destino_id = v_uni
                           OR v_chave IN (m.deposito, m.deposito_origem, m.deposito_destino)))
           OR EXISTS (SELECT 1 FROM vendas v WHERE v.perfume_id = pf.id AND (v.unidade_id = v_uni OR v.deposito = v_chave)))
  )
  SELECT b.id, b.q, b.ej, b.tj, b.tq
  FROM base b
  WHERE (nullif(p->>'estoque_min', '') IS NULL OR b.q >= (p->>'estoque_min')::numeric)
    AND (nullif(p->>'estoque_max', '') IS NULL OR b.q <= (p->>'estoque_max')::numeric)
    AND (coalesce((p->>'alertas')::boolean, false) = false OR b.q <= b.estoque_minimo)
    AND (coalesce(p->>'especial', '') <> 'sem_barcode' OR trim(coalesce(b.codigo_barras, '')) = '')
    AND (coalesce(p->>'especial', '') <> 'sem_tester' OR b.tq_total = 0);
END;
$function$;