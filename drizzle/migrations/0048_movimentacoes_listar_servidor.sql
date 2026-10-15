CREATE INDEX IF NOT EXISTS idx_mov_data_created ON public.movimentacoes (data DESC, created_at DESC, id);

CREATE OR REPLACE FUNCTION public.fn_movimentacoes_listar(p jsonb, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  WITH f AS (
    SELECT m.* FROM public.movimentacoes m
    WHERE (nullif(p->>'tipo','') IS NULL OR m.tipo = p->>'tipo')
      AND (nullif(trim(coalesce(p->>'busca','')),'') IS NULL OR m.perfume_nome ILIKE '%' || trim(p->>'busca') || '%')
  ), pg AS (
    SELECT * FROM f
    ORDER BY CASE WHEN p->>'ordem' = 'antiga' THEN data END ASC,
             CASE WHEN coalesce(p->>'ordem','recente') <> 'antiga' THEN data END DESC,
             CASE WHEN p->>'ordem' = 'antiga' THEN created_at END ASC,
             CASE WHEN coalesce(p->>'ordem','recente') <> 'antiga' THEN created_at END DESC, id
    LIMIT least(greatest(p_limit,1),200) OFFSET greatest(p_offset,0)
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
    'itens', coalesce((SELECT jsonb_agg(to_jsonb(pg)) FROM pg), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.fn_movimentacoes_listar(jsonb, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_movimentacoes_listar(jsonb, integer, integer) TO authenticated;