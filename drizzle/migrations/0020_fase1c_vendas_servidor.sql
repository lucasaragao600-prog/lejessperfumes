CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_vendas_perfume_nome_trgm ON public.vendas USING gin (perfume_nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vendas_deposito_data ON public.vendas (deposito, data DESC) WHERE cancelada = false;

CREATE OR REPLACE FUNCTION public.fn__vendas_filtradas(p jsonb)
RETURNS SETOF public.vendas
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_dep text := nullif(p->>'deposito', '');
  v_vend text := nullif(p->>'vendedora', '');
  v_busca text := nullif(trim(coalesce(p->>'busca', '')), '');
  v_ini date := nullif(p->>'data_ini', '')::date;
  v_fim date := nullif(p->>'data_fim', '')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  RETURN QUERY
  WITH uni AS (
    SELECT u.id, coalesce(nullif(u.codigo_legado, ''), u.codigo) AS chave, u.nome
    FROM unidades u WHERE usuario_tem_acesso_unidade(u.id)
  )
  SELECT v.* FROM vendas v
  WHERE v.cancelada = false
    AND EXISTS (SELECT 1 FROM uni WHERE uni.id = v.unidade_id OR (v.unidade_id IS NULL AND (uni.chave = v.deposito OR uni.nome = v.deposito)))
    AND (v_dep IS NULL OR v.deposito = v_dep)
    AND (v_vend IS NULL OR v.vendedora = v_vend)
    AND (v_ini IS NULL OR v.data >= v_ini)
    AND (v_fim IS NULL OR v.data <= v_fim)
    AND (v_busca IS NULL OR v.perfume_nome ILIKE '%' || v_busca || '%' OR v.vendedora ILIKE '%' || v_busca || '%');
END $$;

CREATE OR REPLACE FUNCTION public.fn_vendas_listar(p jsonb, p_limit int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS SETOF public.vendas
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM public.fn__vendas_filtradas(p) f
  ORDER BY CASE WHEN coalesce(p->>'ordem','recente') = 'antiga' THEN f.data END ASC,
           CASE WHEN coalesce(p->>'ordem','recente') <> 'antiga' THEN f.data END DESC,
           f.created_at DESC, f.id
  LIMIT least(greatest(p_limit, 1), 2000) OFFSET greatest(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.fn_vendas_resumo(p jsonb)
RETURNS TABLE(valor numeric, itens bigint, qtd bigint, grupos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(sum(total), 0), coalesce(sum(quantidade), 0)::bigint, count(*)::bigint,
         count(DISTINCT coalesce(grupo_venda, id))::bigint
  FROM public.fn__vendas_filtradas(p);
$$;

REVOKE ALL ON FUNCTION public.fn__vendas_filtradas(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_vendas_listar(jsonb, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_vendas_resumo(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn__vendas_filtradas(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vendas_listar(jsonb, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vendas_resumo(jsonb) TO authenticated;