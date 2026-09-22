-- Aditiva: master pode enviar transferências a partir de unidade em implantação (correção de carga inicial).
CREATE OR REPLACE FUNCTION public.fn_transf_validar_rota(p_origem uuid, p_destino uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uo public.unidades; ud public.unidades;
BEGIN
  SELECT * INTO uo FROM public.unidades WHERE id = p_origem;
  SELECT * INTO ud FROM public.unidades WHERE id = p_destino;
  IF uo.id IS NULL OR ud.id IS NULL THEN RAISE EXCEPTION 'Unidade de origem ou destino não encontrada'; END IF;
  IF uo.id = ud.id THEN RAISE EXCEPTION 'Origem e destino devem ser diferentes'; END IF;
  IF uo.status = 'INATIVA' OR ud.status = 'INATIVA' THEN
    RAISE EXCEPTION 'Unidade inativa não participa de transferências.';
  END IF;
  IF uo.status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO') AND NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Unidade % está em implantação e não pode enviar transferências.', uo.nome_exibicao;
  END IF;
  IF NOT uo.permite_transferencia OR NOT ud.permite_transferencia THEN
    RAISE EXCEPTION 'Transferência não permitida entre % e %.', uo.nome_exibicao, ud.nome_exibicao;
  END IF;
END;
$function$;
