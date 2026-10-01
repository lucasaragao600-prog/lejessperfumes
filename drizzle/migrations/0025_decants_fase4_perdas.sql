-- Decants Fase 4 (parte 1): perdas. Aditiva. Cria decant_perdas (append-only, alimentada por gatilhos).
CREATE TABLE IF NOT EXISTS public.decant_perdas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  origem text NOT NULL CHECK (origem IN ('frasco','producao','unidades')),
  tipo text NOT NULL CHECK (tipo IN ('vazamento','quebra','erro_envase','evaporacao','tester','uso_interno','ajuste','divergencia','descarte','outro')),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  frasco_id uuid REFERENCES public.decant_frascos(id),
  lote_id uuid REFERENCES public.decant_lotes(id),
  sku_id uuid REFERENCES public.decant_skus(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  ml numeric(10,3) NOT NULL CHECK (ml > 0),
  custo_ml numeric(14,6) NOT NULL DEFAULT 0,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  absorvida_custo boolean NOT NULL DEFAULT false,
  justificativa text NOT NULL DEFAULT '',
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decant_perdas_idx ON public.decant_perdas (unidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decant_perdas_prod_idx ON public.decant_perdas (produto_id, created_at DESC);
GRANT SELECT ON public.decant_perdas TO authenticated;
GRANT SELECT, INSERT ON public.decant_perdas TO service_role;
ALTER TABLE public.decant_perdas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS decant_perdas_select ON public.decant_perdas;
CREATE POLICY decant_perdas_select ON public.decant_perdas FOR SELECT TO authenticated
  USING (public.fn__pode(unidade_id,'decant.ver'));
CREATE OR REPLACE TRIGGER trg_decant_perdas_imutavel BEFORE UPDATE OR DELETE ON public.decant_perdas
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_bloquear_alteracao();

CREATE OR REPLACE FUNCTION public.fn__decant_dia(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT (ts AT TIME ZONE 'America/Manaus')::date $$;

CREATE OR REPLACE FUNCTION public.fn__decant_ver_custos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.custos'))
$$;
CREATE OR REPLACE FUNCTION public.fn__decant_ver_margem()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.margem'))
$$;
CREATE OR REPLACE FUNCTION public.fn__decant_exigir_leitura(_perm text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(auth.uid(),'master') OR COALESCE((public.fn__decant_cfg()->>'ativo')::boolean,false)) THEN
    RAISE EXCEPTION 'Módulo de decants desligado'; END IF;
  IF NOT (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(), _perm)) THEN
    RAISE EXCEPTION 'Sem permissão para esta consulta'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn__decant_perda_tipo_ml(_tipo text, _ref text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _ref = 'conferencia' THEN 'divergencia'
              WHEN _tipo IN ('vazamento','tester','uso_interno','descarte','ajuste') THEN _tipo ELSE 'outro' END
$$;

CREATE OR REPLACE FUNCTION public.fn__decant_perda_ml()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_f public.decant_frascos; v_tipo text;
BEGIN
  IF NEW.ml >= 0 OR NEW.tipo IN ('producao','abertura') THEN RETURN NEW; END IF;
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = NEW.frasco_id;
  v_tipo := COALESCE(NULLIF(current_setting('decant.tipo_perda', true),''), public.fn__decant_perda_tipo_ml(NEW.tipo, NEW.referencia_tipo));
  INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, frasco_id, unidade_id, ml, custo_ml, valor, justificativa, usuario_id, usuario_nome, created_at)
  VALUES ('ml:'||NEW.id, 'frasco', v_tipo, v_f.produto_id, NEW.frasco_id, NEW.unidade_id, -NEW.ml, v_f.custo_ml,
    round(-NEW.ml * v_f.custo_ml, 2), NEW.motivo, NEW.usuario_id, NEW.usuario_nome, NEW.created_at)
  ON CONFLICT (chave) DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_decant_perda_ml AFTER INSERT ON public.decant_ml_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_perda_ml();

CREATE OR REPLACE FUNCTION public.fn__decant_perda_lote(_lote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.decant_lotes; v_cml numeric;
BEGIN
  SELECT * INTO v_l FROM public.decant_lotes WHERE id = _lote_id;
  IF NOT FOUND OR v_l.status <> 'concluido' THEN RETURN; END IF;
  v_cml := CASE WHEN v_l.ml_consumido > 0 THEN v_l.custo_liquido / v_l.ml_consumido ELSE 0 END;
  INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, lote_id, sku_id, unidade_id, ml, custo_ml, valor, absorvida_custo, justificativa, usuario_id, usuario_nome, created_at)
  SELECT 'lote:'||i.id, 'producao',
    CASE WHEN i.motivo IN ('vazamento','quebra','erro_envase') THEN i.motivo ELSE 'outro' END,
    v_l.produto_id, v_l.id, i.sku_id, v_l.unidade_id, i.volume_ml * (-i.diferenca), round(v_cml,6),
    round(i.volume_ml * (-i.diferenca) * v_cml, 2), true,
    trim(v_l.codigo || ' · ' || COALESCE(NULLIF(i.justificativa,''), i.motivo)), v_l.conferido_por, v_l.responsavel_conferencia,
    COALESCE(v_l.conferido_em, now())
  FROM public.decant_lote_itens i WHERE i.lote_id = v_l.id AND i.diferenca < 0
  ON CONFLICT (chave) DO NOTHING;
  IF v_l.ml_consumido > v_l.volume_total_ml THEN
    INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, lote_id, unidade_id, ml, custo_ml, valor, absorvida_custo, justificativa, usuario_id, usuario_nome, created_at)
    VALUES ('lote_excesso:'||v_l.id, 'producao', 'erro_envase', v_l.produto_id, v_l.id, v_l.unidade_id,
      v_l.ml_consumido - v_l.volume_total_ml, round(v_cml,6), round((v_l.ml_consumido - v_l.volume_total_ml) * v_cml, 2), true,
      v_l.codigo || ' · consumo acima do planejado', v_l.conferido_por, v_l.responsavel_conferencia, COALESCE(v_l.conferido_em, now()))
    ON CONFLICT (chave) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn__decant_perda_lote_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' THEN PERFORM public.fn__decant_perda_lote(NEW.id); END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_decant_perda_lote AFTER UPDATE OF status ON public.decant_lotes
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_perda_lote_trg();

CREATE OR REPLACE FUNCTION public.fn__decant_perda_un()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prod uuid; v_vol numeric;
BEGIN
  IF NEW.tipo <> 'perda' OR NEW.quantidade >= 0 THEN RETURN NEW; END IF;
  SELECT s.produto_id, t.volume_ml INTO v_prod, v_vol FROM public.decant_skus s JOIN public.decant_tamanhos t ON t.id = s.tamanho_id WHERE s.id = NEW.sku_id;
  INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, lote_id, sku_id, unidade_id, ml, custo_ml, valor, justificativa, usuario_id, usuario_nome, created_at)
  VALUES ('un:'||NEW.id, 'unidades', CASE WHEN NEW.referencia_tipo ILIKE '%transf%' THEN 'divergencia' ELSE 'outro' END,
    v_prod, NEW.lote_id, NEW.sku_id, NEW.unidade_id, -NEW.quantidade * v_vol,
    CASE WHEN v_vol > 0 THEN round(NEW.custo_unit / v_vol, 6) ELSE 0 END, round(-NEW.quantidade * NEW.custo_unit, 2),
    NEW.motivo, NEW.usuario_id, NEW.usuario_nome, NEW.created_at)
  ON CONFLICT (chave) DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_decant_perda_un AFTER INSERT ON public.decant_un_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn__decant_perda_un();

INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, frasco_id, unidade_id, ml, custo_ml, valor, justificativa, usuario_id, usuario_nome, created_at)
SELECT 'ml:'||l.id, 'frasco', public.fn__decant_perda_tipo_ml(l.tipo, l.referencia_tipo), f.produto_id, l.frasco_id, l.unidade_id,
  -l.ml, f.custo_ml, round(-l.ml * f.custo_ml, 2), l.motivo, l.usuario_id, l.usuario_nome, l.created_at
FROM public.decant_ml_ledger l JOIN public.decant_frascos f ON f.id = l.frasco_id
WHERE l.ml < 0 AND l.tipo NOT IN ('producao','abertura')
ON CONFLICT (chave) DO NOTHING;
SELECT public.fn__decant_perda_lote(id) FROM public.decant_lotes WHERE status = 'concluido';
INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, lote_id, sku_id, unidade_id, ml, custo_ml, valor, justificativa, usuario_id, usuario_nome, created_at)
SELECT 'un:'||u.id, 'unidades', CASE WHEN u.referencia_tipo ILIKE '%transf%' THEN 'divergencia' ELSE 'outro' END,
  s.produto_id, u.lote_id, u.sku_id, u.unidade_id, -u.quantidade * t.volume_ml,
  CASE WHEN t.volume_ml > 0 THEN round(u.custo_unit / t.volume_ml, 6) ELSE 0 END, round(-u.quantidade * u.custo_unit, 2),
  u.motivo, u.usuario_id, u.usuario_nome, u.created_at
