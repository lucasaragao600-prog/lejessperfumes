CREATE OR REPLACE FUNCTION public.fn_nt_cancelar(p_id uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notas_transferencia;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(trim(coalesce(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO n FROM public.notas_transferencia WHERE id = p_id FOR UPDATE;
  IF n.id IS NULL OR NOT (public.usuario_tem_acesso_unidade(n.origem_unidade_id) OR public.usuario_tem_acesso_unidade(n.destino_unidade_id)) THEN
    RAISE EXCEPTION 'Nota não encontrada';
  END IF;
  IF NOT (public.has_role(auth.uid(),'master') OR public.fn__pode(n.origem_unidade_id,'nt.cancelar')) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar notas';
  END IF;
  IF n.status IN ('CANCELADA','SUBSTITUIDA') THEN RAISE EXCEPTION 'Nota já está cancelada ou substituída'; END IF;
  UPDATE public.notas_transferencia SET status = 'CANCELADA', cancelado_em = now(),
    cancelado_por_nome = coalesce(public.fn__nome_usuario(),''), cancelado_motivo = trim(p_motivo)
  WHERE id = p_id;
  PERFORM public.fn_audit('NT_CANCELADA_MANUAL', 'notas_transferencia', p_id, n.origem_unidade_id, NULL, jsonb_build_object('motivo', trim(p_motivo)));
  RETURN jsonb_build_object('id', p_id, 'numero', n.numero);
END $$;
REVOKE ALL ON FUNCTION public.fn_nt_cancelar(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_nt_cancelar(uuid,text) TO authenticated;