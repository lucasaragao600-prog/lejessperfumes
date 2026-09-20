-- FASE 2: RPCs transacionais de estoque por unidade + flag de venda em modo teste

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

-- Resolve uma unidade a partir de texto (codigo_legado, codigo, nome ou nome_exibicao)
CREATE OR REPLACE FUNCTION public.fn_unidade_por_texto(_txt text)
RETURNS public.unidades
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.* FROM public.unidades u
   WHERE lower(btrim(u.codigo_legado)) = lower(btrim(_txt))
      OR lower(btrim(u.codigo)) = lower(btrim(_txt))
      OR lower(btrim(u.nome)) = lower(btrim(_txt))
      OR lower(btrim(u.nome_exibicao)) = lower(btrim(_txt))
      OR u.id::text = btrim(_txt)
   ORDER BY u.ordem
   LIMIT 1
$$;

-- Valida se a unidade pode executar uma operação: 'venda' | 'estoque' | 'entrada' | 'saida'
CREATE OR REPLACE FUNCTION public.fn_validar_operacao_unidade(_unidade_id uuid, _operacao text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE u public.unidades;
BEGIN
  SELECT * INTO u FROM public.unidades WHERE id = _unidade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unidade não encontrada';
  END IF;

  IF u.status = 'INATIVA' THEN
    RAISE EXCEPTION 'Unidade % está inativa: nenhuma operação nova é permitida.', u.nome_exibicao;
  END IF;

  IF u.status IN ('EM_IMPLANTACAO', 'EM_CONFIGURACAO') AND _operacao IN ('venda', 'saida') THEN
    RAISE EXCEPTION 'Unidade % está em implantação: só recebe transferências de implantação.', u.nome_exibicao;
  END IF;

  IF _operacao = 'venda' AND NOT u.permite_venda THEN
    RAISE EXCEPTION 'Unidade % não permite venda.', u.nome_exibicao;
  END IF;

  IF _operacao IN ('estoque', 'entrada', 'saida') AND NOT u.permite_estoque THEN
    RAISE EXCEPTION 'Unidade % não permite movimentação de estoque.', u.nome_exibicao;
  END IF;
END;
$$;

-- Reflete o saldo novo nas colunas legadas de perfumes (compatibilidade)
CREATE OR REPLACE FUNCTION public.fn_sync_estoque_legado(_produto_id uuid, _unidade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legado text;
  v_qtd integer;
BEGIN
  SELECT codigo_legado INTO v_legado FROM public.unidades WHERE id = _unidade_id;
  IF v_legado IS NULL THEN RETURN; END IF;
  SELECT quantidade INTO v_qtd FROM public.estoque_unidades
   WHERE produto_id = _produto_id AND unidade_id = _unidade_id;
  v_qtd := COALESCE(v_qtd, 0);

  IF v_legado = 'Casa' THEN
    UPDATE public.perfumes SET estoque_casa = v_qtd WHERE id = _produto_id;
  ELSIF v_legado = 'Sumaúma' THEN
    UPDATE public.perfumes SET estoque_sumauma = v_qtd WHERE id = _produto_id;
  ELSIF v_legado = 'Amazonas' THEN
    UPDATE public.perfumes SET estoque_amazonas = v_qtd WHERE id = _produto_id;
  END IF;
END;
$$;

-- Ajuste de saldo: modo 'set' (valor absoluto) ou 'delta' (soma/subtrai)
CREATE OR REPLACE FUNCTION public.fn_ajustar_saldo(
  p_produto_id uuid,
  p_unidade text,
  p_quantidade integer,
  p_modo text DEFAULT 'delta'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.unidades;
  v_atual integer;
  v_novo integer;
BEGIN
  SELECT * INTO u FROM public.fn_unidade_por_texto(p_unidade);
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unidade "%" não encontrada', p_unidade; END IF;
  PERFORM public.fn_validar_operacao_unidade(u.id, CASE WHEN p_modo = 'delta' AND p_quantidade < 0 THEN 'saida' ELSE 'entrada' END);

  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade)
  VALUES (p_produto_id, u.id, 0)
  ON CONFLICT (produto_id, unidade_id) DO NOTHING;

  SELECT quantidade INTO v_atual FROM public.estoque_unidades
   WHERE produto_id = p_produto_id AND unidade_id = u.id FOR UPDATE;

  v_novo := CASE WHEN p_modo = 'set' THEN p_quantidade ELSE v_atual + p_quantidade END;
  IF v_novo < 0 THEN v_novo := 0; END IF;

  UPDATE public.estoque_unidades
     SET quantidade = v_novo,
         data_ultima_entrada = CASE WHEN v_novo > v_atual THEN now() ELSE data_ultima_entrada END,
         data_ultima_saida = CASE WHEN v_novo < v_atual THEN now() ELSE data_ultima_saida END,
         updated_at = now()
   WHERE produto_id = p_produto_id AND unidade_id = u.id;

  PERFORM public.fn_sync_estoque_legado(p_produto_id, u.id);
  RETURN v_novo;
END;
$$;

-- Baixa de venda: atômica, com UPDATE condicional contra concorrência
CREATE OR REPLACE FUNCTION public.fn_baixar_venda(
  p_produto_id uuid,
  p_unidade text,
  p_quantidade integer,
  p_is_teste boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.unidades;
  v_novo integer;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida para baixa de estoque';
  END IF;

  SELECT * INTO u FROM public.fn_unidade_por_texto(p_unidade);
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unidade "%" não encontrada', p_unidade; END IF;

  IF u.status = 'EM_TESTE' THEN
    IF NOT p_is_teste THEN
      RAISE EXCEPTION 'Unidade % está em teste: só são permitidas vendas em modo teste.', u.nome_exibicao;
    END IF;
    RETURN NULL; -- venda de homologação não movimenta estoque real
  END IF;

  PERFORM public.fn_validar_operacao_unidade(u.id, 'venda');

  IF p_is_teste THEN
    RAISE EXCEPTION 'Venda em modo teste só é permitida em unidade com status EM_TESTE.';
  END IF;

  UPDATE public.estoque_unidades
     SET quantidade = quantidade - p_quantidade,
         data_ultima_saida = now(),
         updated_at = now()
   WHERE produto_id = p_produto_id
     AND unidade_id = u.id
     AND quantidade - quantidade_reservada >= p_quantidade
  RETURNING quantidade INTO v_novo;

  IF v_novo IS NULL THEN
    RAISE EXCEPTION 'Estoque insuficiente em % para o produto solicitado.', u.nome_exibicao;
  END IF;

  PERFORM public.fn_sync_estoque_legado(p_produto_id, u.id);
  RETURN v_novo;
END;
$$;

-- Transferência entre unidades, atômica
CREATE OR REPLACE FUNCTION public.fn_transferir(
  p_produto_id uuid,
  p_origem text,
  p_destino text,
  p_quantidade integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uo public.unidades;
  ud public.unidades;
  v_ok integer;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida para transferência';
  END IF;

  SELECT * INTO uo FROM public.fn_unidade_por_texto(p_origem);
  SELECT * INTO ud FROM public.fn_unidade_por_texto(p_destino);
  IF uo.id IS NULL OR ud.id IS NULL THEN RAISE EXCEPTION 'Unidade de origem ou destino não encontrada'; END IF;
  IF uo.id = ud.id THEN RAISE EXCEPTION 'Origem e destino devem ser diferentes'; END IF;

  IF uo.status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO') THEN
    RAISE EXCEPTION 'Unidade % está em implantação e não pode enviar transferências.', uo.nome_exibicao;
  END IF;
  IF uo.status = 'INATIVA' OR ud.status = 'INATIVA' THEN
    RAISE EXCEPTION 'Unidade inativa não participa de transferências.';
  END IF;
  IF NOT uo.permite_transferencia OR NOT ud.permite_transferencia THEN
    RAISE EXCEPTION 'Transferência não permitida entre % e %.', uo.nome_exibicao, ud.nome_exibicao;
  END IF;

  UPDATE public.estoque_unidades
     SET quantidade = quantidade - p_quantidade,
         data_ultima_saida = now(),
         updated_at = now()
   WHERE produto_id = p_produto_id
     AND unidade_id = uo.id
     AND quantidade - quantidade_reservada >= p_quantidade
  RETURNING quantidade INTO v_ok;

  IF v_ok IS NULL THEN
    RAISE EXCEPTION 'Estoque insuficiente em % para transferir.', uo.nome_exibicao;
  END IF;

  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, data_ultima_entrada)
  VALUES (p_produto_id, ud.id, p_quantidade, now())
  ON CONFLICT (produto_id, unidade_id) DO UPDATE
    SET quantidade = public.estoque_unidades.quantidade + EXCLUDED.quantidade,
        data_ultima_entrada = now(),
        updated_at = now();

  PERFORM public.fn_sync_estoque_legado(p_produto_id, uo.id);
  PERFORM public.fn_sync_estoque_legado(p_produto_id, ud.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_unidade_por_texto(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validar_operacao_unidade(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ajustar_saldo(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_baixar_venda(uuid, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transferir(uuid, text, text, integer) TO authenticated;

-- Permite que usuários autenticados leiam e o master gerencie o estoque por unidade
DROP POLICY IF EXISTS "estoque_unidades_select" ON public.estoque_unidades;
CREATE POLICY "estoque_unidades_select" ON public.estoque_unidades
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.estoque_unidades TO authenticated;
