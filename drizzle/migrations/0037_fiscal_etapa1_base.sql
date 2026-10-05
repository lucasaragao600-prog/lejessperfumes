INSERT INTO public.permissoes_catalogo (chave, modulo, descricao)
VALUES ('fiscal.configurar','fiscal','Configurar perfis e dados fiscais de produtos')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.perfil_tributario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text NOT NULL DEFAULT '',
  arquivado boolean NOT NULL DEFAULT false,
  categoria_padrao text,
  ncm text, cest text, origem text DEFAULT '0', unidade_comercial text DEFAULT 'UN', unidade_tributavel text DEFAULT 'UN',
  cfop text, csosn text, cst_icms text, aliq_icms numeric, red_bc_icms numeric, mod_bc_icms text,
  mva_st numeric, aliq_icms_st numeric, cbenef text,
  cst_pis text DEFAULT '99', aliq_pis numeric DEFAULT 0, cst_cofins text DEFAULT '99', aliq_cofins numeric DEFAULT 0,
  cst_ipi text, aliq_ipi numeric, enq_ipi text,
  cst_ibscbs text DEFAULT '000', cclass_trib text DEFAULT '000001', aliq_ibs_uf numeric DEFAULT 0.1, aliq_ibs_mun numeric DEFAULT 0, aliq_cbs numeric DEFAULT 0.9, aliq_is numeric,
  criado_por uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.perfil_tributario TO authenticated;
