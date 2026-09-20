-- FASE 7 — Fiscal e Caixa por unidade (aditiva e idempotente)

-- 1) Uma configuração fiscal por unidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_fiscal_unidade
  ON public.configuracoes_fiscais(unidade_id)
  WHERE unidade_id IS NOT NULL;

-- 2) Leitura segura: nunca devolve CSC token nem senha do certificado
CREATE OR REPLACE FUNCTION public.fn_config_fiscal_unidade_ler(p_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.configuracoes_fiscais;
BEGIN
  IF NOT public.usuario_tem_acesso_unidade(p_unidade_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta unidade.';
  END IF;

  SELECT * INTO r FROM public.configuracoes_fiscais WHERE unidade_id = p_unidade_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'unidade_id', r.unidade_id,
    'cnpj', r.cnpj,
    'inscricao_estadual', r.inscricao_estadual,
    'razao_social', r.razao_social,
    'nome_fantasia', r.nome_fantasia,
    'endereco', r.endereco,
    'numero', r.numero,
    'complemento', r.complemento,
    'bairro', r.bairro,
    'cidade', r.cidade,
    'uf', r.uf,
    'cep', r.cep,
    'telefone', r.telefone,
    'regime_tributario', r.regime_tributario,
    'ambiente', r.ambiente,
    'serie_nfce', r.serie_nfce,
    'proximo_numero_nfce', r.proximo_numero_nfce,
    'csc_id', r.csc_id,
    'logo_url', r.logo_url,
    'certificado_digital_url', r.certificado_digital_url,
    'csc_token_configurado', COALESCE(r.csc_token,'') <> '',
    'certificado_configurado', COALESCE(r.certificado_digital_url,'') <> '',
    'certificado_senha_configurada', COALESCE(r.certificado_senha,'') <> '',
    'updated_at', r.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.fn_config_fiscal_unidade_ler(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_config_fiscal_unidade_ler(uuid) TO authenticated;

-- 3) Gravação: segredos só são sobrescritos quando enviados preenchidos
CREATE OR REPLACE FUNCTION public.fn_config_fiscal_unidade_salvar(
  p_unidade_id uuid,
  p_cnpj text, p_inscricao_estadual text, p_razao_social text, p_nome_fantasia text,
  p_endereco text, p_numero text, p_complemento text, p_bairro text, p_cidade text,
  p_uf text, p_cep text, p_telefone text, p_regime_tributario text, p_ambiente text,
  p_serie_nfce integer, p_proximo_numero_nfce integer, p_csc_id text,
  p_csc_token text DEFAULT '', p_certificado_senha text DEFAULT '', p_certificado_digital_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'master') OR public.usuario_tem_permissao(p_unidade_id,'fiscal.emitir')) THEN
    RAISE EXCEPTION 'Sem permissão para configurar o fiscal desta unidade.';
  END IF;
  IF p_ambiente NOT IN ('homologacao','producao') THEN
    RAISE EXCEPTION 'Ambiente inválido.';
  END IF;
  IF COALESCE(p_serie_nfce,0) < 1 OR COALESCE(p_proximo_numero_nfce,0) < 1 THEN
    RAISE EXCEPTION 'Série e próximo número devem ser maiores que zero.';
  END IF;

  SELECT id INTO v_id FROM public.configuracoes_fiscais WHERE unidade_id = p_unidade_id;

  IF v_id IS NULL THEN
    INSERT INTO public.configuracoes_fiscais (
      unidade_id, cnpj, inscricao_estadual, razao_social, nome_fantasia, endereco, numero,
      complemento, bairro, cidade, uf, cep, telefone, regime_tributario, ambiente,
      serie_nfce, proximo_numero_nfce, csc_id, csc_token, certificado_senha, certificado_digital_url
    ) VALUES (
      p_unidade_id, COALESCE(p_cnpj,''), COALESCE(p_inscricao_estadual,''), COALESCE(p_razao_social,''),
      COALESCE(p_nome_fantasia,''), COALESCE(p_endereco,''), COALESCE(p_numero,''), COALESCE(p_complemento,''),
      COALESCE(p_bairro,''), COALESCE(p_cidade,''), COALESCE(p_uf,''), COALESCE(p_cep,''), COALESCE(p_telefone,''),
      COALESCE(p_regime_tributario,'simples_nacional'), p_ambiente, p_serie_nfce, p_proximo_numero_nfce,
      COALESCE(p_csc_id,''), COALESCE(p_csc_token,''), COALESCE(p_certificado_senha,''),
      COALESCE(p_certificado_digital_url,'')
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.configuracoes_fiscais SET
      cnpj = COALESCE(p_cnpj,''),
      inscricao_estadual = COALESCE(p_inscricao_estadual,''),
      razao_social = COALESCE(p_razao_social,''),
      nome_fantasia = COALESCE(p_nome_fantasia,''),
      endereco = COALESCE(p_endereco,''),
      numero = COALESCE(p_numero,''),
      complemento = COALESCE(p_complemento,''),
      bairro = COALESCE(p_bairro,''),
      cidade = COALESCE(p_cidade,''),
      uf = COALESCE(p_uf,''),
      cep = COALESCE(p_cep,''),
      telefone = COALESCE(p_telefone,''),
      regime_tributario = COALESCE(p_regime_tributario,'simples_nacional'),
      ambiente = p_ambiente,
      serie_nfce = p_serie_nfce,
      proximo_numero_nfce = p_proximo_numero_nfce,
      csc_id = COALESCE(p_csc_id,''),
      csc_token = CASE WHEN COALESCE(p_csc_token,'') = '' THEN csc_token ELSE p_csc_token END,
      certificado_senha = CASE WHEN COALESCE(p_certificado_senha,'') = '' THEN certificado_senha ELSE p_certificado_senha END,
      certificado_digital_url = CASE WHEN p_certificado_digital_url IS NULL THEN certificado_digital_url ELSE p_certificado_digital_url END,
      updated_at = now()
    WHERE id = v_id;
  END IF;

  PERFORM public.fn_audit('CONFIG_FISCAL_ALTERADA','configuracoes_fiscais', v_id, p_unidade_id, NULL,
    jsonb_build_object('ambiente', p_ambiente, 'serie', p_serie_nfce, 'proximo_numero', p_proximo_numero_nfce));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_config_fiscal_unidade_salvar(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_config_fiscal_unidade_salvar(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,integer,text,text,text,text) TO authenticated;

-- 4) Configuração de caixa por unidade
CREATE TABLE IF NOT EXISTS public.caixa_config_unidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL UNIQUE REFERENCES public.unidades(id),
  valor_abertura_padrao NUMERIC NOT NULL DEFAULT 0,
  exige_valor_abertura BOOLEAN NOT NULL DEFAULT true,
  permite_sangria BOOLEAN NOT NULL DEFAULT true,
  permite_suprimento BOOLEAN NOT NULL DEFAULT true,
  limite_sangria NUMERIC NOT NULL DEFAULT 0,
  exige_motivo_sangria BOOLEAN NOT NULL DEFAULT true,
  diferenca_tolerada NUMERIC NOT NULL DEFAULT 0,
  impressora_nome TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  configurado_por UUID,
  configurado_por_nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.caixa_config_unidade TO authenticated;
GRANT ALL ON public.caixa_config_unidade TO service_role;

ALTER TABLE public.caixa_config_unidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caixa_config_select" ON public.caixa_config_unidade;
CREATE POLICY "caixa_config_select" ON public.caixa_config_unidade
  FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));

DROP POLICY IF EXISTS "caixa_config_insert" ON public.caixa_config_unidade;
CREATE POLICY "caixa_config_insert" ON public.caixa_config_unidade
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.usuario_tem_permissao(unidade_id,'caixa.abrir'));

DROP POLICY IF EXISTS "caixa_config_update" ON public.caixa_config_unidade;
CREATE POLICY "caixa_config_update" ON public.caixa_config_unidade
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.usuario_tem_permissao(unidade_id,'caixa.abrir'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.usuario_tem_permissao(unidade_id,'caixa.abrir'));

DROP TRIGGER IF EXISTS trg_caixa_config_updated ON public.caixa_config_unidade;
CREATE TRIGGER trg_caixa_config_updated
  BEFORE UPDATE ON public.caixa_config_unidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_caixa_config_unidade ON public.caixa_config_unidade(unidade_id);