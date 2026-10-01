-- Decants Fase 4 (parte 2): dashboard, rentabilidade, visão 360° e relatórios. Somente funções de leitura.
CREATE OR REPLACE FUNCTION public.fn_decant_dashboard(p_unidade uuid, p_ini date, p_fim date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c boolean := public.fn__decant_ver_custos(); v_m boolean := public.fn__decant_ver_margem();
  v_hoje date := public.fn__hoje_manaus(); v_mes date := date_trunc('month', public.fn__hoje_manaus())::date;
  v_cards jsonb; v_rank jsonb; v_fr jsonb; v_est jsonb;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  CREATE TEMP TABLE IF NOT EXISTS _dv ON COMMIT DROP AS SELECT * FROM public.fn__decant_vendas_liq(NULL, '1900-01-01', '1900-01-01') LIMIT 0;
  TRUNCATE _dv;
  INSERT INTO _dv SELECT * FROM public.fn__decant_vendas_liq(p_unidade, LEAST(p_ini, v_mes), GREATEST(p_fim, v_hoje));

  WITH fr AS (SELECT f.id, f.produto_id, f.custo_ml, public.fn_decant_saldo_frasco(f.id) AS saldo, public.fn_decant_disponivel_frasco(f.id) AS disp
                FROM public.decant_frascos f WHERE f.status = 'aberto' AND (p_unidade IS NULL OR f.unidade_id = p_unidade) AND public.fn__pode(f.unidade_id,'decant.ver'))
  SELECT jsonb_build_object('ml_saldo', COALESCE(sum(saldo),0), 'ml_disponivel', COALESCE(sum(GREATEST(disp,0)),0),
    'frascos_abertos', count(*) FILTER (WHERE saldo > 0), 'perfumes_abertos', count(DISTINCT produto_id) FILTER (WHERE saldo > 0),
    'custo_ml_aberto', COALESCE(sum(saldo * custo_ml),0)) INTO v_fr FROM fr;
  SELECT jsonb_build_object(
    'custo_prontos', COALESCE(sum(e.quantidade * e.custo_unit),0), 'potencial_venda', COALESCE(sum(e.quantidade * s.preco_venda),0),
    'unidades_prontas', COALESCE(sum(e.quantidade),0),
    'fechados', (SELECT COALESCE(sum(fs.quantidade),0) FROM public.decant_fechados_saldo fs WHERE (p_unidade IS NULL OR fs.unidade_id = p_unidade) AND public.fn__pode(fs.unidade_id,'decant.ver')),
    'custo_fechados', (SELECT COALESCE(sum(fs.quantidade * COALESCE(NULLIF(pf.custo_medio,0), pf.custo, 0)),0) FROM public.decant_fechados_saldo fs JOIN public.perfumes pf ON pf.id = fs.produto_id
                        WHERE (p_unidade IS NULL OR fs.unidade_id = p_unidade) AND public.fn__pode(fs.unidade_id,'decant.ver')))
  INTO v_est FROM public.decant_estoque e JOIN public.decant_skus s ON s.id = e.sku_id
  WHERE e.quantidade > 0 AND (p_unidade IS NULL OR e.unidade_id = p_unidade) AND public.fn__pode(e.unidade_id,'decant.ver');

  SELECT jsonb_build_object(
    'faturamento_periodo', COALESCE(sum(receita) FILTER (WHERE dia BETWEEN p_ini AND p_fim),0),
    'faturamento_hoje', COALESCE(sum(receita) FILTER (WHERE dia = v_hoje),0),
    'faturamento_mes', COALESCE(sum(receita) FILTER (WHERE dia BETWEEN v_mes AND v_hoje),0),
    'vendidos_un', COALESCE(sum(qtd) FILTER (WHERE dia BETWEEN p_ini AND p_fim),0),
    'ml_vendido', COALESCE(sum(qtd * volume_ml) FILTER (WHERE dia BETWEEN p_ini AND p_fim),0),
    'cmv', CASE WHEN v_c THEN COALESCE(sum(cmv) FILTER (WHERE dia BETWEEN p_ini AND p_fim),0) END,
    'lucro_bruto', CASE WHEN v_m THEN COALESCE(sum(receita - cmv) FILTER (WHERE dia BETWEEN p_ini AND p_fim),0) END,
    'margem_pct', CASE WHEN v_m AND COALESCE(sum(receita) FILTER (WHERE dia BETWEEN p_ini AND p_fim),0) > 0
      THEN round(sum(receita - cmv) FILTER (WHERE dia BETWEEN p_ini AND p_fim) / sum(receita) FILTER (WHERE dia BETWEEN p_ini AND p_fim) * 100, 2) END)
  INTO v_cards FROM _dv;

  v_cards := v_cards || jsonb_build_object(
    'produzidos_un', (SELECT COALESCE(sum(i.qtd_fisica),0) FROM public.decant_lote_itens i JOIN public.decant_lotes l ON l.id = i.lote_id
       WHERE l.status = 'concluido' AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver')
         AND public.fn__decant_dia(COALESCE(l.conferido_em, l.concluido_em)) BETWEEN p_ini AND p_fim),
    'ml_disponivel', v_fr->'ml_disponivel', 'ml_saldo', v_fr->'ml_saldo', 'perfumes_abertos', v_fr->'perfumes_abertos', 'frascos_abertos', v_fr->'frascos_abertos',
    'fechados_reservados', v_est->'fechados', 'unidades_prontas', v_est->'unidades_prontas',
    'custo_estoque', CASE WHEN v_c THEN round((v_est->>'custo_prontos')::numeric + (v_fr->>'custo_ml_aberto')::numeric + (v_est->>'custo_fechados')::numeric, 2) END,
    'potencial_venda', v_est->'potencial_venda',
    'perdas_ml', (SELECT COALESCE(sum(ml),0) FROM public.decant_perdas d WHERE (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver') AND public.fn__decant_dia(d.created_at) BETWEEN p_ini AND p_fim),
    'perdas_valor', CASE WHEN v_c THEN (SELECT COALESCE(sum(valor),0) FROM public.decant_perdas d WHERE (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver') AND public.fn__decant_dia(d.created_at) BETWEEN p_ini AND p_fim) END);

  SELECT jsonb_build_object(
    'mais_vendidos', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('rotulo', s.sku || ' · ' || public.fn__decant_rotulo(s.produto_id), 'qtd', sum(v.qtd), 'receita', sum(v.receita)) x
        FROM _dv v JOIN public.decant_skus s ON s.id = v.sku_id WHERE v.dia BETWEEN p_ini AND p_fim GROUP BY s.id HAVING sum(v.qtd) > 0 ORDER BY sum(v.qtd) DESC LIMIT 10) q),
    'perfumes_mais_usados', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('rotulo', public.fn__decant_rotulo(f.produto_id), 'ml', sum(-l.ml)) x
        FROM public.decant_ml_ledger l JOIN public.decant_frascos f ON f.id = l.frasco_id
        WHERE l.tipo = 'producao' AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver')
          AND public.fn__decant_dia(l.created_at) BETWEEN p_ini AND p_fim GROUP BY f.produto_id ORDER BY sum(-l.ml) DESC LIMIT 10) q),
    'maior_faturamento', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('rotulo', public.fn__decant_rotulo(produto_id), 'receita', sum(receita), 'qtd', sum(qtd)) x
        FROM _dv WHERE dia BETWEEN p_ini AND p_fim GROUP BY produto_id HAVING sum(receita) > 0 ORDER BY sum(receita) DESC LIMIT 10) q),
    'maior_margem', CASE WHEN v_m THEN (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('rotulo', public.fn__decant_rotulo(produto_id), 'lucro', sum(receita - cmv),
          'margem_pct', round(sum(receita - cmv) / sum(receita) * 100, 2)) x
        FROM _dv WHERE dia BETWEEN p_ini AND p_fim GROUP BY produto_id HAVING sum(receita) > 0 ORDER BY sum(receita - cmv) / sum(receita) DESC LIMIT 10) q) END,
    'maior_perda', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('rotulo', public.fn__decant_rotulo(produto_id), 'ml', sum(ml), 'valor', CASE WHEN v_c THEN sum(valor) END) x
        FROM public.decant_perdas d WHERE (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver')
          AND public.fn__decant_dia(d.created_at) BETWEEN p_ini AND p_fim GROUP BY produto_id ORDER BY sum(ml) DESC LIMIT 10) q),
    'tamanhos', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('rotulo', public.fn__fmt_ml(volume_ml) || ' ml', 'qtd', sum(qtd), 'receita', sum(receita)) x
        FROM _dv WHERE dia BETWEEN p_ini AND p_fim GROUP BY volume_ml HAVING sum(qtd) > 0 ORDER BY sum(qtd) DESC) q))
  INTO v_rank;
  RETURN jsonb_build_object('cards', v_cards, 'rankings', v_rank, 'ver_custos', v_c, 'ver_margem', v_m, 'ini', p_ini, 'fim', p_fim);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_rentabilidade(p_agrupar text, p_unidade uuid, p_ini date, p_fim date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c boolean := public.fn__decant_ver_custos(); v_m boolean := public.fn__decant_ver_margem(); v_r jsonb;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  IF p_agrupar = 'perfume' THEN
    WITH v AS (SELECT produto_id, sum(qtd) qtd, sum(receita) receita, sum(cmv) cmv FROM public.fn__decant_vendas_liq(p_unidade, p_ini, p_fim) GROUP BY produto_id),
    fr AS (SELECT f.produto_id, sum(f.custo) custo_frasco, sum(f.volume_inicial_ml) vol_ini, sum(public.fn_decant_saldo_frasco(f.id)) restante
             FROM public.decant_frascos f WHERE (p_unidade IS NULL OR f.unidade_id = p_unidade) AND public.fn__pode(f.unidade_id,'decant.ver') GROUP BY f.produto_id),
    pml AS (SELECT s.produto_id, avg(s.preco_venda / t.volume_ml) preco_ml FROM public.decant_skus s JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
             WHERE s.ativo AND s.preco_venda > 0 GROUP BY s.produto_id),
    pr AS (SELECT s.produto_id, sum(e.quantidade * s.preco_venda) val FROM public.decant_estoque e JOIN public.decant_skus s ON s.id = e.sku_id
             WHERE (p_unidade IS NULL OR e.unidade_id = p_unidade) AND public.fn__pode(e.unidade_id,'decant.ver') GROUP BY s.produto_id),
    ids AS (SELECT produto_id FROM v UNION SELECT produto_id FROM fr)
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'receita')::numeric DESC NULLS LAST),'[]') INTO v_r FROM (
      SELECT jsonb_build_object('chave', ids.produto_id, 'rotulo', public.fn__decant_rotulo(ids.produto_id),
        'custo_frasco', CASE WHEN v_c THEN COALESCE(fr.custo_frasco,0) END,
        'volume_utilizado', COALESCE(fr.vol_ini - fr.restante,0), 'volume_restante', COALESCE(fr.restante,0),
        'qtd', COALESCE(v.qtd,0), 'receita', COALESCE(v.receita,0),
        'receita_potencial', round(COALESCE(pr.val,0) + COALESCE(fr.restante,0) * COALESCE(pml.preco_ml,0), 2),
        'custo_consumido', CASE WHEN v_c THEN COALESCE(v.cmv,0) END,
        'lucro_bruto', CASE WHEN v_m THEN COALESCE(v.receita,0) - COALESCE(v.cmv,0) END,
        'margem_pct', CASE WHEN v_m AND COALESCE(v.receita,0) > 0 THEN round((v.receita - v.cmv) / v.receita * 100, 2) END) x
      FROM ids LEFT JOIN v ON v.produto_id = ids.produto_id LEFT JOIN fr ON fr.produto_id = ids.produto_id
      LEFT JOIN pml ON pml.produto_id = ids.produto_id LEFT JOIN pr ON pr.produto_id = ids.produto_id) q;
  ELSIF p_agrupar = 'tamanho' THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'volume_ml')::numeric),'[]') INTO v_r FROM (
      SELECT jsonb_build_object('chave', volume_ml, 'rotulo', public.fn__fmt_ml(volume_ml) || ' ml', 'volume_ml', volume_ml, 'qtd', sum(qtd), 'receita', sum(receita),
        'custo_consumido', CASE WHEN v_c THEN sum(cmv) END, 'lucro_bruto', CASE WHEN v_m THEN sum(receita - cmv) END,
        'margem_pct', CASE WHEN v_m AND sum(receita) > 0 THEN round(sum(receita - cmv) / sum(receita) * 100, 2) END) x
      FROM public.fn__decant_vendas_liq(p_unidade, p_ini, p_fim) GROUP BY volume_ml) q;
  ELSIF p_agrupar = 'filial' THEN
    WITH v AS (SELECT unidade_id, sum(qtd) qtd, sum(receita) receita, sum(cmv) cmv FROM public.fn__decant_vendas_liq(p_unidade, p_ini, p_fim) GROUP BY unidade_id),
    pe AS (SELECT unidade_id, sum(ml) ml, sum(valor) valor FROM public.decant_perdas d WHERE (p_unidade IS NULL OR d.unidade_id = p_unidade)
             AND public.fn__pode(d.unidade_id,'decant.ver') AND public.fn__decant_dia(d.created_at) BETWEEN p_ini AND p_fim GROUP BY unidade_id),
    ids AS (SELECT unidade_id FROM v UNION SELECT unidade_id FROM pe)
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'receita')::numeric DESC),'[]') INTO v_r FROM (
      SELECT jsonb_build_object('chave', ids.unidade_id, 'rotulo', u.nome, 'qtd', COALESCE(v.qtd,0), 'receita', COALESCE(v.receita,0),
        'custo_consumido', CASE WHEN v_c THEN COALESCE(v.cmv,0) END, 'lucro_bruto', CASE WHEN v_m THEN COALESCE(v.receita,0) - COALESCE(v.cmv,0) END,
        'margem_pct', CASE WHEN v_m AND COALESCE(v.receita,0) > 0 THEN round((v.receita - v.cmv) / v.receita * 100, 2) END,
        'perdas_ml', COALESCE(pe.ml,0), 'perdas_valor', CASE WHEN v_c THEN COALESCE(pe.valor,0) END) x
      FROM ids JOIN public.unidades u ON u.id = ids.unidade_id LEFT JOIN v ON v.unidade_id = ids.unidade_id LEFT JOIN pe ON pe.unidade_id = ids.unidade_id) q;
  ELSE RAISE EXCEPTION 'Agrupamento inválido';
  END IF;
  RETURN jsonb_build_object('linhas', v_r, 'ver_custos', v_c, 'ver_margem', v_m);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_perfume_360(p_produto_id uuid, p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c boolean := public.fn__decant_ver_custos(); v_m boolean := public.fn__decant_ver_margem(); v_p public.perfumes;
  v_hoje date := public.fn__hoje_manaus(); v_mes date := date_trunc('month', public.fn__hoje_manaus())::date;
  v_rend numeric; v_res jsonb; v_mov numeric; v_perd numeric;
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.ver');
  SELECT * INTO v_p FROM public.perfumes WHERE id = p_produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfume não encontrado'; END IF;
  v_rend := COALESCE((SELECT rendimento_util FROM public.decant_perfume_config WHERE produto_id = p_produto_id), (public.fn__decant_cfg()->>'rendimento_padrao')::numeric, 100);
  SELECT COALESCE(sum(-l.ml),0) INTO v_mov FROM public.decant_ml_ledger l JOIN public.decant_frascos f ON f.id = l.frasco_id
   WHERE f.produto_id = p_produto_id AND l.ml < 0 AND l.tipo <> 'abertura' AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver');
  SELECT COALESCE(sum(ml),0) INTO v_perd FROM public.decant_perdas d WHERE d.produto_id = p_produto_id AND (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver');

  WITH fr AS (SELECT f.*, public.fn_decant_saldo_frasco(f.id) saldo, public.fn_decant_disponivel_frasco(f.id) disp, u.nome unidade_nome
                FROM public.decant_frascos f JOIN public.unidades u ON u.id = f.unidade_id
                WHERE f.produto_id = p_produto_id AND (p_unidade IS NULL OR f.unidade_id = p_unidade) AND public.fn__pode(f.unidade_id,'decant.ver')),
  vm AS (SELECT * FROM public.fn__decant_vendas_liq(p_unidade, v_mes, v_hoje) WHERE produto_id = p_produto_id)
  SELECT jsonb_build_object(
    'perfume', jsonb_build_object('id', v_p.id, 'codigo', v_p.codigo, 'rotulo', public.fn__decant_rotulo(v_p.id), 'marca', v_p.marca, 'nome', v_p.nome,
       'concentracao', v_p.concentracao, 'volume', v_p.volume, 'image_url', v_p.image_url, 'preco_venda', v_p.preco_venda,
       'custo', CASE WHEN v_c THEN COALESCE(NULLIF(v_p.custo_medio,0), v_p.custo) END, 'rendimento_util', v_rend),
    'custo_ml', CASE WHEN v_c THEN COALESCE(
        (SELECT round(sum(saldo * custo_ml) / NULLIF(sum(saldo),0), 6) FROM fr WHERE saldo > 0),
        CASE WHEN COALESCE(v_p.volume,0) > 0 THEN public.fn_decant_custo_ml(COALESCE(NULLIF(v_p.custo_medio,0), v_p.custo, 0), v_p.volume, v_rend) END) END,
    'frascos_fechados', (SELECT COALESCE(sum(quantidade),0) FROM public.decant_fechados_saldo fs WHERE fs.produto_id = p_produto_id AND (p_unidade IS NULL OR fs.unidade_id = p_unidade) AND public.fn__pode(fs.unidade_id,'decant.ver')),
    'frascos_abertos', (SELECT count(*) FROM fr WHERE status = 'aberto' AND saldo > 0),
    'volume_disponivel', (SELECT COALESCE(sum(GREATEST(disp,0)),0) FROM fr WHERE status = 'aberto'),
    'volume_saldo', (SELECT COALESCE(sum(saldo),0) FROM fr),
    'vendido_mes', (SELECT COALESCE(sum(qtd),0) FROM vm), 'faturamento_mes', (SELECT COALESCE(sum(receita),0) FROM vm),
    'margem_mes', CASE WHEN v_m THEN (SELECT CASE WHEN sum(receita) > 0 THEN round(sum(receita - cmv) / sum(receita) * 100, 2) END FROM vm) END,
    'lucro_mes', CASE WHEN v_m THEN (SELECT COALESCE(sum(receita - cmv),0) FROM vm) END,
    'perdas_ml', v_perd,
    'perdas_valor', CASE WHEN v_c THEN (SELECT COALESCE(sum(valor),0) FROM public.decant_perdas d WHERE d.produto_id = p_produto_id AND (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver')) END,
    'perda_media_pct', CASE WHEN v_mov > 0 THEN round(v_perd / v_mov * 100, 2) ELSE 0 END,
    'frascos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('codigo', codigo, 'filial', unidade_nome, 'status', status, 'saldo', saldo, 'disponivel', disp,
        'inicial', volume_inicial_ml, 'aberto_em', aberto_em, 'custo_ml', CASE WHEN v_c THEN custo_ml END) ORDER BY aberto_em),'[]') FROM fr),
    'tamanhos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tamanho_id', t.id, 'volume_ml', t.volume_ml, 'nome', t.nome, 'sku', s.sku, 'preco', s.preco_venda,
        'insumos', CASE WHEN v_c THEN t.custo_frasco + t.custo_atomizador + t.custo_etiqueta + t.custo_embalagem + t.custo_adicional + t.custo_mao_obra END,
        'prontos', (SELECT COALESCE(sum(e.quantidade),0) FROM public.decant_estoque e WHERE e.sku_id = s.id AND (p_unidade IS NULL OR e.unidade_id = p_unidade) AND public.fn__pode(e.unidade_id,'decant.ver')))
        ORDER BY t.volume_ml),'[]')
      FROM public.decant_tamanhos t LEFT JOIN public.decant_skus s ON s.tamanho_id = t.id AND s.produto_id = p_produto_id WHERE t.ativo),
    'historico', (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') FROM (
        (SELECT jsonb_build_object('data', l.created_at, 'tipo', l.tipo, 'item', f.codigo, 'filial', f.unidade_nome, 'quantidade', l.ml, 'medida', 'ml', 'usuario', l.usuario_nome, 'motivo', l.motivo) x
           FROM public.decant_ml_ledger l JOIN fr f ON f.id = l.frasco_id ORDER BY l.created_at DESC LIMIT 100)
        UNION ALL
        (SELECT jsonb_build_object('data', u.created_at, 'tipo', u.tipo, 'item', s.sku, 'filial', un.nome, 'quantidade', u.quantidade, 'medida', 'un', 'usuario', u.usuario_nome, 'motivo', u.motivo)
           FROM public.decant_un_ledger u JOIN public.decant_skus s ON s.id = u.sku_id JOIN public.unidades un ON un.id = u.unidade_id
           WHERE s.produto_id = p_produto_id AND (p_unidade IS NULL OR u.unidade_id = p_unidade) AND public.fn__pode(u.unidade_id,'decant.ver')
           ORDER BY u.created_at DESC LIMIT 100)) q),
    'lotes', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('codigo', l.codigo, 'status', l.status, 'filial', u.nome, 'volume_total_ml', l.volume_total_ml,
        'ml_consumido', l.ml_consumido, 'perdas_ml', l.perdas_ml, 'custo_total', CASE WHEN v_c THEN l.custo_total END, 'data', l.created_at,
        'itens', (SELECT jsonb_agg(jsonb_build_object('volume_ml', i.volume_ml, 'planejado', i.qtd_planejada, 'fisico', i.qtd_fisica)) FROM public.decant_lote_itens i WHERE i.lote_id = l.id)) x
       FROM public.decant_lotes l JOIN public.unidades u ON u.id = l.unidade_id
       WHERE l.produto_id = p_produto_id AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver')
       ORDER BY l.created_at DESC LIMIT 50) q),
    'vendas', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('data', v.created_at, 'sku', s.sku, 'filial', u.nome, 'quantidade', v.quantidade,
        'devolvida', v.qtd_devolvida, 'total', v.total, 'status', v.status, 'canal', v.canal, 'vendedora', v.vendedora) x
       FROM public.decant_vendas v JOIN public.decant_skus s ON s.id = v.sku_id JOIN public.unidades u ON u.id = v.unidade_id
       WHERE s.produto_id = p_produto_id AND (p_unidade IS NULL OR v.unidade_id = p_unidade) AND public.fn__pode(v.unidade_id,'decant.ver')
       ORDER BY v.created_at DESC LIMIT 50) q),
    'perdas', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('data', d.created_at, 'tipo', d.tipo, 'origem', d.origem, 'ml', d.ml,
        'valor', CASE WHEN v_c THEN d.valor END, 'justificativa', d.justificativa, 'usuario', d.usuario_nome) x
       FROM public.decant_perdas d WHERE d.produto_id = p_produto_id AND (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver')
       ORDER BY d.created_at DESC LIMIT 50) q),
    'estoque', (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT jsonb_build_object('sku', s.sku, 'filial', u.nome, 'quantidade', sum(e.quantidade),
        'custo_unit', CASE WHEN v_c THEN round(sum(e.quantidade * e.custo_unit) / NULLIF(sum(e.quantidade),0), 4) END, 'preco', s.preco_venda) x
       FROM public.decant_estoque e JOIN public.decant_skus s ON s.id = e.sku_id JOIN public.unidades u ON u.id = e.unidade_id
       WHERE s.produto_id = p_produto_id AND e.quantidade > 0 AND (p_unidade IS NULL OR e.unidade_id = p_unidade) AND public.fn__pode(e.unidade_id,'decant.ver')
       GROUP BY s.sku, u.nome, s.preco_venda ORDER BY s.sku) q),
    'ver_custos', v_c, 'ver_margem', v_m)
  INTO v_res;
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_relatorio(p_tipo text, p_unidade uuid, p_ini date, p_fim date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c boolean := public.fn__decant_ver_custos(); v_m boolean := public.fn__decant_ver_margem();
  v_cols jsonb; v_lin jsonb; v_rm text[] := '{}'; v_col jsonb; v_cl jsonb := '[]';
BEGIN
  PERFORM public.fn__decant_exigir_leitura('decant.relatorios');
  IF p_tipo = 'producao' THEN
    v_cols := '[{"k":"data","l":"Data"},{"k":"lote","l":"Lote"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"tamanho","l":"Tamanho (ml)"},{"k":"planejado","l":"Planejado"},{"k":"fisico","l":"Produzido"},{"k":"diferenca","l":"Diferença"},{"k":"custo_unit","l":"Custo unitário","c":1}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') INTO v_lin FROM (SELECT jsonb_build_object('data', public.fn__decant_dia(COALESCE(l.conferido_em,l.concluido_em)), 'lote', l.codigo,
      'perfume', public.fn__decant_rotulo(l.produto_id), 'filial', u.nome, 'tamanho', i.volume_ml, 'planejado', i.qtd_planejada, 'fisico', i.qtd_fisica,
      'diferenca', i.diferenca, 'custo_unit', i.custo_unitario) x
      FROM public.decant_lote_itens i JOIN public.decant_lotes l ON l.id = i.lote_id JOIN public.unidades u ON u.id = l.unidade_id
      WHERE l.status = 'concluido' AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver')
        AND public.fn__decant_dia(COALESCE(l.conferido_em,l.concluido_em)) BETWEEN p_ini AND p_fim) q;
  ELSIF p_tipo = 'vendas' THEN
    v_cols := '[{"k":"data","l":"Data"},{"k":"sku","l":"SKU"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"canal","l":"Canal"},{"k":"vendedora","l":"Vendedora"},{"k":"quantidade","l":"Qtd"},{"k":"devolvida","l":"Devolvida"},{"k":"status","l":"Status"},{"k":"preco","l":"Preço"},{"k":"receita","l":"Receita líquida"},{"k":"custo","l":"Custo","c":1},{"k":"lucro","l":"Lucro bruto","m":1}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') INTO v_lin FROM (SELECT jsonb_build_object('data', v.dia, 'sku', s.sku, 'perfume', public.fn__decant_rotulo(v.produto_id),
      'filial', u.nome, 'canal', v.canal, 'vendedora', v.vendedora, 'quantidade', v.quantidade, 'devolvida', v.qtd_devolvida, 'status', v.status, 'preco', v.preco_unit,
      'receita', v.receita, 'custo', v.cmv, 'lucro', v.receita - v.cmv) x
      FROM public.fn__decant_vendas_liq(p_unidade, p_ini, p_fim) v JOIN public.decant_skus s ON s.id = v.sku_id JOIN public.unidades u ON u.id = v.unidade_id) q;
  ELSIF p_tipo = 'estoque' THEN
    v_cols := '[{"k":"sku","l":"SKU"},{"k":"perfume","l":"Perfume"},{"k":"tamanho","l":"Tamanho (ml)"},{"k":"filial","l":"Filial"},{"k":"quantidade","l":"Quantidade"},{"k":"minimo","l":"Mínimo"},{"k":"preco","l":"Preço"},{"k":"valor_venda","l":"Valor de venda"},{"k":"custo_unit","l":"Custo médio","c":1},{"k":"valor_custo","l":"Valor de custo","c":1}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'sku'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('sku', s.sku, 'perfume', public.fn__decant_rotulo(s.produto_id), 'tamanho', t.volume_ml,
      'filial', u.nome, 'quantidade', sum(e.quantidade), 'minimo', COALESCE(max(su.estoque_minimo),0), 'preco', s.preco_venda,
      'valor_venda', sum(e.quantidade) * s.preco_venda, 'custo_unit', round(sum(e.quantidade * e.custo_unit) / NULLIF(sum(e.quantidade),0), 4),
      'valor_custo', round(sum(e.quantidade * e.custo_unit), 2)) x
      FROM public.decant_estoque e JOIN public.decant_skus s ON s.id = e.sku_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
      JOIN public.unidades u ON u.id = e.unidade_id LEFT JOIN public.decant_sku_unidade su ON su.sku_id = e.sku_id AND su.unidade_id = e.unidade_id
      WHERE (p_unidade IS NULL OR e.unidade_id = p_unidade) AND public.fn__pode(e.unidade_id,'decant.ver')
      GROUP BY s.id, s.sku, s.produto_id, t.volume_ml, u.nome, s.preco_venda HAVING sum(e.quantidade) > 0) q;
  ELSIF p_tipo = 'estoque_filial' THEN
    v_cols := '[{"k":"filial","l":"Filial"},{"k":"skus","l":"SKUs com estoque"},{"k":"unidades","l":"Decants prontos"},{"k":"valor_venda","l":"Valor de venda"},{"k":"valor_custo","l":"Valor de custo","c":1},{"k":"ml_aberto","l":"ml em frascos abertos"},{"k":"fechados","l":"Frascos fechados p/ decant"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'filial'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('filial', u.nome,
      'skus', (SELECT count(DISTINCT e.sku_id) FROM public.decant_estoque e WHERE e.unidade_id = u.id AND e.quantidade > 0),
      'unidades', (SELECT COALESCE(sum(e.quantidade),0) FROM public.decant_estoque e WHERE e.unidade_id = u.id),
      'valor_venda', (SELECT COALESCE(sum(e.quantidade * s.preco_venda),0) FROM public.decant_estoque e JOIN public.decant_skus s ON s.id = e.sku_id WHERE e.unidade_id = u.id),
      'valor_custo', (SELECT COALESCE(round(sum(e.quantidade * e.custo_unit),2),0) FROM public.decant_estoque e WHERE e.unidade_id = u.id),
      'ml_aberto', (SELECT COALESCE(sum(public.fn_decant_saldo_frasco(f.id)),0) FROM public.decant_frascos f WHERE f.unidade_id = u.id AND f.status = 'aberto'),
      'fechados', (SELECT COALESCE(sum(fs.quantidade),0) FROM public.decant_fechados_saldo fs WHERE fs.unidade_id = u.id)) x
      FROM public.unidades u WHERE (p_unidade IS NULL OR u.id = p_unidade) AND public.fn__pode(u.id,'decant.ver')
        AND (EXISTS (SELECT 1 FROM public.decant_estoque e WHERE e.unidade_id = u.id) OR EXISTS (SELECT 1 FROM public.decant_frascos f WHERE f.unidade_id = u.id)
             OR EXISTS (SELECT 1 FROM public.decant_fechados_saldo fs WHERE fs.unidade_id = u.id AND fs.quantidade > 0))) q;
  ELSIF p_tipo = 'volume_disponivel' THEN
    v_cols := '[{"k":"frasco","l":"Frasco"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"aberto_em","l":"Aberto em"},{"k":"dias_aberto","l":"Dias aberto"},{"k":"inicial","l":"Inicial (ml)"},{"k":"saldo","l":"Saldo (ml)"},{"k":"reservado","l":"Reservado (ml)"},{"k":"disponivel","l":"Disponível (ml)"},{"k":"custo_ml","l":"Custo/ml","c":1}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'aberto_em'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('frasco', f.codigo, 'perfume', public.fn__decant_rotulo(f.produto_id),
      'filial', u.nome, 'aberto_em', public.fn__decant_dia(f.aberto_em), 'dias_aberto', public.fn__hoje_manaus() - public.fn__decant_dia(f.aberto_em),
      'inicial', f.volume_inicial_ml, 'saldo', public.fn_decant_saldo_frasco(f.id), 'reservado', public.fn_decant_reservado_frasco(f.id),
      'disponivel', public.fn_decant_disponivel_frasco(f.id), 'custo_ml', f.custo_ml) x
      FROM public.decant_frascos f JOIN public.unidades u ON u.id = f.unidade_id
      WHERE f.status = 'aberto' AND (p_unidade IS NULL OR f.unidade_id = p_unidade) AND public.fn__pode(f.unidade_id,'decant.ver')
        AND public.fn_decant_saldo_frasco(f.id) > 0) q;
  ELSIF p_tipo = 'perfumes_abertos_fechados' THEN
    v_cols := '[{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"fechados","l":"Frascos fechados p/ decant"},{"k":"abertos","l":"Frascos abertos"},{"k":"ml_disponivel","l":"ml disponível"}]';
    WITH a AS (SELECT f.produto_id, f.unidade_id, count(*) FILTER (WHERE public.fn_decant_saldo_frasco(f.id) > 0) abertos,
                 sum(GREATEST(public.fn_decant_disponivel_frasco(f.id),0)) disp FROM public.decant_frascos f WHERE f.status = 'aberto' GROUP BY 1,2),
    k AS (SELECT produto_id, unidade_id FROM a UNION SELECT produto_id, unidade_id FROM public.decant_fechados_saldo WHERE quantidade > 0)
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'perfume'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('perfume', public.fn__decant_rotulo(k.produto_id), 'filial', u.nome,
      'fechados', COALESCE(fs.quantidade,0), 'abertos', COALESCE(a.abertos,0), 'ml_disponivel', COALESCE(a.disp,0)) x
      FROM k JOIN public.unidades u ON u.id = k.unidade_id LEFT JOIN a ON a.produto_id = k.produto_id AND a.unidade_id = k.unidade_id
      LEFT JOIN public.decant_fechados_saldo fs ON fs.produto_id = k.produto_id AND fs.unidade_id = k.unidade_id
      WHERE (p_unidade IS NULL OR k.unidade_id = p_unidade) AND public.fn__pode(k.unidade_id,'decant.ver')) q;
  ELSIF p_tipo = 'perdas' THEN
    v_cols := '[{"k":"data","l":"Data"},{"k":"tipo","l":"Tipo"},{"k":"origem","l":"Origem"},{"k":"perfume","l":"Perfume"},{"k":"frasco","l":"Frasco"},{"k":"lote","l":"Lote"},{"k":"filial","l":"Filial"},{"k":"ml","l":"ml perdidos"},{"k":"custo_ml","l":"Custo/ml","c":1},{"k":"valor","l":"Valor da perda","c":1},{"k":"usuario","l":"Usuário"},{"k":"justificativa","l":"Justificativa"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') INTO v_lin FROM (SELECT jsonb_build_object('data', d.created_at, 'tipo', d.tipo,
      'origem', CASE d.origem WHEN 'producao' THEN 'Produção (no custo do lote)' WHEN 'unidades' THEN 'Decants prontos' ELSE 'Frasco' END,
      'perfume', public.fn__decant_rotulo(d.produto_id), 'frasco', f.codigo, 'lote', l.codigo, 'filial', u.nome, 'ml', d.ml, 'custo_ml', d.custo_ml, 'valor', d.valor,
      'usuario', d.usuario_nome, 'justificativa', d.justificativa) x
      FROM public.decant_perdas d JOIN public.unidades u ON u.id = d.unidade_id LEFT JOIN public.decant_frascos f ON f.id = d.frasco_id LEFT JOIN public.decant_lotes l ON l.id = d.lote_id
      WHERE (p_unidade IS NULL OR d.unidade_id = p_unidade) AND public.fn__pode(d.unidade_id,'decant.ver') AND public.fn__decant_dia(d.created_at) BETWEEN p_ini AND p_fim) q;
  ELSIF p_tipo IN ('margem','mais_vendidos') THEN
    v_cols := '[{"k":"sku","l":"SKU"},{"k":"perfume","l":"Perfume"},{"k":"quantidade","l":"Qtd vendida"},{"k":"receita","l":"Receita"},{"k":"custo","l":"Custo","c":1},{"k":"lucro","l":"Lucro bruto","m":1},{"k":"margem_pct","l":"Margem %","m":1}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY CASE WHEN p_tipo = 'mais_vendidos' THEN (x->>'quantidade')::numeric ELSE (x->>'receita')::numeric END DESC),'[]') INTO v_lin FROM (
      SELECT jsonb_build_object('sku', s.sku, 'perfume', public.fn__decant_rotulo(s.produto_id), 'quantidade', sum(v.qtd), 'receita', sum(v.receita), 'custo', sum(v.cmv),
        'lucro', sum(v.receita - v.cmv), 'margem_pct', CASE WHEN sum(v.receita) > 0 THEN round(sum(v.receita - v.cmv) / sum(v.receita) * 100, 2) END) x
      FROM public.fn__decant_vendas_liq(p_unidade, p_ini, p_fim) v JOIN public.decant_skus s ON s.id = v.sku_id GROUP BY s.id, s.sku, s.produto_id HAVING sum(v.qtd) > 0) q;
  ELSIF p_tipo = 'custos' THEN
    v_cols := '[{"k":"sku","l":"SKU"},{"k":"perfume","l":"Perfume"},{"k":"tamanho","l":"Tamanho (ml)"},{"k":"preco","l":"Preço"},{"k":"custo_ml","l":"Custo/ml","c":1},{"k":"custo_liquido","l":"Custo do líquido","c":1},{"k":"insumos","l":"Embalagem + mão de obra","c":1},{"k":"custo_total","l":"Custo total","c":1},{"k":"custo_medio_estoque","l":"Custo médio em estoque","c":1},{"k":"margem_pct","l":"Margem %","m":1}]';
    WITH cm AS (SELECT f.produto_id, round(sum(public.fn_decant_saldo_frasco(f.id) * f.custo_ml) / NULLIF(sum(public.fn_decant_saldo_frasco(f.id)),0), 6) custo_ml
                 FROM public.decant_frascos f WHERE f.status = 'aberto' AND (p_unidade IS NULL OR f.unidade_id = p_unidade) GROUP BY f.produto_id)
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'sku'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('sku', s.sku, 'perfume', public.fn__decant_rotulo(s.produto_id), 'tamanho', t.volume_ml,
      'preco', s.preco_venda, 'custo_ml', cm.custo_ml, 'custo_liquido', round(t.volume_ml * COALESCE(cm.custo_ml,0), 2),
      'insumos', t.custo_frasco + t.custo_atomizador + t.custo_etiqueta + t.custo_embalagem + t.custo_adicional + t.custo_mao_obra,
      'custo_total', round(t.volume_ml * COALESCE(cm.custo_ml,0) + t.custo_frasco + t.custo_atomizador + t.custo_etiqueta + t.custo_embalagem + t.custo_adicional + t.custo_mao_obra, 2),
      'custo_medio_estoque', s.custo_medio,
      'margem_pct', CASE WHEN s.preco_venda > 0 THEN round((s.preco_venda - (t.volume_ml * COALESCE(cm.custo_ml,0) + t.custo_frasco + t.custo_atomizador + t.custo_etiqueta + t.custo_embalagem + t.custo_adicional + t.custo_mao_obra)) / s.preco_venda * 100, 2) END) x
      FROM public.decant_skus s JOIN public.decant_tamanhos t ON t.id = s.tamanho_id LEFT JOIN cm ON cm.produto_id = s.produto_id WHERE s.ativo) q;
  ELSIF p_tipo = 'movimentacoes' THEN
    v_cols := '[{"k":"data","l":"Data"},{"k":"tipo","l":"Tipo"},{"k":"perfume","l":"Perfume"},{"k":"item","l":"Frasco/SKU"},{"k":"filial","l":"Filial"},{"k":"quantidade","l":"Quantidade"},{"k":"medida","l":"Medida"},{"k":"usuario","l":"Usuário"},{"k":"motivo","l":"Motivo"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') INTO v_lin FROM (
      (SELECT jsonb_build_object('data', l.created_at, 'tipo', l.tipo, 'perfume', public.fn__decant_rotulo(f.produto_id), 'item', f.codigo, 'filial', u.nome,
         'quantidade', l.ml, 'medida', 'ml', 'usuario', l.usuario_nome, 'motivo', l.motivo) x
       FROM public.decant_ml_ledger l JOIN public.decant_frascos f ON f.id = l.frasco_id JOIN public.unidades u ON u.id = l.unidade_id
       WHERE (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver') AND public.fn__decant_dia(l.created_at) BETWEEN p_ini AND p_fim LIMIT 5000)
      UNION ALL
      (SELECT jsonb_build_object('data', m.created_at, 'tipo', m.tipo, 'perfume', public.fn__decant_rotulo(s.produto_id), 'item', s.sku, 'filial', u.nome,
         'quantidade', m.quantidade, 'medida', 'un', 'usuario', m.usuario_nome, 'motivo', m.motivo)
       FROM public.decant_un_ledger m JOIN public.decant_skus s ON s.id = m.sku_id JOIN public.unidades u ON u.id = m.unidade_id
       WHERE (p_unidade IS NULL OR m.unidade_id = p_unidade) AND public.fn__pode(m.unidade_id,'decant.ver') AND public.fn__decant_dia(m.created_at) BETWEEN p_ini AND p_fim LIMIT 5000)) q;
  ELSIF p_tipo = 'divergencias' THEN
    v_cols := '[{"k":"data","l":"Data"},{"k":"tipo","l":"Tipo"},{"k":"item","l":"Item"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"sistema","l":"Sistema"},{"k":"contado","l":"Contado"},{"k":"diferenca","l":"Diferença"},{"k":"status","l":"Status"},{"k":"justificativa","l":"Justificativa"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') INTO v_lin FROM (
      (SELECT jsonb_build_object('data', c.created_at, 'tipo', 'Conferência de frasco (ml)', 'item', f.codigo, 'perfume', public.fn__decant_rotulo(f.produto_id), 'filial', u.nome,
         'sistema', c.saldo_teorico, 'contado', c.saldo_fisico, 'diferenca', c.diferenca, 'status', c.status, 'justificativa', c.justificativa) x
       FROM public.decant_conferencias c JOIN public.decant_frascos f ON f.id = c.frasco_id JOIN public.unidades u ON u.id = c.unidade_id
       WHERE c.diferenca <> 0 AND (p_unidade IS NULL OR c.unidade_id = p_unidade) AND public.fn__pode(c.unidade_id,'decant.ver') AND public.fn__decant_dia(c.created_at) BETWEEN p_ini AND p_fim)
      UNION ALL
      (SELECT jsonb_build_object('data', i.created_at, 'tipo', 'Inventário de decants (un)', 'item', s.sku, 'perfume', public.fn__decant_rotulo(s.produto_id), 'filial', u.nome,
         'sistema', i.saldo_sistema, 'contado', i.contado, 'diferenca', i.diferenca, 'status', i.status, 'justificativa', i.justificativa)
       FROM public.decant_inventarios i JOIN public.decant_skus s ON s.id = i.sku_id JOIN public.unidades u ON u.id = i.unidade_id
       WHERE i.diferenca <> 0 AND (p_unidade IS NULL OR i.unidade_id = p_unidade) AND public.fn__pode(i.unidade_id,'decant.ver') AND public.fn__decant_dia(i.created_at) BETWEEN p_ini AND p_fim)
      UNION ALL
      (SELECT jsonb_build_object('data', l.conferido_em, 'tipo', 'Conferência de produção (un)', 'item', l.codigo, 'perfume', public.fn__decant_rotulo(l.produto_id), 'filial', u.nome,
         'sistema', i.qtd_planejada, 'contado', i.qtd_fisica, 'diferenca', i.diferenca, 'status', i.motivo, 'justificativa', i.justificativa)
       FROM public.decant_lote_itens i JOIN public.decant_lotes l ON l.id = i.lote_id JOIN public.unidades u ON u.id = l.unidade_id
       WHERE i.diferenca <> 0 AND (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver') AND public.fn__decant_dia(l.conferido_em) BETWEEN p_ini AND p_fim)) q;
  ELSIF p_tipo = 'lotes' THEN
    v_cols := '[{"k":"data","l":"Data"},{"k":"lote","l":"Lote"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"status","l":"Status"},{"k":"volume_total_ml","l":"Planejado (ml)"},{"k":"ml_consumido","l":"Consumido (ml)"},{"k":"perdas_ml","l":"Perdas (ml)"},{"k":"custo_total","l":"Custo total","c":1},{"k":"criado_por","l":"Criado por"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data' DESC),'[]') INTO v_lin FROM (SELECT jsonb_build_object('data', public.fn__decant_dia(l.created_at), 'lote', l.codigo,
      'perfume', public.fn__decant_rotulo(l.produto_id), 'filial', u.nome, 'status', l.status, 'volume_total_ml', l.volume_total_ml, 'ml_consumido', l.ml_consumido,
      'perdas_ml', l.perdas_ml, 'custo_total', l.custo_total, 'criado_por', l.criado_por_nome) x
      FROM public.decant_lotes l JOIN public.unidades u ON u.id = l.unidade_id
      WHERE (p_unidade IS NULL OR l.unidade_id = p_unidade) AND public.fn__pode(l.unidade_id,'decant.ver') AND public.fn__decant_dia(l.created_at) BETWEEN p_ini AND p_fim) q;
  ELSIF p_tipo = 'reposicao' THEN
    v_cols := '[{"k":"sku","l":"SKU"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"saldo","l":"Saldo"},{"k":"minimo","l":"Mínimo"},{"k":"ideal","l":"Ideal"},{"k":"sugerido","l":"Produzir (sugestão)"},{"k":"ml_necessario","l":"ml necessários"},{"k":"ml_disponivel","l":"ml disponível na filial"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'perfume'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('sku', s.sku, 'perfume', public.fn__decant_rotulo(s.produto_id), 'filial', u.nome,
      'saldo', COALESCE(e.q,0), 'minimo', su.estoque_minimo, 'ideal', su.estoque_ideal,
      'sugerido', GREATEST(GREATEST(su.estoque_ideal, su.estoque_minimo) - COALESCE(e.q,0), 0),
      'ml_necessario', GREATEST(GREATEST(su.estoque_ideal, su.estoque_minimo) - COALESCE(e.q,0), 0) * t.volume_ml,
      'ml_disponivel', (SELECT COALESCE(sum(GREATEST(public.fn_decant_disponivel_frasco(f.id),0)),0) FROM public.decant_frascos f
                          WHERE f.produto_id = s.produto_id AND f.unidade_id = su.unidade_id AND f.status = 'aberto')) x
      FROM public.decant_sku_unidade su JOIN public.decant_skus s ON s.id = su.sku_id JOIN public.decant_tamanhos t ON t.id = s.tamanho_id
      JOIN public.unidades u ON u.id = su.unidade_id
      LEFT JOIN (SELECT sku_id, unidade_id, sum(quantidade) q FROM public.decant_estoque GROUP BY 1,2) e ON e.sku_id = su.sku_id AND e.unidade_id = su.unidade_id
      WHERE s.ativo AND COALESCE(e.q,0) < su.estoque_minimo AND (p_unidade IS NULL OR su.unidade_id = p_unidade) AND public.fn__pode(su.unidade_id,'decant.ver')) q;
  ELSIF p_tipo = 'sem_venda' THEN
    v_cols := '[{"k":"sku","l":"SKU"},{"k":"perfume","l":"Perfume"},{"k":"filial","l":"Filial"},{"k":"saldo","l":"Saldo"},{"k":"ultima_venda","l":"Última venda"}]';
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'perfume'),'[]') INTO v_lin FROM (SELECT jsonb_build_object('sku', s.sku, 'perfume', public.fn__decant_rotulo(s.produto_id), 'filial', u.nome,
      'saldo', e.q, 'ultima_venda', (SELECT public.fn__decant_dia(max(v.created_at)) FROM public.decant_vendas v WHERE v.sku_id = e.sku_id AND v.unidade_id = e.unidade_id AND v.status <> 'cancelada')) x
      FROM (SELECT sku_id, unidade_id, sum(quantidade) q FROM public.decant_estoque GROUP BY 1,2 HAVING sum(quantidade) > 0) e
      JOIN public.decant_skus s ON s.id = e.sku_id JOIN public.unidades u ON u.id = e.unidade_id
      WHERE (p_unidade IS NULL OR e.unidade_id = p_unidade) AND public.fn__pode(e.unidade_id,'decant.ver')
        AND NOT EXISTS (SELECT 1 FROM public.decant_vendas v WHERE v.sku_id = e.sku_id AND v.unidade_id = e.unidade_id AND v.status <> 'cancelada'
                          AND public.fn__decant_dia(v.created_at) BETWEEN p_ini AND p_fim)) q;
  ELSIF p_tipo IN ('rent_perfume','rent_tamanho','desempenho_filial') THEN
    v_lin := public.fn_decant_rentabilidade(CASE p_tipo WHEN 'rent_perfume' THEN 'perfume' WHEN 'rent_tamanho' THEN 'tamanho' ELSE 'filial' END, p_unidade, p_ini, p_fim)->'linhas';
    v_cols := CASE p_tipo
      WHEN 'rent_perfume' THEN '[{"k":"rotulo","l":"Perfume"},{"k":"custo_frasco","l":"Custo dos frascos","c":1},{"k":"volume_utilizado","l":"Volume utilizado (ml)"},{"k":"volume_restante","l":"Volume restante (ml)"},{"k":"qtd","l":"Decants vendidos"},{"k":"receita","l":"Receita"},{"k":"receita_potencial","l":"Receita potencial"},{"k":"custo_consumido","l":"Custo consumido","c":1},{"k":"lucro_bruto","l":"Lucro bruto","m":1},{"k":"margem_pct","l":"Margem %","m":1}]'
      WHEN 'rent_tamanho' THEN '[{"k":"rotulo","l":"Tamanho"},{"k":"qtd","l":"Vendidos"},{"k":"receita","l":"Receita"},{"k":"custo_consumido","l":"Custo consumido","c":1},{"k":"lucro_bruto","l":"Lucro bruto","m":1},{"k":"margem_pct","l":"Margem %","m":1}]'
      ELSE '[{"k":"rotulo","l":"Filial"},{"k":"qtd","l":"Vendidos"},{"k":"receita","l":"Receita"},{"k":"custo_consumido","l":"Custo consumido","c":1},{"k":"lucro_bruto","l":"Lucro bruto","m":1},{"k":"margem_pct","l":"Margem %","m":1},{"k":"perdas_ml","l":"Perdas (ml)"},{"k":"perdas_valor","l":"Perdas (R$)","c":1}]' END::jsonb;
  ELSE RAISE EXCEPTION 'Relatório inválido';
  END IF;

  FOR v_col IN SELECT * FROM jsonb_array_elements(v_cols) LOOP
    IF (v_col ? 'c' AND NOT v_c) OR (v_col ? 'm' AND NOT v_m) THEN v_rm := v_rm || (v_col->>'k');
    ELSE v_cl := v_cl || jsonb_build_array(v_col); END IF;
  END LOOP;
  IF array_length(v_rm,1) > 0 THEN
    SELECT COALESCE(jsonb_agg(l - v_rm),'[]') INTO v_lin FROM jsonb_array_elements(v_lin) l;
  END IF;
  RETURN jsonb_build_object('colunas', v_cl, 'linhas', COALESCE(v_lin,'[]'::jsonb), 'ver_custos', v_c, 'ver_margem', v_m);
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_decant_dashboard(uuid,date,date), public.fn_decant_rentabilidade(text,uuid,date,date),
  public.fn_decant_perfume_360(uuid,uuid), public.fn_decant_relatorio(text,uuid,date,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_dashboard(uuid,date,date), public.fn_decant_rentabilidade(text,uuid,date,date),
  public.fn_decant_perfume_360(uuid,uuid), public.fn_decant_relatorio(text,uuid,date,date) TO authenticated;