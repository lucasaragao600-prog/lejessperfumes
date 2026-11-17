ALTER TABLE public.ajuste_auditoria ADD COLUMN IF NOT EXISTS motivo_categoria text;
ALTER TABLE public.ajuste_auditoria ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS ajuste_id uuid;

DROP POLICY IF EXISTS "master delete ajuste_auditoria" ON public.ajuste_auditoria;
DROP POLICY IF EXISTS "auth insert ajuste_auditoria" ON public.ajuste_auditoria;
REVOKE INSERT, UPDATE, DELETE ON public.ajuste_auditoria FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.fn_ajuste_estoque(p_produto_id uuid, p_unidade text, p_quantidade_nova integer,
  p_motivo_categoria text, p_motivo text, p_origem text DEFAULT 'movimentacoes')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  u public.unidades; v_atual integer; v_nome text; v_aj uuid; v_por text;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_cats text[] := ARRAY['Contagem física / inventário','Produto avariado / quebrado','Perda ou extravio','Furto',
    'Correção de lançamento errado','Devolução ao fornecedor','Uso interno / brinde','Outro'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas o Master pode ajustar estoque'; END IF;
  IF p_motivo_categoria IS NULL OR NOT (p_motivo_categoria = ANY(v_cats)) THEN RAISE EXCEPTION 'Escolha a categoria do motivo'; END IF;
  IF length(regexp_replace(v_motivo, '\s', '', 'g')) < 10 THEN RAISE EXCEPTION 'Descreva o motivo com pelo menos 10 caracteres'; END IF;
  IF lower(v_motivo) IN ('ajuste','acerto','correção','correcao','teste','ok') OR v_motivo ~ '^[0-9\s\W]+$' THEN
    RAISE EXCEPTION 'Motivo genérico demais. Descreva o que aconteceu'; END IF;
  IF p_quantidade_nova IS NULL OR p_quantidade_nova < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF p_origem NOT IN ('acoes_rapidas','movimentacoes','cadastro_produto','inventario') THEN RAISE EXCEPTION 'Origem inválida'; END IF;

  SELECT * INTO u FROM public.fn_unidade_por_texto(p_unidade);
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada'; END IF;
  SELECT nome INTO v_nome FROM perfumes WHERE id = p_produto_id;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  INSERT INTO estoque_unidades (produto_id, unidade_id, quantidade) VALUES (p_produto_id, u.id, 0)
  ON CONFLICT (produto_id, unidade_id) DO NOTHING;
  SELECT quantidade INTO v_atual FROM estoque_unidades WHERE produto_id = p_produto_id AND unidade_id = u.id FOR UPDATE;
  IF v_atual = p_quantidade_nova THEN RAISE EXCEPTION 'A quantidade nova é igual à atual'; END IF;

  UPDATE estoque_unidades SET quantidade = p_quantidade_nova,
    data_ultima_entrada = CASE WHEN p_quantidade_nova > v_atual THEN now() ELSE data_ultima_entrada END,
    data_ultima_saida = CASE WHEN p_quantidade_nova < v_atual THEN now() ELSE data_ultima_saida END,
    updated_at = now()
  WHERE produto_id = p_produto_id AND unidade_id = u.id;
  PERFORM public.fn_sync_estoque_legado(p_produto_id, u.id);

  SELECT coalesce(nome, 'Desconhecido') INTO v_por FROM profiles WHERE user_id = auth.uid();
  INSERT INTO ajuste_auditoria (produto_id, produto_nome, deposito, unidade_id, quantidade_anterior, quantidade_nova, diferenca,
    motivo_categoria, motivo, origem, registrado_por, user_id)
  VALUES (p_produto_id, v_nome, u.nome, u.id, v_atual, p_quantidade_nova, p_quantidade_nova - v_atual,
    p_motivo_categoria, v_motivo, p_origem, coalesce(v_por, 'Desconhecido'), auth.uid())
  RETURNING id INTO v_aj;

  INSERT INTO movimentacoes (data, tipo, perfume_id, perfume_nome, deposito, unidade_id, quantidade, observacao, registrado_por, ajuste_id)
  VALUES (public.fn__hoje_manaus(), 'Ajuste', p_produto_id, v_nome, coalesce(nullif(u.codigo_legado,''), u.nome), u.id,
    p_quantidade_nova - v_atual, 'Ajuste: ' || v_atual || ' → ' || p_quantidade_nova || ' | ' || p_motivo_categoria || ': ' || v_motivo,
    coalesce(v_por, 'Desconhecido'), v_aj);

  RETURN jsonb_build_object('anterior', v_atual, 'nova', p_quantidade_nova, 'diferenca', p_quantidade_nova - v_atual, 'ajuste_id', v_aj);
END $$;
REVOKE ALL ON FUNCTION public.fn_ajuste_estoque(uuid, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ajuste_estoque(uuid, text, integer, text, text, text) TO authenticated;

-- Fecha a porta antiga: modo "set" só para produto com saldo zero (estoque inicial do cadastro) ou Master
CREATE OR REPLACE FUNCTION public.fn_ajustar_saldo(p_produto_id uuid, p_unidade text, p_quantidade integer, p_modo text DEFAULT 'delta'::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  u public.unidades; v_atual integer; v_novo integer;
BEGIN
  SELECT * INTO u FROM public.fn_unidade_por_texto(p_unidade);
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unidade "%" não encontrada', p_unidade; END IF;
  PERFORM public.fn_validar_operacao_unidade(u.id, CASE WHEN p_modo = 'delta' AND p_quantidade < 0 THEN 'saida' ELSE 'entrada' END);
  INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade) VALUES (p_produto_id, u.id, 0)
  ON CONFLICT (produto_id, unidade_id) DO NOTHING;
  SELECT quantidade INTO v_atual FROM public.estoque_unidades WHERE produto_id = p_produto_id AND unidade_id = u.id FOR UPDATE;
  IF p_modo = 'set' AND v_atual <> 0 AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Apenas o Master pode ajustar estoque';
  END IF;
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
$function$;