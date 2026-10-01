CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_perfumes_nome_trgm ON public.perfumes USING gin (nome extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_perfumes_marca_trgm ON public.perfumes USING gin (marca extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_perfumes_codigo_trgm ON public.perfumes USING gin (codigo extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_perfumes_codbarras_trgm ON public.perfumes USING gin (codigo_barras extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produto_gtins_gtin_trgm ON public.produto_gtins USING gin (gtin extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produto_gtins_produto ON public.produto_gtins (produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_unidades_unidade_produto ON public.estoque_unidades (unidade_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data_created_id ON public.vendas (data DESC, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_vendas_unidade_data ON public.vendas (unidade_id, data);
CREATE INDEX IF NOT EXISTS idx_vendas_perfume ON public.vendas (perfume_id);
CREATE INDEX IF NOT EXISTS idx_mov_data_created ON public.movimentacoes (data DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_perfume ON public.movimentacoes (perfume_id);
CREATE INDEX IF NOT EXISTS idx_testers_perfume ON public.testers (perfume_id);

-- Base filtrada do estoque (somente leitura, respeita acesso por unidade)
CREATE OR REPLACE FUNCTION public.fn__estoque_filtrado(p jsonb)
RETURNS TABLE(produto_id uuid, qtd bigint, estoques jsonb, testers jsonb, tester_qtd bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.fn_estoque_listar(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ordem text := coalesce(p_filtros->>'ordem', 'none');
  v_total bigint;
  v_itens jsonb;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _est_f ON COMMIT DROP AS SELECT * FROM fn__estoque_filtrado(p_filtros) WITH NO DATA;
  TRUNCATE _est_f;
  INSERT INTO _est_f SELECT * FROM fn__estoque_filtrado(p_filtros);
  SELECT count(*) INTO v_total FROM _est_f;
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.o1, x.nome, x.id), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT to_jsonb(pf) || jsonb_build_object('estoques', f.estoques, 'testers', f.testers, 'qtd', f.qtd, 'tester_qtd', f.tester_qtd) AS j,
           CASE v_ordem WHEN 'asc' THEN f.qtd WHEN 'desc' THEN -f.qtd ELSE 0 END AS o1,
           pf.nome, pf.id
    FROM _est_f f JOIN perfumes pf ON pf.id = f.produto_id
    ORDER BY o1, pf.nome, pf.id
    LIMIT least(greatest(coalesce(p_limite, 30), 1), 2000) OFFSET greatest(coalesce(p_offset, 0), 0)
  ) x;
  RETURN jsonb_build_object('total', v_total, 'itens', v_itens);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_estoque_resumo(p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_por jsonb;
  v_alertas bigint;
  v_sem_bc bigint;
  v_sem_t bigint;
BEGIN
  SELECT jsonb_build_object(
           'total', count(*),
           'unidades', coalesce(sum(f.qtd), 0),
           'custo', coalesce(sum(f.qtd * pf.custo), 0),
           'venda', coalesce(sum(f.qtd * pf.preco_venda), 0))
  INTO r
  FROM fn__estoque_filtrado(p_filtros) f JOIN perfumes pf ON pf.id = f.produto_id;

  SELECT coalesce(jsonb_object_agg(k, s), '{}'::jsonb) INTO v_por FROM (
    SELECT e.key AS k, sum(e.value::numeric) AS s
    FROM fn__estoque_filtrado(p_filtros) f, jsonb_each_text(f.estoques) e
    GROUP BY e.key
  ) z;

  SELECT count(*) INTO v_alertas
  FROM fn__estoque_filtrado(jsonb_build_object('unidade', p_filtros->>'unidade', 'alertas', true));
  SELECT count(*) INTO v_sem_bc FROM fn__estoque_filtrado(jsonb_build_object('especial', 'sem_barcode'));
  SELECT count(*) INTO v_sem_t FROM fn__estoque_filtrado(jsonb_build_object('especial', 'sem_tester'));

  RETURN r || jsonb_build_object('por_unidade', v_por, 'alertas', v_alertas, 'sem_barcode', v_sem_bc, 'sem_tester', v_sem_t);
END;
$$;

REVOKE ALL ON FUNCTION public.fn__estoque_filtrado(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_estoque_listar(jsonb, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_estoque_resumo(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn__estoque_filtrado(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estoque_listar(jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estoque_resumo(jsonb) TO authenticated;