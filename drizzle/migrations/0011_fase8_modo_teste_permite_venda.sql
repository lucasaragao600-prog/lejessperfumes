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
         permite_venda = true,
         permite_estoque = true,
         permite_transferencia = true
   WHERE id = v_unidade
     AND status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO','EM_TESTE');

  UPDATE public.implantacoes SET status = 'EM_TESTE' WHERE id = p_implantacao_id;

  PERFORM public.fn_audit('UNIDADE_ALTERADA','implantacoes', p_implantacao_id, v_unidade, NULL,
    jsonb_build_object('status','EM_TESTE'));
END;
$$;