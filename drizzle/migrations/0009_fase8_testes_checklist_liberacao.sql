-- FASE 8: testes, checklist final e liberação da unidade (aditiva e idempotente)

-- 1) Itens de modelo para as etapas de testes e checklist final
INSERT INTO public.implantacao_checklist_modelo (etapa_chave, item, ordem) VALUES
  ('testes','Venda de teste no PDV (modo teste)',1),
  ('testes','Impressão do comprovante',2),
  ('testes','Pagamento na maquininha (teste)',3),
  ('testes','Abertura de caixa',4),
  ('testes','Sangria e suprimento',5),
  ('testes','Fechamento de caixa',6),
  ('testes','Recebimento de transferência',7),
  ('testes','Ajuste de estoque',8),
  ('testes','Emissão de NFC-e em homologação',9),
  ('testes','Leitor de código de barras',10),
  ('checklist','Estoque inicial conferido e sem divergência',1),
  ('checklist','Configuração fiscal validada',2),
  ('checklist','Configuração de caixa validada',3),
  ('checklist','Equipamentos cadastrados e testados',4),
  ('checklist','Usuários com acesso e permissões corretas',5),
  ('checklist','Preços e promoções revisados',6),
  ('checklist','Treinamento da equipe realizado',7),
  ('checklist','Comunicação visual e vitrine prontas',8),
  ('checklist','Pendências críticas resolvidas',9),
  ('checklist','Aprovação final do responsável',10)
ON CONFLICT (etapa_chave, item) DO NOTHING;

-- 2) Backfill dos itens nas implantações já existentes
INSERT INTO public.implantacao_checklist (implantacao_id, etapa_chave, item, ordem)
SELECT i.id, m.etapa_chave, m.item, m.ordem
  FROM public.implantacoes i
  CROSS JOIN public.implantacao_checklist_modelo m
 WHERE m.ativo
   AND m.etapa_chave IN ('testes','checklist')
   AND NOT EXISTS (
     SELECT 1 FROM public.implantacao_checklist c
      WHERE c.implantacao_id = i.id
        AND c.etapa_chave = m.etapa_chave
        AND c.item = m.item
   );

-- 3) RPC: coloca a unidade em modo de teste
CREATE OR REPLACE FUNCTION public.fn_implantacao_iniciar_testes(p_implantacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_unidade uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Somente o master pode iniciar os testes da unidade.';
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.implantacoes WHERE id = p_implantacao_id;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada.'; END IF;

  UPDATE public.unidades
     SET status = 'EM_TESTE',
         permite_venda = false,
         permite_estoque = true,
         permite_transferencia = true
   WHERE id = v_unidade
     AND status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO','EM_TESTE');

  UPDATE public.implantacoes SET status = 'EM_TESTE' WHERE id = p_implantacao_id;

  PERFORM public.fn_audit('UNIDADE_ALTERADA','implantacoes', p_implantacao_id, v_unidade, NULL,
    jsonb_build_object('status','EM_TESTE'));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_iniciar_testes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_iniciar_testes(uuid) TO authenticated;

-- 4) RPC: prontidão para liberação (somente leitura)
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

  SELECT count(*) FILTER (WHERE status NOT IN ('RECEBIDO','CANCELADO')),
         count(*) FILTER (WHERE status = 'DIVERGENTE')
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

REVOKE ALL ON FUNCTION public.fn_implantacao_prontidao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_prontidao(uuid) TO authenticated;

-- 5) RPC: liberação da unidade para operação
CREATE OR REPLACE FUNCTION public.fn_implantacao_liberar(p_implantacao_id uuid, p_data_inauguracao date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_unidade uuid; v_nome text; v_pront jsonb; v_data date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Somente o master pode liberar a unidade.';
  END IF;

  v_pront := public.fn_implantacao_prontidao(p_implantacao_id);
  IF NOT (v_pront->>'pode_liberar')::boolean THEN
    RAISE EXCEPTION 'Unidade não está pronta para liberação: % etapa(s) pendente(s), % teste(s), % item(ns) do checklist, % pendência(s) crítica(s)/alta(s), % carga(s) pendente(s), % divergência(s).',
      v_pront->>'etapas_pendentes', v_pront->>'testes_pendentes', v_pront->>'checklist_pendentes',
      v_pront->>'pendencias_criticas', v_pront->>'estoque_pendente', v_pront->>'divergencias';
  END IF;

  v_unidade := (v_pront->>'unidade_id')::uuid;
  v_data := COALESCE(p_data_inauguracao, (now() AT TIME ZONE 'America/Manaus')::date);
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

  UPDATE public.unidades
     SET status = 'OPERACIONAL',
         permite_venda = true,
         permite_estoque = true,
         permite_transferencia = true,
         data_inauguracao = COALESCE(data_inauguracao, v_data)
   WHERE id = v_unidade;

  UPDATE public.implantacao_etapas
     SET status = 'CONCLUIDA'
   WHERE implantacao_id = p_implantacao_id AND chave = 'liberacao';

  UPDATE public.implantacoes
     SET status = 'CONCLUIDA',
         data_inauguracao = COALESCE(data_inauguracao, v_data),
         liberado_por = auth.uid(),
         liberado_por_nome = COALESCE(v_nome,''),
         liberado_em = now()
   WHERE id = p_implantacao_id;

  PERFORM public.fn_implantacao_recalcular_progresso(p_implantacao_id);
  PERFORM public.fn_audit('UNIDADE_LIBERADA','implantacoes', p_implantacao_id, v_unidade, NULL,
    jsonb_build_object('data_inauguracao', v_data));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_liberar(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_liberar(uuid, date) TO authenticated;