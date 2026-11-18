CREATE OR REPLACE FUNCTION public.fn_faturamento_diario(p jsonb)
RETURNS TABLE(
  dia date,
  bruto numeric,
  devolvido numeric,
  liquido numeric,
  itens bigint,
  qtd bigint,
  pedidos bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := nullif(p->>'data_ini', '')::date;
  v_fim date := nullif(p->>'data_fim', '')::date;
  v_dep text := nullif(p->>'deposito', '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_ini IS NULL OR v_fim IS NULL THEN RAISE EXCEPTION 'Informe o período (início e fim)'; END IF;
  IF v_ini > v_fim THEN RAISE EXCEPTION 'A data de início não pode ser maior que a data de fim'; END IF;
  IF v_fim - v_ini > 366 THEN RAISE EXCEPTION 'Período máximo de 366 dias'; END IF;

  RETURN QUERY
  WITH vendas_dia AS (
    SELECT v.data AS d,
           sum(v.total) AS v_bruto,
           count(*)::bigint AS v_itens,
           coalesce(sum(v.quantidade), 0)::bigint AS v_qtd,
           count(DISTINCT coalesce(v.grupo_venda, v.id))::bigint AS v_pedidos
    FROM public.fn__vendas_filtradas(p) v
    GROUP BY v.data
  ),
  devol_dia AS (
    SELECT (dv.created_at AT TIME ZONE 'America/Manaus')::date AS d,
           sum(dv.valor_total) AS d_devolvido
    FROM public.devolucoes dv
    JOIN public.unidades u ON u.id = dv.unidade_id
    WHERE dv.status <> 'cancelada'
      AND public.usuario_tem_acesso_unidade(dv.unidade_id)
      AND (v_dep IS NULL OR u.nome = v_dep OR coalesce(nullif(u.codigo_legado, ''), u.codigo) = v_dep)
      AND (dv.created_at AT TIME ZONE 'America/Manaus')::date BETWEEN v_ini AND v_fim
    GROUP BY 1
  ),
  dias AS (
    SELECT vd.d FROM vendas_dia vd
    UNION
    SELECT dd.d FROM devol_dia dd
  )
  SELECT ds.d,
         coalesce(vd.v_bruto, 0),
         coalesce(dd.d_devolvido, 0),
         coalesce(vd.v_bruto, 0) - coalesce(dd.d_devolvido, 0),
         coalesce(vd.v_itens, 0),
         coalesce(vd.v_qtd, 0),
         coalesce(vd.v_pedidos, 0)
  FROM dias ds
  LEFT JOIN vendas_dia vd ON vd.d = ds.d
  LEFT JOIN devol_dia dd ON dd.d = ds.d
  ORDER BY ds.d DESC;
END $function$;

REVOKE ALL ON FUNCTION public.fn_faturamento_diario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_faturamento_diario(jsonb) TO authenticated;