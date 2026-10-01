CREATE OR REPLACE FUNCTION public.fn_estoque_listar(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ordem text := coalesce(p_filtros->>'ordem', 'none');
  v_res jsonb;
BEGIN
  WITH f AS (SELECT * FROM fn__estoque_filtrado(p_filtros)),
  pag AS (
    SELECT to_jsonb(pf) || jsonb_build_object('estoques', f.estoques, 'testers', f.testers, 'qtd', f.qtd, 'tester_qtd', f.tester_qtd) AS j,
           CASE v_ordem WHEN 'asc' THEN f.qtd WHEN 'desc' THEN -f.qtd ELSE 0 END AS o1,
           pf.nome, pf.id
    FROM f JOIN perfumes pf ON pf.id = f.produto_id
    ORDER BY o1, pf.nome, pf.id
    LIMIT least(greatest(coalesce(p_limite, 30), 1), 2000) OFFSET greatest(coalesce(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'itens', coalesce((SELECT jsonb_agg(j ORDER BY o1, nome, id) FROM pag), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END;
$$;