FROM public.decant_un_ledger u JOIN public.decant_skus s ON s.id = u.sku_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
WHERE u.tipo = 'perda' AND u.quantidade < 0
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_decant_registrar_perda(p_frasco_id uuid, p_tipo text, p_ml numeric, p_justificativa text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r jsonb; v_ledger text;
BEGIN
  IF p_tipo NOT IN ('vazamento','quebra','erro_envase','evaporacao','tester','uso_interno','ajuste','divergencia','descarte','outro') THEN
    RAISE EXCEPTION 'Tipo de perda inválido'; END IF;
  IF length(trim(COALESCE(p_justificativa,''))) < 5 THEN RAISE EXCEPTION 'Escreva a justificativa da perda'; END IF;
  v_ledger := CASE WHEN p_tipo IN ('vazamento','tester','uso_interno','descarte') THEN p_tipo ELSE 'perda' END;
  PERFORM set_config('decant.tipo_perda', p_tipo, true);
  v_r := public.fn_decant_registrar_saida(p_frasco_id, v_ledger, p_ml, trim(p_justificativa), p_idempotency_key);
  PERFORM set_config('decant.tipo_perda', '', true);
  RETURN v_r;
END $$;

CREATE OR REPLACE FUNCTION public.fn__decant_vendas_liq(p_unidade uuid, p_ini date, p_fim date)
RETURNS TABLE (venda_id uuid, dia date, unidade_id uuid, sku_id uuid, produto_id uuid, tamanho_id uuid, volume_ml numeric,
  qtd integer, receita numeric, cmv numeric, canal text, vendedora text, status text, preco_unit numeric, custo_unit numeric, qtd_devolvida integer, quantidade integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, public.fn__decant_dia(v.created_at), v.unidade_id, v.sku_id, s.produto_id, s.tamanho_id, t.volume_ml,
    CASE WHEN v.status = 'cancelada' THEN 0 ELSE v.quantidade - v.qtd_devolvida END,
    CASE WHEN v.status = 'cancelada' THEN 0 ELSE round(v.preco_unit * (v.quantidade - v.qtd_devolvida), 2) END,
    CASE WHEN v.status = 'cancelada' THEN 0 ELSE round(v.custo_unit * (v.quantidade - v.qtd_devolvida), 2) END,
    v.canal, v.vendedora, v.status, v.preco_unit, v.custo_unit, v.qtd_devolvida, v.quantidade
  FROM public.decant_vendas v JOIN public.decant_skus s ON s.id = v.sku_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
  WHERE (p_unidade IS NULL OR v.unidade_id = p_unidade) AND public.fn__pode(v.unidade_id,'decant.ver')
    AND public.fn__decant_dia(v.created_at) BETWEEN p_ini AND p_fim
$$;
REVOKE EXECUTE ON FUNCTION public.fn__decant_vendas_liq(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn__decant_vendas_liq(uuid,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn__decant_rotulo(p_produto uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' - ', NULLIF(marca,''), NULLIF(nome,''), NULLIF(concentracao,'')) FROM public.perfumes WHERE id = p_produto
$$;

CREATE OR REPLACE FUNCTION public.fn_decant_perdas_painel(p_unidade uuid, p_ini date, p_fim date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c boolean := public.fn__decant_ver_custos(); v_max numeric; v_mov numeric; v_res jsonb; v_lin jsonb; v_tipos jsonb; v_perf jsonb;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  v_max := COALESCE((public.fn__decant_cfg()->>'perda_max_pct')::numeric, 5);
  SELECT COALESCE(sum(-l.ml),0) INTO v_mov FROM public.decant_ml_ledger l
   WHERE l.ml < 0 AND l.tipo <> 'abertura' AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver')
     AND public.fn__decant_dia(l.created_at) BETWEEN p_ini AND p_fim;
  WITH p AS (SELECT * FROM public.decant_perdas d WHERE (p_unidade IS NULL OR d.unidade_id = p_unidade)
     AND public.fn__pode(d.unidade_id,'decant.ver') AND public.fn__decant_dia(d.created_at) BETWEEN p_ini AND p_fim)
  SELECT jsonb_build_object(
      'ml', COALESCE(sum(ml),0), 'valor', CASE WHEN v_c THEN COALESCE(sum(valor),0) END,
      'ml_producao', COALESCE(sum(ml) FILTER (WHERE origem = 'producao'),0),
      'ml_fora_lote', COALESCE(sum(ml) FILTER (WHERE origem <> 'producao'),0),
      'registros', count(*)),
    (SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'ml')::numeric DESC),'[]') FROM (SELECT jsonb_build_object('tipo', tipo, 'ml', sum(ml), 'valor', CASE WHEN v_c THEN sum(valor) END, 'registros', count(*)) x FROM p GROUP BY tipo) q),
    (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('produto_id', produto_id, 'perfume', public.fn__decant_rotulo(produto_id), 'ml', sum(ml), 'valor', CASE WHEN v_c THEN sum(valor) END) x
       FROM p GROUP BY produto_id ORDER BY sum(ml) DESC LIMIT 10) q),
    (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('id', p.id, 'data', p.created_at, 'tipo', p.tipo, 'origem', p.origem,
        'perfume', public.fn__decant_rotulo(p.produto_id), 'frasco', f.codigo, 'lote', l.codigo, 'filial', u.nome, 'ml', p.ml,
        'custo_ml', CASE WHEN v_c THEN p.custo_ml END, 'valor', CASE WHEN v_c THEN p.valor END, 'absorvida_custo', p.absorvida_custo,
        'usuario', p.usuario_nome, 'justificativa', p.justificativa) x
       FROM p LEFT JOIN public.decant_frascos f ON f.id = p.frasco_id LEFT JOIN public.decant_lotes l ON l.id = p.lote_id
       LEFT JOIN public.unidades u ON u.id = p.unidade_id ORDER BY p.created_at DESC LIMIT 200) q)
  INTO v_res, v_tipos, v_perf, v_lin FROM p;
  RETURN v_res || jsonb_build_object('ml_movimentado', v_mov,
    'pct', CASE WHEN v_mov > 0 THEN round((v_res->>'ml')::numeric / v_mov * 100, 2) ELSE 0 END,
    'max_pct', v_max,
    'alerta', v_mov > 0 AND (v_res->>'ml')::numeric / v_mov * 100 > v_max,
    'por_tipo', v_tipos, 'por_perfume', v_perf, 'linhas', v_lin, 'ver_custos', v_c);
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_decant_perdas_painel(uuid,date,date), public.fn_decant_registrar_perda(uuid,text,numeric,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_perdas_painel(uuid,date,date), public.fn_decant_registrar_perda(uuid,text,numeric,text,text) TO authenticated;