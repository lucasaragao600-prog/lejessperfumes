INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
  ('custo.ver','custo','Ver custo, custo médio, lucro, margem e valor de estoque a custo'),
  ('produto.editar','produto','Editar cadastro de produto')
ON CONFLICT (chave) DO NOTHING;

-- Padrão do Vendedor Líder: tudo do Vendedor + gestão da loja (sem custo)
INSERT INTO public.role_permissions (role, permission)
SELECT 'vendedor_lider'::public.app_role, p FROM (
  SELECT permission AS p FROM public.role_permissions WHERE role = 'vendedor'
  UNION SELECT unnest(ARRAY[
    'venda.visualizar','venda.realizar','venda.desconto','venda.cancelar','venda.devolver','venda.trocar',
    'credito.gerenciar','caixa.abrir','caixa.sangria','caixa.suprimento','caixa.fechar',
    'estoque.visualizar','estoque.movimentar','estoque.transferir',
    'reposicao.criar','reposicao.separar','reposicao.enviar','reposicao.receber','reposicao.aprovar_divergencia',
    'relatorio.visualizar','fiscal.visualizar','fiscal.emitir'])
) x
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role = 'vendedor_lider' AND rp.permission = x.p);

CREATE OR REPLACE FUNCTION public.fn__ver_custos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'custo.ver'))
$$;
GRANT EXECUTE ON FUNCTION public.fn__ver_custos() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_produtos_custos()
RETURNS TABLE(id uuid, custo numeric, custo_medio numeric, ultimo_custo_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.custo::numeric, p.custo_medio::numeric, p.ultimo_custo_em::timestamptz
  FROM public.perfumes p WHERE public.fn__ver_custos()
$$;
REVOKE ALL ON FUNCTION public.fn_produtos_custos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_produtos_custos() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_testers_custos()
RETURNS TABLE(id uuid, custo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.custo::numeric FROM public.testers t
  WHERE public.fn__ver_custos() AND public.usuario_tem_acesso_unidade(t.unidade_id)
$$;
REVOKE ALL ON FUNCTION public.fn_testers_custos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_testers_custos() TO authenticated;

-- Colunas de custo deixam de ser legíveis direto pela API
REVOKE SELECT ON public.perfumes FROM anon, authenticated;
GRANT SELECT (id,codigo,nome,marca,casa_sigla,tipo,concentracao,tamanho,volume,preco_venda,estoque_casa,estoque_sumauma,estoque_amazonas,estoque_minimo,created_at,updated_at,image_url,ncm,cfop,cst_csosn,unidade_fiscal,codigo_barras,classificacao,perfil_olfativo,notas_saida,notas_coracao,notas_fundo,ativo,inativado_em,inativado_por,inativado_motivo) ON public.perfumes TO anon, authenticated;
REVOKE SELECT ON public.testers FROM anon, authenticated;
GRANT SELECT (id,perfume_id,perfume_nome,marca,deposito,quantidade,created_at,registrado_por,unidade_id) ON public.testers TO anon, authenticated;

-- Linhas com custo: só quem pode ver custo
ALTER POLICY "Authenticated can read produto_custos" ON public.produto_custos USING (public.fn__ver_custos());
ALTER POLICY "Authenticated can read preco_historico" ON public.preco_historico USING (public.fn__ver_custos());
ALTER POLICY "Authenticated can read notas_fiscais_itens" ON public.notas_fiscais_itens USING (public.fn__ver_custos());
ALTER POLICY "Authenticated users can read testers" ON public.testers USING (public.usuario_tem_acesso_unidade(unidade_id));
ALTER POLICY "Authenticated can update perfume stock" ON public.perfumes USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'produto.editar'));

CREATE OR REPLACE FUNCTION public.fn_estoque_listar(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vc boolean := public.fn__ver_custos();
  v_f jsonb := CASE WHEN public.fn__ver_custos() THEN coalesce(p_filtros,'{}'::jsonb) ELSE coalesce(p_filtros,'{}'::jsonb) - 'custo_min' - 'custo_max' END;
  v_ordem text := coalesce(p_filtros->>'ordem', 'none');
  v_res jsonb;
BEGIN
  WITH f AS (SELECT * FROM fn__estoque_filtrado(v_f)),
  pag AS (
    SELECT (CASE WHEN v_vc THEN to_jsonb(pf) ELSE to_jsonb(pf) - 'custo' - 'custo_medio' - 'ultimo_custo_em' END)
             || jsonb_build_object('estoques', f.estoques, 'testers', f.testers, 'qtd', f.qtd, 'tester_qtd', f.tester_qtd) AS j,
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

CREATE OR REPLACE FUNCTION public.fn_estoque_resumo(p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vc boolean := public.fn__ver_custos();
  v_f jsonb := CASE WHEN public.fn__ver_custos() THEN coalesce(p_filtros,'{}'::jsonb) ELSE coalesce(p_filtros,'{}'::jsonb) - 'custo_min' - 'custo_max' END;
  r jsonb; v_por jsonb; v_alertas bigint; v_sem_bc bigint; v_sem_t bigint;
BEGIN
  SELECT jsonb_build_object(
           'total', count(*),
           'unidades', coalesce(sum(f.qtd), 0),
           'custo', CASE WHEN v_vc THEN coalesce(sum(f.qtd * pf.custo), 0) END,
           'venda', coalesce(sum(f.qtd * pf.preco_venda), 0))
  INTO r
  FROM fn__estoque_filtrado(v_f) f JOIN perfumes pf ON pf.id = f.produto_id;

  SELECT coalesce(jsonb_object_agg(k, s), '{}'::jsonb) INTO v_por FROM (
    SELECT e.key AS k, sum(e.value::numeric) AS s
    FROM fn__estoque_filtrado(v_f) f, jsonb_each_text(f.estoques) e
    GROUP BY e.key
  ) z;

  SELECT count(*) INTO v_alertas FROM fn__estoque_filtrado(jsonb_build_object('unidade', v_f->>'unidade', 'alertas', true));
  SELECT count(*) INTO v_sem_bc FROM fn__estoque_filtrado(jsonb_build_object('especial', 'sem_barcode'));
  SELECT count(*) INTO v_sem_t FROM fn__estoque_filtrado(jsonb_build_object('especial', 'sem_tester'));

  RETURN r || jsonb_build_object('por_unidade', v_por, 'alertas', v_alertas, 'sem_barcode', v_sem_bc, 'sem_tester', v_sem_t);
END;
$$;