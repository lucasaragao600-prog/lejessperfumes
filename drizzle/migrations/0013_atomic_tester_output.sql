CREATE OR REPLACE FUNCTION public.fn_saida_tester(
  p_produto_id uuid,
  p_unidade text,
  p_quantidade integer,
  p_registrado_por text DEFAULT '',
  p_observacao text DEFAULT '',
  p_baixar_estoque boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unidade public.unidades;
  v_produto public.perfumes;
  v_saldo integer;
  v_tester_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_produto_id IS NULL THEN
    RAISE EXCEPTION 'Produto não informado';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero';
  END IF;

  SELECT * INTO v_unidade FROM public.fn_unidade_por_texto(p_unidade);
  IF v_unidade.id IS NULL THEN
    RAISE EXCEPTION 'Unidade "%" não encontrada', COALESCE(p_unidade, '');
  END IF;

  PERFORM public.fn_validar_operacao_unidade(
    v_unidade.id,
    CASE WHEN p_baixar_estoque THEN 'saida' ELSE 'estoque' END
  );

  IF NOT public.usuario_tem_permissao(v_unidade.id, 'estoque.movimentar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para movimentar estoque nesta unidade';
  END IF;

  SELECT * INTO v_produto
  FROM public.perfumes
  WHERE id = p_produto_id;

  IF v_produto.id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_produto_id::text || ':' || v_unidade.id::text, 0));

  IF p_baixar_estoque THEN
    INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade)
    VALUES (p_produto_id, v_unidade.id, 0)
    ON CONFLICT (produto_id, unidade_id) DO NOTHING;

    SELECT quantidade INTO v_saldo
    FROM public.estoque_unidades
    WHERE produto_id = p_produto_id AND unidade_id = v_unidade.id
    FOR UPDATE;

    IF COALESCE(v_saldo, 0) < p_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente em %. Disponível: %', v_unidade.nome_exibicao, COALESCE(v_saldo, 0);
    END IF;

    UPDATE public.estoque_unidades
    SET quantidade = quantidade - p_quantidade,
        data_ultima_saida = now(),
        updated_at = now()
    WHERE produto_id = p_produto_id AND unidade_id = v_unidade.id;

    PERFORM public.fn_sync_estoque_legado(p_produto_id, v_unidade.id);
  END IF;

  SELECT id INTO v_tester_id
  FROM public.testers
  WHERE perfume_id = p_produto_id AND unidade_id = v_unidade.id
  ORDER BY created_at, id
  LIMIT 1
  FOR UPDATE;

  IF v_tester_id IS NULL THEN
    INSERT INTO public.testers (
      perfume_id, perfume_nome, marca, deposito, quantidade, custo,
      registrado_por, unidade_id
    ) VALUES (
      p_produto_id, v_produto.nome, v_produto.marca,
      COALESCE(v_unidade.codigo_legado, v_unidade.codigo), p_quantidade,
      COALESCE(v_produto.custo_medio, v_produto.custo), COALESCE(p_registrado_por, ''),
      v_unidade.id
    ) RETURNING id INTO v_tester_id;
  ELSE
    UPDATE public.testers
    SET quantidade = quantidade + p_quantidade,
        registrado_por = COALESCE(NULLIF(p_registrado_por, ''), registrado_por)
    WHERE id = v_tester_id;
  END IF;

  IF p_baixar_estoque THEN
    INSERT INTO public.movimentacoes (
      data, tipo, perfume_id, perfume_nome, deposito_origem, deposito,
      quantidade, observacao, registrado_por, unidade_id, unidade_origem_id
    ) VALUES (
      (now() AT TIME ZONE 'America/Manaus')::date,
      'Saída Tester', p_produto_id, v_produto.nome,
      COALESCE(v_unidade.codigo_legado, v_unidade.codigo),
      COALESCE(v_unidade.codigo_legado, v_unidade.codigo),
      p_quantidade, NULLIF(btrim(COALESCE(p_observacao, '')), ''),
      COALESCE(p_registrado_por, ''), v_unidade.id, v_unidade.id
    );
  END IF;

  PERFORM public.fn_audit(
    CASE WHEN p_baixar_estoque THEN 'SAIDA_TESTER' ELSE 'INVENTARIO_TESTER' END,
    'testers', v_tester_id, v_unidade.id, NULL,
    jsonb_build_object(
      'produto_id', p_produto_id,
      'quantidade', p_quantidade,
      'baixa_estoque', p_baixar_estoque
    ), NULL
  );

  RETURN jsonb_build_object(
    'tester_id', v_tester_id,
    'unidade_id', v_unidade.id,
    'saldo_estoque', CASE WHEN p_baixar_estoque THEN v_saldo - p_quantidade ELSE NULL END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_saida_tester(uuid, text, integer, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_saida_tester(uuid, text, integer, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_saida_tester(uuid, text, integer, text, text, boolean) TO service_role;