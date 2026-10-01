-- Fase 6 Decants: etiquetas e leitura de códigos. Aditiva. Reverter: supabase/rollback/0028_decants_fase6_down.sql
CREATE TABLE IF NOT EXISTS public.decant_etiqueta_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  largura_mm numeric(6,1) NOT NULL DEFAULT 50 CHECK (largura_mm BETWEEN 15 AND 200),
  altura_mm numeric(6,1) NOT NULL DEFAULT 30 CHECK (altura_mm BETWEEN 10 AND 200),
  mostrar_qr boolean NOT NULL DEFAULT true,
  mostrar_barras boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.decant_etiqueta_modelos TO authenticated;
GRANT ALL ON public.decant_etiqueta_modelos TO service_role;
ALTER TABLE public.decant_etiqueta_modelos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "decant_etq_ler" ON public.decant_etiqueta_modelos;
CREATE POLICY "decant_etq_ler" ON public.decant_etiqueta_modelos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.etiquetas'));
DROP POLICY IF EXISTS "decant_etq_ins" ON public.decant_etiqueta_modelos;
CREATE POLICY "decant_etq_ins" ON public.decant_etiqueta_modelos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.configurar'));
DROP POLICY IF EXISTS "decant_etq_upd" ON public.decant_etiqueta_modelos;
CREATE POLICY "decant_etq_upd" ON public.decant_etiqueta_modelos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.configurar'));

-- Gera as etiquetas (uma linha por unidade) e registra a impressão na auditoria.
CREATE OR REPLACE FUNCTION public.fn_decant_etiquetas_imprimir(p_lote_id uuid, p_itens jsonb, p_modelo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes; v_p public.perfumes; v_it jsonb; v_i public.decant_lote_itens; v_q int; v_total int := 0;
  v_out jsonb := '[]'; v_sku text; v_tam text;
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = p_lote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_l.unidade_id,'decant.etiquetas');
  IF v_l.status <> 'concluido' THEN RAISE EXCEPTION 'Etiquetas só para lotes concluídos'; END IF;
  SELECT * INTO v_p FROM public.perfumes WHERE id = v_l.produto_id;
  FOR v_it IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens,'[]')) LOOP
    v_q := (v_it->>'quantidade')::int;
    IF v_q IS NULL OR v_q <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_i FROM public.decant_lote_itens WHERE id = (v_it->>'item_id')::uuid AND lote_id = p_lote_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item não pertence ao lote'; END IF;
    v_total := v_total + v_q;
    IF v_total > 1000 THEN RAISE EXCEPTION 'Máximo de 1000 etiquetas por impressão'; END IF;
    SELECT s.sku, t.nome INTO v_sku, v_tam FROM public.decant_skus s JOIN public.decant_tamanhos t ON t.id = s.tamanho_id WHERE s.id = v_i.sku_id;
    v_out := v_out || (SELECT jsonb_agg(jsonb_build_object('sku', v_sku, 'tamanho', v_tam, 'volume_ml', v_i.volume_ml,
      'marca', v_p.marca, 'nome', v_p.nome, 'concentracao', v_p.concentracao, 'lote', v_l.codigo,
      'data_producao', COALESCE(v_l.data_producao, public.fn__decant_dia(v_l.concluido_em)), 'n', g)) FROM generate_series(1, v_q) g);
  END LOOP;
  IF v_total = 0 THEN RAISE EXCEPTION 'Informe ao menos uma etiqueta'; END IF;
  INSERT INTO public.audit_logs (usuario_id, usuario_nome, unidade_id, acao, entidade, entidade_id, dados_novos)
  VALUES (auth.uid(), public.fn__nome_usuario(), v_l.unidade_id, 'decant_etiquetas_impressas', 'decant_lotes', v_l.id,
    jsonb_build_object('lote', v_l.codigo, 'quantidade', v_total, 'itens', p_itens, 'modelo_id', p_modelo_id));
  RETURN jsonb_build_object('quantidade', v_total, 'etiquetas', v_out);
END $$;

