CREATE OR REPLACE FUNCTION public.fn_nt_registrar_impressao(p_id uuid, p_via text DEFAULT 'origem', p_formato text DEFAULT 'a4') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notas_transferencia; v_c integer;
BEGIN
  IF p_via NOT IN ('origem','destino','transporte','todas') OR p_formato NOT IN ('a4','termica') THEN RAISE EXCEPTION 'Via ou formato inválido'; END IF;
  SELECT * INTO n FROM public.notas_transferencia WHERE id = p_id FOR UPDATE;
  IF n.id IS NULL OR NOT (public.fn__pode(n.origem_unidade_id,'nt.reimprimir') OR public.fn__pode(n.destino_unidade_id,'nt.reimprimir')
     OR public.fn__pode(n.origem_unidade_id,'nt.ver') OR public.fn__pode(n.destino_unidade_id,'nt.ver')) THEN
    RAISE EXCEPTION 'Sem permissão para imprimir esta nota';
  END IF;
  IF n.reimpressoes > 0 AND NOT (public.fn__pode(n.origem_unidade_id,'nt.reimprimir') OR public.fn__pode(n.destino_unidade_id,'nt.reimprimir')) THEN
    RAISE EXCEPTION 'Sem permissão para reimprimir esta nota';
  END IF;
  UPDATE public.notas_transferencia SET reimpressoes = reimpressoes + 1, ultima_reimpressao_em = now(),
    ultima_reimpressao_por = coalesce(public.fn__nome_usuario(),'') WHERE id = p_id RETURNING reimpressoes INTO v_c;
  PERFORM public.fn_audit('NT_IMPRESSA', 'notas_transferencia', p_id, n.origem_unidade_id, NULL,
    jsonb_build_object('impressao', v_c, 'via', p_via, 'formato', p_formato));
  RETURN v_c;
END $$;