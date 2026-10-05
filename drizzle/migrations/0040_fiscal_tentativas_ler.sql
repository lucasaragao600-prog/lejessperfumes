CREATE OR REPLACE FUNCTION public.fn_nfce_tentativas(p_grupo uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_unid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT unidade_id INTO v_unid FROM vendas WHERE grupo_venda = p_grupo AND unidade_id IS NOT NULL LIMIT 1;
  IF v_unid IS NOT NULL AND NOT public.usuario_tem_acesso_unidade(v_unid) THEN RAISE EXCEPTION 'Sem acesso a esta loja'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'created_at', t.created_at, 'numero', t.numero, 'serie', t.serie, 'ambiente', t.ambiente,
      'cstat', t.cstat, 'motivo', t.motivo, 'protocolo', t.protocolo, 'erros', t.erros_validacao,
      'produtos', (SELECT jsonb_object_agg(p.id, p.codigo) FROM perfumes p WHERE p.id IN (SELECT (e->>'perfume_id')::uuid FROM jsonb_array_elements(coalesce(t.erros_validacao,'[]')) e)))
    ORDER BY t.created_at DESC) FROM nfce_tentativas t WHERE t.venda_grupo_venda = p_grupo), '[]');
END $$;
REVOKE ALL ON FUNCTION public.fn_nfce_tentativas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_nfce_tentativas(uuid) TO authenticated;