-- Leitura pública (sem login): somente dados não sensíveis de lote concluído ou SKU ativo.
CREATE OR REPLACE FUNCTION public.fn_decant_scan_publico(p_codigo text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('tipo','lote','lote', l.codigo, 'marca', p.marca, 'nome', p.nome, 'concentracao', p.concentracao,
       'data_producao', COALESCE(l.data_producao, public.fn__decant_dia(l.concluido_em)),
       'tamanhos', (SELECT jsonb_agg(t.nome ORDER BY t.volume_ml) FROM public.decant_lote_itens i JOIN public.decant_tamanhos t ON t.id = i.tamanho_id WHERE i.lote_id = l.id))
     FROM public.decant_lotes l JOIN public.perfumes p ON p.id = l.produto_id
     WHERE l.codigo = upper(trim(p_codigo)) AND l.status = 'concluido'),
    (SELECT jsonb_build_object('tipo','sku','sku', s.sku, 'marca', p.marca, 'nome', p.nome, 'concentracao', p.concentracao, 'tamanhos', jsonb_build_array(t.nome))
     FROM public.decant_skus s JOIN public.perfumes p ON p.id = s.produto_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
     WHERE s.sku = upper(trim(p_codigo)) AND s.ativo))
$$;

-- Leitura interna (logado, com decant.ver): estoque por filial permitida, frascos usados, responsáveis; custo só com permissão.
CREATE OR REPLACE FUNCTION public.fn_decant_scan(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pub jsonb; v_c boolean; v_l public.decant_lotes; v_sku public.decant_skus;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  v_pub := public.fn_decant_scan_publico(p_codigo);
  IF v_pub IS NULL THEN RETURN NULL; END IF;
  v_c := public.fn__decant_ver_custos();
  IF v_pub->>'tipo' = 'lote' THEN
    SELECT * INTO v_l FROM public.decant_lotes WHERE codigo = v_pub->>'lote';
    IF NOT public.fn__pode(v_l.unidade_id,'decant.ver') THEN RETURN v_pub; END IF;
    RETURN v_pub || jsonb_build_object(
      'filial', (SELECT nome FROM public.unidades WHERE id = v_l.unidade_id),
      'responsavel_producao', v_l.responsavel_producao, 'responsavel_conferencia', v_l.responsavel_conferencia,
      'frascos', (SELECT jsonb_agg(f.codigo ORDER BY lf.ordem_fifo) FROM public.decant_lote_frascos lf JOIN public.decant_frascos f ON f.id = lf.frasco_id WHERE lf.lote_id = v_l.id),
      'estoque', (SELECT jsonb_agg(jsonb_build_object('sku', s.sku, 'filial', u.nome, 'quantidade', x.q)) FROM
          (SELECT sku_id, unidade_id, sum(quantidade) q FROM public.decant_estoque WHERE lote_id = v_l.id GROUP BY 1,2 HAVING sum(quantidade) > 0) x
          JOIN public.decant_skus s ON s.id = x.sku_id JOIN public.unidades u ON u.id = x.unidade_id WHERE public.fn__pode(x.unidade_id,'decant.ver')),
      'custo_total', CASE WHEN v_c THEN v_l.custo_total END,
      'custos_unitarios', CASE WHEN v_c THEN (SELECT jsonb_agg(jsonb_build_object('volume_ml', volume_ml, 'custo', custo_unitario)) FROM public.decant_lote_itens WHERE lote_id = v_l.id) END);
  END IF;
  SELECT * INTO v_sku FROM public.decant_skus WHERE sku = v_pub->>'sku';
  RETURN v_pub || jsonb_build_object(
    'estoque', (SELECT jsonb_agg(jsonb_build_object('filial', u.nome, 'quantidade', x.q)) FROM
        (SELECT unidade_id, sum(quantidade) q FROM public.decant_estoque WHERE sku_id = v_sku.id GROUP BY 1) x
        JOIN public.unidades u ON u.id = x.unidade_id WHERE public.fn__pode(x.unidade_id,'decant.ver')),
    'custo_medio', CASE WHEN v_c THEN v_sku.custo_medio END);
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_decant_etiquetas_imprimir(uuid,jsonb,uuid), public.fn_decant_scan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_etiquetas_imprimir(uuid,jsonb,uuid), public.fn_decant_scan(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_decant_scan_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_decant_scan_publico(text) TO anon, authenticated;