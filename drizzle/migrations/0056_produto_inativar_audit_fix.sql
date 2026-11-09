CREATE OR REPLACE FUNCTION public.fn_produto_definir_ativo(p_produto_id uuid, p_ativo boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_nome text; v_atual boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master pode inativar ou reativar produtos'; END IF;
  SELECT nome, ativo INTO v_nome, v_atual FROM perfumes WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF v_atual = p_ativo THEN RETURN; END IF;
  UPDATE perfumes SET ativo = p_ativo,
    inativado_em = CASE WHEN p_ativo THEN NULL ELSE now() END,
    inativado_por = CASE WHEN p_ativo THEN NULL ELSE auth.uid() END,
    inativado_motivo = CASE WHEN p_ativo THEN NULL ELSE nullif(trim(coalesce(p_motivo,'')),'') END
  WHERE id = p_produto_id;
  PERFORM public.fn_audit(CASE WHEN p_ativo THEN 'PRODUTO_REATIVADO' ELSE 'PRODUTO_INATIVADO' END, 'perfumes', p_produto_id, NULL,
          jsonb_build_object('ativo', v_atual, 'nome', v_nome), jsonb_build_object('ativo', p_ativo, 'motivo', p_motivo));
END $$;
REVOKE ALL ON FUNCTION public.fn_produto_definir_ativo(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produto_definir_ativo(uuid, boolean, text) TO authenticated;