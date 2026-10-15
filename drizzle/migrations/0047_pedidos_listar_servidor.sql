CREATE OR REPLACE FUNCTION public.fn__pedidos_grupos(p jsonb)
RETURNS TABLE(grupo text, data date, criado timestamptz, valor numeric, qtd bigint, cliente_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH f AS (SELECT * FROM public.fn__vendas_filtradas(p - 'busca')),
  g AS (
    SELECT coalesce(f.grupo_venda::text, f.id::text) AS grupo, max(f.data) AS data, max(f.created_at) AS criado,
           sum(f.total) AS valor, sum(f.quantidade)::bigint AS qtd,
           (array_agg(f.cliente_id) FILTER (WHERE f.cliente_id IS NOT NULL))[1] AS cliente_id,
           string_agg(coalesce(f.perfume_nome,'') || ' ' || coalesce(f.vendedora,'') || ' ' || coalesce(f.registrado_por,''), ' ') AS texto
    FROM f GROUP BY 1
  )
  SELECT g.grupo, g.data, g.criado, g.valor, g.qtd, c.nome
  FROM g LEFT JOIN public.clientes c ON c.id = g.cliente_id
  WHERE nullif(trim(coalesce(p->>'busca','')),'') IS NULL
     OR g.grupo ILIKE trim(p->>'busca') || '%'
     OR g.texto ILIKE '%' || trim(p->>'busca') || '%'
     OR c.nome ILIKE '%' || trim(p->>'busca') || '%'
     OR g.data::text LIKE trim(p->>'busca') || '%';
$$;

CREATE OR REPLACE FUNCTION public.fn_pedidos_listar(p jsonb, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH pg AS (
    SELECT * FROM public.fn__pedidos_grupos(p)
    ORDER BY data DESC, criado DESC, grupo
    LIMIT least(greatest(p_limit,1),200) OFFSET greatest(p_offset,0)
  )
  SELECT jsonb_build_object(
    'grupos', coalesce((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'cliente_nome', cliente_nome) ORDER BY data DESC, criado DESC, grupo) FROM pg), '[]'::jsonb),
    'itens', coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.vendas v
       WHERE v.cancelada = false AND coalesce(v.grupo_venda::text, v.id::text) IN (SELECT grupo FROM pg)), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_pedidos_resumo(p jsonb)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object('pedidos', count(*), 'valor', coalesce(sum(valor),0), 'qtd', coalesce(sum(qtd),0))
  FROM public.fn__pedidos_grupos(p);
$$;

REVOKE ALL ON FUNCTION public.fn__pedidos_grupos(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_pedidos_listar(jsonb, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_pedidos_resumo(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pedidos_listar(jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pedidos_resumo(jsonb) TO authenticated;