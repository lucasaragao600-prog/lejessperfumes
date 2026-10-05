CREATE OR REPLACE FUNCTION public.fn_produtos_fiscal_listar(p_busca text DEFAULT '', p_status text DEFAULT '', p_perfil uuid DEFAULT NULL, p_tipo text DEFAULT '', p_limite int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  WITH r0 AS (
    SELECT p.id, p.codigo, p.nome, p.marca, p.tipo, p.concentracao, p.volume,
      jsonb_strip_nulls(jsonb_build_object('ncm', nullif(regexp_replace(coalesce(p.ncm,''),'\D','','g'),''), 'cfop', nullif(p.cfop,''), 'csosn', nullif(p.cst_csosn,''),
        'unidade_comercial', nullif(p.unidade_fiscal,''), 'unidade_tributavel', nullif(p.unidade_fiscal,'')))
      || coalesce(CASE WHEN f.vinculo = 'herdar' THEN jsonb_strip_nulls(to_jsonb(t) - 'id' - 'nome' - 'descricao' - 'arquivado' - 'categoria_padrao' - 'criado_por' - 'created_at' - 'updated_at') END, '{}')
      || coalesce(jsonb_strip_nulls(to_jsonb(f) - 'perfume_id' - 'perfil_id' - 'vinculo' - 'emite_nota' - 'updated_por' - 'updated_at'), '{}')
      || jsonb_build_object('perfume_id', p.id, 'perfil_id', f.perfil_id, 'perfil_nome', t.nome, 'vinculo', coalesce(f.vinculo,'herdar'), 'emite_nota', coalesce(f.emite_nota,true),
        'gtin', coalesce(nullif(p.codigo_barras,''),'SEM GTIN'),
        'sobrescritos', (SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_object_keys(coalesce(jsonb_strip_nulls(to_jsonb(f) - 'perfume_id' - 'perfil_id' - 'vinculo' - 'emite_nota' - 'updated_por' - 'updated_at'),'{}')) x)) AS r
    FROM perfumes p
    LEFT JOIN produto_fiscal f ON f.perfume_id = p.id
    LEFT JOIN perfil_tributario t ON t.id = f.perfil_id
    WHERE (coalesce(p_busca,'') = '' OR p.nome ILIKE '%'||p_busca||'%' OR p.marca ILIKE '%'||p_busca||'%' OR p.codigo ILIKE '%'||p_busca||'%' OR coalesce(p.ncm,'') LIKE '%'||p_busca||'%')
      AND (coalesce(p_tipo,'') = '' OR p.tipo = p_tipo)
  ), base AS (SELECT r0.*, public.fn_fiscal_status(r) s FROM r0),
  filt AS (
    SELECT * FROM base WHERE (coalesce(p_status,'') = '' OR s->>'status' = p_status)
      AND (p_perfil IS NULL OR (r->>'perfil_id')::uuid = p_perfil)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filt),
    'ids', CASE WHEN p_limite = 0 THEN (SELECT coalesce(jsonb_agg(id),'[]') FROM filt) END,
    'resumo', (SELECT jsonb_object_agg(st, n) FROM (SELECT s->>'status' st, count(*) n FROM base GROUP BY 1) z),
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'codigo',codigo,'nome',nome,'marca',marca,'tipo',tipo,'concentracao',concentracao,'volume',volume,'fiscal',r,'status',s) ORDER BY marca, nome)
      FROM (SELECT * FROM filt ORDER BY marca, nome LIMIT p_limite OFFSET p_offset) q), '[]'))
  INTO res;
  RETURN res;
END $$;