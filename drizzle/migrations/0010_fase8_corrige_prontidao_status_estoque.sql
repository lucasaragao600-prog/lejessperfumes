CREATE OR REPLACE FUNCTION public.fn_implantacao_prontidao(p_implantacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unidade uuid;
  v_etapas_pend int; v_testes_pend int; v_check_pend int;
  v_pend_criticas int; v_pend_abertas int;
  v_estoque_pend int; v_diverg int; v_fiscal boolean; v_caixa boolean;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.implantacoes WHERE id = p_implantacao_id;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada.'; END IF;

  SELECT count(*) INTO v_etapas_pend
    FROM public.implantacao_etapas
   WHERE implantacao_id = p_implantacao_id AND aplicavel
     AND chave <> 'liberacao' AND status <> 'CONCLUIDA';

  SELECT count(*) FILTER (WHERE etapa_chave = 'testes'),
         count(*) FILTER (WHERE etapa_chave = 'checklist')
    INTO v_testes_pend, v_check_pend
    FROM public.implantacao_checklist
   WHERE implantacao_id = p_implantacao_id
     AND status NOT IN ('CONCLUIDO','NAO_APLICAVEL');

  SELECT count(*), count(*) FILTER (WHERE criticidade IN ('CRITICA','ALTA'))
    INTO v_pend_abertas, v_pend_criticas
    FROM public.implantacao_pendencias
   WHERE implantacao_id = p_implantacao_id AND status = 'ABERTA';

  SELECT count(*) FILTER (WHERE status IN ('PLANEJADO','EM_TRANSFERENCIA')),
         count(*) FILTER (WHERE status = 'DIVERGENCIA')
    INTO v_estoque_pend, v_diverg
    FROM public.implantacao_estoque_itens
   WHERE implantacao_id = p_implantacao_id;

  SELECT COALESCE(cnpj,'') <> '' AND COALESCE(razao_social,'') <> '' AND COALESCE(csc_token,'') <> ''
    INTO v_fiscal
    FROM public.configuracoes_fiscais WHERE unidade_id = v_unidade LIMIT 1;

  SELECT EXISTS (SELECT 1 FROM public.caixa_config_unidade WHERE unidade_id = v_unidade) INTO v_caixa;

  RETURN jsonb_build_object(
    'unidade_id', v_unidade,
    'etapas_pendentes', COALESCE(v_etapas_pend,0),
    'testes_pendentes', COALESCE(v_testes_pend,0),
    'checklist_pendentes', COALESCE(v_check_pend,0),
    'pendencias_abertas', COALESCE(v_pend_abertas,0),
    'pendencias_criticas', COALESCE(v_pend_criticas,0),
    'estoque_pendente', COALESCE(v_estoque_pend,0),
    'divergencias', COALESCE(v_diverg,0),
    'fiscal_ok', COALESCE(v_fiscal,false),
    'caixa_ok', COALESCE(v_caixa,false),
    'pode_liberar', COALESCE(v_etapas_pend,0) = 0
                    AND COALESCE(v_testes_pend,0) = 0
                    AND COALESCE(v_check_pend,0) = 0
                    AND COALESCE(v_pend_criticas,0) = 0
                    AND COALESCE(v_estoque_pend,0) = 0
                    AND COALESCE(v_diverg,0) = 0
                    AND COALESCE(v_fiscal,false)
                    AND COALESCE(v_caixa,false)
  );
END;
$$;