GRANT ALL ON public.perfil_tributario TO service_role;
ALTER TABLE public.perfil_tributario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_trib_ler" ON public.perfil_tributario;
CREATE POLICY "perfil_trib_ler" ON public.perfil_tributario FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.produto_fiscal (
  perfume_id uuid PRIMARY KEY REFERENCES public.perfumes(id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES public.perfil_tributario(id),
  vinculo text NOT NULL DEFAULT 'herdar' CHECK (vinculo IN ('herdar','copiar')),
  emite_nota boolean NOT NULL DEFAULT true,
  ncm text, cest text, origem text, unidade_comercial text, unidade_tributavel text,
  cfop text, csosn text, cst_icms text, aliq_icms numeric, red_bc_icms numeric, mod_bc_icms text,
  mva_st numeric, aliq_icms_st numeric, cbenef text,
  cst_pis text, aliq_pis numeric, cst_cofins text, aliq_cofins numeric,
  cst_ipi text, aliq_ipi numeric, enq_ipi text,
  cst_ibscbs text, cclass_trib text, aliq_ibs_uf numeric, aliq_ibs_mun numeric, aliq_cbs numeric, aliq_is numeric,
  updated_por uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.produto_fiscal TO authenticated;
GRANT ALL ON public.produto_fiscal TO service_role;
ALTER TABLE public.produto_fiscal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "produto_fiscal_ler" ON public.produto_fiscal;
CREATE POLICY "produto_fiscal_ler" ON public.produto_fiscal FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.historico_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL, entidade_id uuid NOT NULL, acao text NOT NULL,
  antes jsonb, depois jsonb, usuario_id uuid, usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historico_fiscal_ent_idx ON public.historico_fiscal(entidade, entidade_id, created_at DESC);
GRANT SELECT ON public.historico_fiscal TO authenticated;
GRANT ALL ON public.historico_fiscal TO service_role;
ALTER TABLE public.historico_fiscal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "historico_fiscal_ler" ON public.historico_fiscal;
CREATE POLICY "historico_fiscal_ler" ON public.historico_fiscal FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master'));

CREATE TABLE IF NOT EXISTS public.nfce_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emissao_id uuid REFERENCES public.nfce_emissoes(id),
  venda_grupo_venda uuid, unidade_id uuid,
  numero integer, serie integer, ambiente text,
  cstat text, motivo text, protocolo text,
  xml_enviado text, xml_retorno text, erros_validacao jsonb,
  usuario_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nfce_tentativas_grupo_idx ON public.nfce_tentativas(venda_grupo_venda, created_at DESC);
GRANT ALL ON public.nfce_tentativas TO service_role;
ALTER TABLE public.nfce_tentativas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_produto_fiscal_resolver(p_perfume_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p perfumes; f produto_fiscal; t perfil_tributario; r jsonb; base jsonb; ov jsonb;
BEGIN
  SELECT * INTO p FROM perfumes WHERE id = p_perfume_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO f FROM produto_fiscal WHERE perfume_id = p_perfume_id;
  IF f.perfil_id IS NOT NULL AND f.vinculo = 'herdar' THEN SELECT * INTO t FROM perfil_tributario WHERE id = f.perfil_id; END IF;
  base := jsonb_strip_nulls(jsonb_build_object('ncm', nullif(regexp_replace(coalesce(p.ncm,''),'\D','','g'),''),
    'cfop', nullif(p.cfop,''), 'csosn', nullif(p.cst_csosn,''), 'unidade_comercial', nullif(p.unidade_fiscal,''), 'unidade_tributavel', nullif(p.unidade_fiscal,'')));
  r := base || coalesce(jsonb_strip_nulls(to_jsonb(t) - 'id' - 'nome' - 'descricao' - 'arquivado' - 'categoria_padrao' - 'criado_por' - 'created_at' - 'updated_at'), '{}');
  ov := coalesce(jsonb_strip_nulls(to_jsonb(f) - 'perfume_id' - 'perfil_id' - 'vinculo' - 'emite_nota' - 'updated_por' - 'updated_at'), '{}');
  r := r || ov;
  RETURN r || jsonb_build_object('perfume_id', p.id, 'perfil_id', f.perfil_id, 'perfil_nome', t.nome, 'vinculo', coalesce(f.vinculo,'herdar'),
    'emite_nota', coalesce(f.emite_nota, true), 'gtin', coalesce(nullif(p.codigo_barras,''),'SEM GTIN'), 'sobrescritos', (SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_object_keys(ov) x));
END $$;

CREATE OR REPLACE FUNCTION public.fn_fiscal_status(r jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE erros text[] := '{}'; faltam text[] := '{}';
BEGIN
  IF NOT coalesce((r->>'emite_nota')::boolean, true) THEN RETURN jsonb_build_object('status','nao_emite','erros','[]'::jsonb,'faltam','[]'::jsonb); END IF;
  IF r->>'ncm' IS NULL THEN faltam := faltam || 'ncm'; ELSIF r->>'ncm' !~ '^\d{8}$' THEN erros := erros || 'NCM deve ter 8 dígitos'; END IF;
  IF r->>'cfop' IS NULL THEN faltam := faltam || 'cfop'; ELSIF r->>'cfop' !~ '^[5]\d{3}$' THEN erros := erros || 'CFOP de venda interna deve começar com 5'; END IF;
  IF r->>'csosn' IS NULL AND r->>'cst_icms' IS NULL THEN faltam := faltam || 'csosn';
  ELSIF r->>'csosn' IS NOT NULL AND r->>'csosn' NOT IN ('101','102','103','300','400','500','900') THEN erros := erros || 'CSOSN inválido'; END IF;
  IF r->>'csosn' = '500' AND r->>'cfop' IS NOT NULL AND r->>'cfop' NOT IN ('5405','5656','5667') THEN erros := erros || 'CSOSN 500 exige CFOP de ST (5405)'; END IF;
  IF r->>'csosn' IN ('101','102','103','300','400') AND r->>'cfop' = '5405' THEN erros := erros || 'CFOP 5405 exige CSOSN 500'; END IF;
  IF r->>'origem' IS NOT NULL AND r->>'origem' !~ '^[0-8]$' THEN erros := erros || 'Origem deve ser de 0 a 8'; END IF;
  IF r->>'cest' IS NOT NULL AND r->>'cest' !~ '^\d{7}$' THEN erros := erros || 'CEST deve ter 7 dígitos'; END IF;
  RETURN jsonb_build_object('status', CASE WHEN cardinality(erros) > 0 THEN 'erro' WHEN cardinality(faltam) > 0 THEN 'incompleto' ELSE 'completo' END,
    'erros', to_jsonb(erros), 'faltam', to_jsonb(faltam));
END $$;

CREATE OR REPLACE FUNCTION public.fn_produtos_fiscal_listar(p_busca text DEFAULT '', p_status text DEFAULT '', p_perfil uuid DEFAULT NULL, p_tipo text DEFAULT '', p_limite int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  WITH base AS (
    SELECT p.id, p.codigo, p.nome, p.marca, p.tipo, p.concentracao, p.volume, r, public.fn_fiscal_status(r) s
    FROM perfumes p CROSS JOIN LATERAL (SELECT public.fn_produto_fiscal_resolver(p.id) r) x
    WHERE (coalesce(p_busca,'') = '' OR p.nome ILIKE '%'||p_busca||'%' OR p.marca ILIKE '%'||p_busca||'%' OR p.codigo ILIKE '%'||p_busca||'%' OR coalesce(p.ncm,'') LIKE '%'||p_busca||'%')
      AND (coalesce(p_tipo,'') = '' OR p.tipo = p_tipo)
  ), filt AS (
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

CREATE OR REPLACE FUNCTION public.fn__fiscal_pode() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'master') OR EXISTS (SELECT 1 FROM role_permissions rp JOIN user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = auth.uid() AND rp.permission = 'fiscal.configurar')
$$;

CREATE OR REPLACE FUNCTION public.fn_perfil_tributario_salvar(p_id uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE antes jsonb; novo perfil_tributario; v_id uuid;
BEGIN
  IF NOT public.fn__fiscal_pode() THEN RAISE EXCEPTION 'Sem permissão para configurar dados fiscais'; END IF;
  IF coalesce(trim(p_dados->>'nome'),'') = '' THEN RAISE EXCEPTION 'Informe o nome do perfil'; END IF;
  IF p_id IS NOT NULL THEN SELECT to_jsonb(t) INTO antes FROM perfil_tributario t WHERE id = p_id FOR UPDATE; END IF;
  novo := jsonb_populate_record(coalesce((SELECT t FROM perfil_tributario t WHERE id = p_id), NULL::perfil_tributario), p_dados);
  IF p_id IS NULL THEN
    novo.id := gen_random_uuid(); novo.criado_por := auth.uid(); novo.created_at := now(); novo.updated_at := now();
    novo.arquivado := coalesce(novo.arquivado,false); novo.descricao := coalesce(novo.descricao,'');
    INSERT INTO perfil_tributario SELECT (novo).*;
  ELSE
    UPDATE perfil_tributario t SET (nome,descricao,arquivado,categoria_padrao,ncm,cest,origem,unidade_comercial,unidade_tributavel,cfop,csosn,cst_icms,aliq_icms,red_bc_icms,mod_bc_icms,mva_st,aliq_icms_st,cbenef,cst_pis,aliq_pis,cst_cofins,aliq_cofins,cst_ipi,aliq_ipi,enq_ipi,cst_ibscbs,cclass_trib,aliq_ibs_uf,aliq_ibs_mun,aliq_cbs,aliq_is,updated_at)
      = (novo.nome,coalesce(novo.descricao,''),coalesce(novo.arquivado,false),novo.categoria_padrao,novo.ncm,novo.cest,novo.origem,novo.unidade_comercial,novo.unidade_tributavel,novo.cfop,novo.csosn,novo.cst_icms,novo.aliq_icms,novo.red_bc_icms,novo.mod_bc_icms,novo.mva_st,novo.aliq_icms_st,novo.cbenef,novo.cst_pis,novo.aliq_pis,novo.cst_cofins,novo.aliq_cofins,novo.cst_ipi,novo.aliq_ipi,novo.enq_ipi,novo.cst_ibscbs,novo.cclass_trib,novo.aliq_ibs_uf,novo.aliq_ibs_mun,novo.aliq_cbs,novo.aliq_is,now())
      WHERE t.id = p_id;
    novo.id := p_id;
  END IF;
  v_id := novo.id;
  INSERT INTO historico_fiscal(entidade,entidade_id,acao,antes,depois,usuario_id,usuario_nome)
    VALUES ('perfil', v_id, CASE WHEN p_id IS NULL THEN 'criar' ELSE 'editar' END, antes, (SELECT to_jsonb(t) FROM perfil_tributario t WHERE id = v_id), auth.uid(), public.fn__nome_usuario(auth.uid()));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_perfil_aplicar(p_perfil uuid, p_produtos uuid[], p_modo text DEFAULT 'sobrescrever', p_vinculo text DEFAULT 'herdar', p_previa boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t perfil_tributario; pid uuid; antes jsonb; depois jsonb; campos jsonb; alterados int := 0; amostra jsonb := '[]'; k text;
  cols text[] := ARRAY['ncm','cest','origem','unidade_comercial','unidade_tributavel','cfop','csosn','cst_icms','aliq_icms','red_bc_icms','mod_bc_icms','mva_st','aliq_icms_st','cbenef','cst_pis','aliq_pis','cst_cofins','aliq_cofins','cst_ipi','aliq_ipi','enq_ipi','cst_ibscbs','cclass_trib','aliq_ibs_uf','aliq_ibs_mun','aliq_cbs','aliq_is'];
  sets jsonb;
BEGIN
  IF NOT public.fn__fiscal_pode() THEN RAISE EXCEPTION 'Sem permissão para configurar dados fiscais'; END IF;
  IF p_modo NOT IN ('sobrescrever','vazios') OR p_vinculo NOT IN ('herdar','copiar') THEN RAISE EXCEPTION 'Opção inválida'; END IF;
  IF cardinality(p_produtos) > 2000 THEN RAISE EXCEPTION 'Máximo de 2000 produtos por vez'; END IF;
  SELECT * INTO t FROM perfil_tributario WHERE id = p_perfil AND NOT arquivado;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado ou arquivado'; END IF;
  FOREACH pid IN ARRAY p_produtos LOOP
    PERFORM 1 FROM perfumes WHERE id = pid FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    antes := public.fn_produto_fiscal_resolver(pid);
    sets := '{}';
    FOREACH k IN ARRAY cols LOOP
      IF to_jsonb(t)->>k IS NULL THEN CONTINUE; END IF;
      IF p_modo = 'vazios' AND antes->>k IS NOT NULL THEN sets := sets || jsonb_build_object(k, antes->k);
      ELSIF p_vinculo = 'copiar' THEN sets := sets || jsonb_build_object(k, to_jsonb(t)->k);
      ELSE sets := sets || jsonb_build_object(k, NULL);
      END IF;
    END LOOP;
    IF p_previa THEN
      depois := antes || jsonb_strip_nulls(to_jsonb(t) - 'id' - 'nome' - 'descricao' - 'arquivado' - 'categoria_padrao' - 'criado_por' - 'created_at' - 'updated_at');
      IF p_modo = 'vazios' THEN depois := depois || (SELECT coalesce(jsonb_object_agg(key, value),'{}') FROM jsonb_each(antes) WHERE key = ANY(cols)); END IF;
    ELSE
      INSERT INTO produto_fiscal(perfume_id) VALUES (pid) ON CONFLICT DO NOTHING;
      UPDATE produto_fiscal pf SET perfil_id = p_perfil, vinculo = p_vinculo, updated_por = auth.uid(), updated_at = now() WHERE perfume_id = pid;
      UPDATE produto_fiscal pf SET (ncm,cest,origem,unidade_comercial,unidade_tributavel,cfop,csosn,cst_icms,aliq_icms,red_bc_icms,mod_bc_icms,mva_st,aliq_icms_st,cbenef,cst_pis,aliq_pis,cst_cofins,aliq_cofins,cst_ipi,aliq_ipi,enq_ipi,cst_ibscbs,cclass_trib,aliq_ibs_uf,aliq_ibs_mun,aliq_cbs,aliq_is)
        = (SELECT r.ncm,r.cest,r.origem,r.unidade_comercial,r.unidade_tributavel,r.cfop,r.csosn,r.cst_icms,r.aliq_icms,r.red_bc_icms,r.mod_bc_icms,r.mva_st,r.aliq_icms_st,r.cbenef,r.cst_pis,r.aliq_pis,r.cst_cofins,r.aliq_cofins,r.cst_ipi,r.aliq_ipi,r.enq_ipi,r.cst_ibscbs,r.cclass_trib,r.aliq_ibs_uf,r.aliq_ibs_mun,r.aliq_cbs,r.aliq_is
           FROM jsonb_populate_record(pf, sets) r)
        WHERE perfume_id = pid;
      depois := public.fn_produto_fiscal_resolver(pid);
      INSERT INTO historico_fiscal(entidade,entidade_id,acao,antes,depois,usuario_id,usuario_nome)
        VALUES ('produto', pid, 'aplicar_perfil:'||t.nome, antes, depois, auth.uid(), public.fn__nome_usuario(auth.uid()));
    END IF;
    campos := (SELECT coalesce(jsonb_object_agg(key, jsonb_build_object('de', antes->key, 'para', value)),'{}') FROM jsonb_each(depois) WHERE key = ANY(cols) AND (antes->key) IS DISTINCT FROM value);
    IF campos <> '{}' THEN
      alterados := alterados + 1;
      IF jsonb_array_length(amostra) < 20 THEN amostra := amostra || jsonb_build_object('perfume_id', pid, 'campos', campos); END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('total', cardinality(p_produtos), 'alterados', alterados, 'amostra', amostra, 'previa', p_previa);
END $$;

CREATE OR REPLACE FUNCTION public.fn_produto_fiscal_salvar(p_perfume_id uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE antes jsonb; f produto_fiscal;
BEGIN
  IF NOT public.fn__fiscal_pode() THEN RAISE EXCEPTION 'Sem permissão para configurar dados fiscais'; END IF;
  PERFORM 1 FROM perfumes WHERE id = p_perfume_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  antes := public.fn_produto_fiscal_resolver(p_perfume_id);
  INSERT INTO produto_fiscal(perfume_id) VALUES (p_perfume_id) ON CONFLICT DO NOTHING;
  SELECT * INTO f FROM produto_fiscal WHERE perfume_id = p_perfume_id;
  f := jsonb_populate_record(f, p_dados - 'perfume_id' - 'updated_por' - 'updated_at');
  UPDATE produto_fiscal SET perfil_id=f.perfil_id, vinculo=coalesce(f.vinculo,'herdar'), emite_nota=coalesce(f.emite_nota,true),
    ncm=nullif(f.ncm,''),cest=nullif(f.cest,''),origem=nullif(f.origem,''),unidade_comercial=nullif(f.unidade_comercial,''),unidade_tributavel=nullif(f.unidade_tributavel,''),
    cfop=nullif(f.cfop,''),csosn=nullif(f.csosn,''),cst_icms=nullif(f.cst_icms,''),aliq_icms=f.aliq_icms,red_bc_icms=f.red_bc_icms,mod_bc_icms=nullif(f.mod_bc_icms,''),
    mva_st=f.mva_st,aliq_icms_st=f.aliq_icms_st,cbenef=nullif(f.cbenef,''),cst_pis=nullif(f.cst_pis,''),aliq_pis=f.aliq_pis,cst_cofins=nullif(f.cst_cofins,''),aliq_cofins=f.aliq_cofins,
    cst_ipi=nullif(f.cst_ipi,''),aliq_ipi=f.aliq_ipi,enq_ipi=nullif(f.enq_ipi,''),cst_ibscbs=nullif(f.cst_ibscbs,''),cclass_trib=nullif(f.cclass_trib,''),
    aliq_ibs_uf=f.aliq_ibs_uf,aliq_ibs_mun=f.aliq_ibs_mun,aliq_cbs=f.aliq_cbs,aliq_is=f.aliq_is, updated_por=auth.uid(), updated_at=now()
  WHERE perfume_id = p_perfume_id;
  INSERT INTO historico_fiscal(entidade,entidade_id,acao,antes,depois,usuario_id,usuario_nome)
    VALUES ('produto', p_perfume_id, 'editar', antes, public.fn_produto_fiscal_resolver(p_perfume_id), auth.uid(), public.fn__nome_usuario(auth.uid()));
  RETURN public.fn_produto_fiscal_resolver(p_perfume_id);
END $$;

REVOKE ALL ON FUNCTION public.fn_produto_fiscal_resolver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produto_fiscal_resolver(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_produtos_fiscal_listar(text,text,uuid,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produtos_fiscal_listar(text,text,uuid,text,int,int) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_perfil_tributario_salvar(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_perfil_tributario_salvar(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_perfil_aplicar(uuid,uuid[],text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_perfil_aplicar(uuid,uuid[],text,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_produto_fiscal_salvar(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produto_fiscal_salvar(uuid,jsonb) TO authenticated;

INSERT INTO public.perfil_tributario (nome, descricao, ncm, origem, cfop, csosn)
VALUES ('Perfume Simples Nacional com ST', 'Perfumaria com ICMS retido por substituição tributária (CFOP 5405, CSOSN 500)', '33030010', '0', '5405', '500'),
       ('Perfume Simples Nacional sem ST', 'Perfumaria tributada no Simples sem ST (CFOP 5102, CSOSN 102)', '33030010', '0', '5102', '102')
ON CONFLICT (nome) DO NOTHING;
