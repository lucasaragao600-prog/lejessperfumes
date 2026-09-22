-- Aditiva: permite que o master ajuste/retire estoque em unidades EM_IMPLANTACAO/EM_CONFIGURACAO.
-- Venda continua bloqueada; unidade INATIVA continua bloqueada para tudo.
CREATE OR REPLACE FUNCTION public.fn_validar_operacao_unidade(_unidade_id uuid, _operacao text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u public.unidades;
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = _unidade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unidade não encontrada';
  END IF;

  IF u.status = 'INATIVA' THEN
    RAISE EXCEPTION 'Unidade % está inativa: nenhuma operação nova é permitida.', u.nome_exibicao;
  END IF;

  IF u.status IN ('EM_IMPLANTACAO', 'EM_CONFIGURACAO') AND _operacao = 'venda' THEN
    RAISE EXCEPTION 'Unidade % está em implantação: vendas ainda não são permitidas.', u.nome_exibicao;
  END IF;

  IF u.status IN ('EM_IMPLANTACAO', 'EM_CONFIGURACAO')
     AND _operacao = 'saida'
     AND NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Unidade % está em implantação: apenas o master pode retirar estoque.', u.nome_exibicao;
  END IF;

  IF _operacao = 'venda' AND NOT u.permite_venda THEN
    RAISE EXCEPTION 'Unidade % não permite venda.', u.nome_exibicao;
  END IF;

  IF _operacao IN ('estoque', 'entrada', 'saida') AND NOT u.permite_estoque THEN
    RAISE EXCEPTION 'Unidade % não permite movimentação de estoque.', u.nome_exibicao;
  END IF;
END;
$function$;
