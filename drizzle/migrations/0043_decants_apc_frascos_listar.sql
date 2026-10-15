CREATE OR REPLACE FUNCTION public.fn_decant_frascos_listar(p_unidade_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.aberto_em), '[]'::jsonb) FROM (
    SELECT f.id, f.codigo, f.produto_id, p.codigo AS produto_codigo, p.marca, p.nome, p.concentracao, f.unidade_id,
      u.nome_exibicao AS unidade_nome, f.lote_fabricante, f.validade, f.volume_nominal_ml, f.volume_inicial_ml,
      f.custo, f.custo_ml, f.status, f.aberto_em, f.aberto_por_nome, f.responsavel,
      public.fn_decant_saldo_frasco(f.id) AS saldo_ml,
      COALESCE(public.fn_decant_reservado_frasco(f.id, NULL),0) AS reservado_ml,
      f.ml_decants, f.dividido_em,
      (SELECT jsonb_build_object('id',a.id,'ml',a.ml_reservado,'preco',a.preco,'status',a.status) FROM public.decant_apc a WHERE a.frasco_id=f.id) AS apc,
      (SELECT count(*) FROM public.decant_conferencias c WHERE c.frasco_id=f.id AND c.status='pendente') AS pendencias
    FROM public.decant_frascos f JOIN public.perfumes p ON p.id=f.produto_id JOIN public.unidades u ON u.id=f.unidade_id
    WHERE (p_unidade_id IS NULL OR f.unidade_id = p_unidade_id) AND public.fn__pode(f.unidade_id,'decant.ver')
  ) x
$function$;