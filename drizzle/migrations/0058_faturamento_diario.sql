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
    SELECT v.data AS dia,
           sum(v.total) AS bruto,
           count(*)::bigint AS itens,
           coalesce(sum(v.quantidade), 0)::bigint AS qtd,
           count(DISTINCT coalesce(v.grupo_venda, v.id))::bigint AS pedidos
    FROM public.fn__vendas_filtradas(p) v
    GROUP BY v.data
  ),
  devol_dia AS (
    SELECT (d.created_at AT TIME ZONE 'America/Manaus')::date AS dia,
           sum(d.valor_total) AS devolvido
    FROM public.devolucoes d
    JOIN public.unidades u ON u.id = d.unidade_id
    WHERE d.status <> 'cancelada'
      AND public.usuario_tem_acesso_unidade(d.unidade_id)
      AND (v_dep IS NULL OR u.nome = v_dep OR coalesce(nullif(u.codigo_legado, ''), u.codigo) = v_dep)
      AND (d.created_at AT TIME ZONE 'America/Manaus')::date BETWEEN v_ini AND v_fim
    GROUP BY 1
  ),
  dias AS (
    SELECT dia FROM vendas_dia
    UNION
    SELECT dia FROM devol_dia
  )
  SELECT ds.dia,
         coalesce(vd.bruto, 0) AS bruto,
         coalesce(dd.devolvido, 0) AS devolvido,
         coalesce(vd.bruto, 0) - coalesce(dd.devolvido, 0) AS liquido,
         coalesce(vd.itens, 0) AS itens,
         coalesce(vd.qtd, 0) AS qtd,
         coalesce(vd.pedidos, 0) AS pedidos
  FROM dias ds
  LEFT JOIN vendas_dia vd ON vd.dia = ds.dia
  LEFT JOIN devol_dia dd ON dd.dia = ds.dia
  ORDER BY ds.dia DESC;
END $function$;

REVOKE ALL ON FUNCTION public.fn_faturamento_diario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_faturamento_diario(jsonb) TO authenticated;