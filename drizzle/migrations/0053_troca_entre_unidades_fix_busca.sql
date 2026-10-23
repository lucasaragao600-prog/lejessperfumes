-- Correção: min(uuid) não existe no Postgres; todas as linhas do grupo têm a mesma unidade.
CREATE OR REPLACE FUNCTION public.fn_venda_buscar_troca(p_unidade_operacao uuid, p_busca text DEFAULT '', p_limite int DEFAULT 30)
RETURNS TABLE (grupo_venda uuid, data date, deposito text, unidade_id uuid, unidade_nome text, cliente_nome text, total numeric, cancelada boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_busca text := btrim(COALESCE(p_busca,''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.fn__pode(p_unidade_operacao, 'venda.trocar_entre_unidades') THEN
    RAISE EXCEPTION 'Sem permissão para troca entre unidades'; END IF;
  RETURN QUERY
  SELECT v.grupo_venda, min(v.data) AS data, min(v.deposito) AS deposito,
    (array_agg(v.unidade_id))[1] AS unidade_id,
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

REVOKE ALL ON FUNCTION public.fn_venda_buscar_troca(uuid,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_buscar_troca(uuid,text,int) TO authenticated;