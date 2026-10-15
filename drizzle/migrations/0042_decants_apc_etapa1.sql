ALTER TABLE public.decant_frascos ADD COLUMN IF NOT EXISTS ml_decants numeric(10,3), ADD COLUMN IF NOT EXISTS dividido_em timestamptz;

ALTER TABLE public.decant_ml_ledger DROP CONSTRAINT IF EXISTS decant_ml_ledger_tipo_check;
ALTER TABLE public.decant_ml_ledger ADD CONSTRAINT decant_ml_ledger_tipo_check CHECK (tipo = ANY (ARRAY['abertura','producao','tester','uso_interno','vazamento','perda','amostra','ajuste','descarte','reserva_apc','liberacao_apc','venda_sob_demanda']));

CREATE TABLE IF NOT EXISTS public.decant_apc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frasco_id uuid NOT NULL UNIQUE REFERENCES public.decant_frascos(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  produto_id uuid NOT NULL,
  ml_reservado numeric(10,3) NOT NULL CHECK (ml_reservado > 0),
  preco numeric(12,2) NOT NULL CHECK (preco > 0),
  condicao text NOT NULL DEFAULT '',
  tem_tampa boolean NOT NULL DEFAULT true,
  tem_caixa boolean NOT NULL DEFAULT false,
  observacao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado','em_preparacao','disponivel','vendido','cancelado')),
  venda_id uuid,
  criado_por uuid, criado_por_nome text NOT NULL DEFAULT '',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.decant_apc_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apc_id uuid NOT NULL REFERENCES public.decant_apc(id),
  tipo text NOT NULL, antes jsonb, depois jsonb, justificativa text NOT NULL DEFAULT '',
  usuario_id uuid, usuario_nome text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decant_apc, public.decant_apc_eventos TO authenticated;
GRANT ALL ON public.decant_apc, public.decant_apc_eventos TO service_role;
ALTER TABLE public.decant_apc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decant_apc_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apc leitura por filial" ON public.decant_apc;
CREATE POLICY "apc leitura por filial" ON public.decant_apc FOR SELECT TO authenticated USING (public.fn__pode(unidade_id,'decant.ver'));
DROP POLICY IF EXISTS "apc eventos leitura" ON public.decant_apc_eventos;
CREATE POLICY "apc eventos leitura" ON public.decant_apc_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decant_apc a WHERE a.id = apc_id AND public.fn__pode(a.unidade_id,'decant.ver')));

-- reserva/liberação de APC não é perda
CREATE OR REPLACE FUNCTION public.fn__decant_perda_ml() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f public.decant_frascos; v_tipo text;
BEGIN
  IF NEW.ml >= 0 OR NEW.tipo IN ('producao','abertura','reserva_apc','liberacao_apc','venda_sob_demanda') THEN RETURN NEW; END IF;
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = NEW.frasco_id;
  v_tipo := COALESCE(NULLIF(current_setting('decant.tipo_perda', true),''), public.fn__decant_perda_tipo_ml(NEW.tipo, NEW.referencia_tipo));
  INSERT INTO public.decant_perdas (chave, origem, tipo, produto_id, frasco_id, unidade_id, ml, custo_ml, valor, justificativa, usuario_id, usuario_nome, created_at)
  VALUES ('ml:'||NEW.id, 'frasco', v_tipo, v_f.produto_id, NEW.frasco_id, NEW.unidade_id, -NEW.ml, v_f.custo_ml,
    round(-NEW.ml * v_f.custo_ml, 2), NEW.motivo, NEW.usuario_id, NEW.usuario_nome, NEW.created_at)
  ON CONFLICT (chave) DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_dividir_frasco(p_frasco_id uuid, p_ml_decants numeric, p_ml_apc numeric,
  p_preco_5 numeric, p_preco_8 numeric, p_preco_10 numeric, p_preco_apc numeric,
  p_condicao text, p_tampa boolean, p_caixa boolean, p_observacao text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f public.decant_frascos; v_p public.perfumes; v_saldo numeric; v_res numeric; v_disp numeric; v_apc uuid;
  v_user text := public.fn__nome_usuario(); v_vol numeric; v_preco numeric; v_tam uuid; v_sku uuid; v_cad boolean;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_apc FROM public.decant_frascos WHERE id = p_frasco_id AND dividido_em IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.decant_apc_eventos e JOIN public.decant_apc a ON a.id=e.apc_id WHERE a.frasco_id=p_frasco_id AND e.depois->>'chave' = p_idempotency_key);
    IF FOUND THEN RETURN jsonb_build_object('repetido', true); END IF;
  END IF;
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = p_frasco_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Frasco não encontrado'; END IF;
  PERFORM public.fn__decant_exigir(v_f.unidade_id,'decant.abrir');
  IF v_f.dividido_em IS NOT NULL THEN RAISE EXCEPTION 'Este frasco já foi dividido em %', to_char(v_f.dividido_em AT TIME ZONE 'America/Manaus','DD/MM/YYYY HH24:MI'); END IF;
  IF p_ml_decants IS NULL OR p_ml_decants < 0 OR COALESCE(p_ml_apc,0) < 0 THEN RAISE EXCEPTION 'Volumes não podem ser negativos'; END IF;
  v_saldo := public.fn_decant_saldo_frasco(v_f.id);
  v_res := COALESCE(public.fn_decant_reservado_frasco(v_f.id, NULL),0);
  v_disp := v_saldo - v_res;
  IF round(p_ml_decants + COALESCE(p_ml_apc,0),3) <> round(v_disp,3) THEN
    RAISE EXCEPTION 'Decants + APC devem somar exatamente o saldo real do frasco (% ml)', v_disp; END IF;
  IF COALESCE(p_ml_apc,0) > 0 AND COALESCE(p_preco_apc,0) <= 0 THEN RAISE EXCEPTION 'Informe o preço total do APC'; END IF;
  IF COALESCE(p_preco_5,0) < 0 OR COALESCE(p_preco_8,0) < 0 OR COALESCE(p_preco_10,0) < 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;
  SELECT * INTO v_p FROM public.perfumes WHERE id = v_f.produto_id;

  UPDATE public.decant_frascos SET ml_decants = p_ml_decants, dividido_em = now(), updated_at = now() WHERE id = v_f.id;

  INSERT INTO public.decant_perfume_config (produto_id, elegivel, ativo, atualizado_por)
  VALUES (v_p.id, true, true, auth.uid())
  ON CONFLICT (produto_id) DO UPDATE SET elegivel = true, ativo = true, updated_at = now();

  v_cad := public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'decant.cadastrar');
  FOREACH v_vol IN ARRAY ARRAY[5,8,10]::numeric[] LOOP
    v_preco := CASE v_vol WHEN 5 THEN p_preco_5 WHEN 8 THEN p_preco_8 ELSE p_preco_10 END;
    IF v_preco IS NULL OR v_preco = 0 THEN CONTINUE; END IF;
    IF NOT v_cad THEN RAISE EXCEPTION 'Sem permissão para definir preços de decant'; END IF;
    SELECT id INTO v_tam FROM public.decant_tamanhos WHERE volume_ml = v_vol ORDER BY ativo DESC, created_at LIMIT 1;
    IF v_tam IS NULL THEN
      INSERT INTO public.decant_tamanhos (nome, volume_ml) VALUES (v_vol::int || ' ml', v_vol) RETURNING id INTO v_tam;
    ELSE UPDATE public.decant_tamanhos SET ativo = true WHERE id = v_tam AND NOT ativo; END IF;
    SELECT id INTO v_sku FROM public.decant_skus WHERE produto_id = v_p.id AND tamanho_id = v_tam FOR UPDATE;
    IF v_sku IS NULL THEN
      INSERT INTO public.decant_skus (produto_id, tamanho_id, sku, preco_venda, ativo)
      VALUES (v_p.id, v_tam, public.fn_decant_sku_codigo(v_p.codigo, v_vol), v_preco, true);
    ELSE UPDATE public.decant_skus SET preco_venda = v_preco, ativo = true, updated_at = now() WHERE id = v_sku; END IF;
    v_tam := NULL; v_sku := NULL;
  END LOOP;

  IF COALESCE(p_ml_apc,0) > 0 THEN
    INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, referencia_tipo, usuario_id, usuario_nome, idempotency_key)
    VALUES (v_f.id, v_f.unidade_id, 'reserva_apc', -p_ml_apc, v_saldo - p_ml_apc, 'Reserva para APC', 'apc', auth.uid(), v_user,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE 'apc:'||p_idempotency_key END);
    INSERT INTO public.decant_apc (frasco_id, unidade_id, produto_id, ml_reservado, preco, condicao, tem_tampa, tem_caixa, observacao,
      status, criado_por, criado_por_nome, idempotency_key)
    VALUES (v_f.id, v_f.unidade_id, v_p.id, p_ml_apc, p_preco_apc, COALESCE(p_condicao,''), COALESCE(p_tampa,true), COALESCE(p_caixa,false),
      COALESCE(p_observacao,''), CASE WHEN p_ml_decants = 0 THEN 'disponivel' ELSE 'reservado' END, auth.uid(), v_user, p_idempotency_key)
    RETURNING id INTO v_apc;
    INSERT INTO public.decant_apc_eventos (apc_id, tipo, depois, usuario_id, usuario_nome)
    VALUES (v_apc, 'criado', jsonb_build_object('ml', p_ml_apc, 'preco', p_preco_apc, 'chave', p_idempotency_key), auth.uid(), v_user);
  END IF;

  PERFORM public.fn_audit('decant_dividir_frasco','decant_frascos',v_f.id,v_f.unidade_id,
    jsonb_build_object('saldo', v_disp),
    jsonb_build_object('ml_decants',p_ml_decants,'ml_apc',COALESCE(p_ml_apc,0),'preco_5',p_preco_5,'preco_8',p_preco_8,'preco_10',p_preco_10,'preco_apc',p_preco_apc),'');
  RETURN jsonb_build_object('frasco_id', v_f.id, 'apc_id', v_apc, 'ml_decants', p_ml_decants, 'ml_apc', COALESCE(p_ml_apc,0), 'repetido', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_apc_status(p_apc_id uuid, p_status text, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_a public.decant_apc; v_f public.decant_frascos; v_granel numeric; v_user text := public.fn__nome_usuario();
BEGIN
  SELECT * INTO v_a FROM public.decant_apc WHERE id = p_apc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APC não encontrado'; END IF;
  SELECT * INTO v_f FROM public.decant_frascos WHERE id = v_a.frasco_id FOR UPDATE;
  IF v_a.status IN ('vendido','cancelado') THEN RAISE EXCEPTION 'APC já está %', v_a.status; END IF;
  IF p_status NOT IN ('reservado','em_preparacao','disponivel','cancelado') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
  IF p_status = 'cancelado' THEN
    PERFORM public.fn__decant_exigir(v_a.unidade_id,'decant.configurar');
    IF length(trim(COALESCE(p_justificativa,''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa (mínimo 5 letras)'; END IF;
    v_granel := public.fn_decant_saldo_frasco(v_f.id);
    INSERT INTO public.decant_ml_ledger (frasco_id, unidade_id, tipo, ml, saldo_apos, motivo, referencia_tipo, referencia_id, usuario_id, usuario_nome)
    VALUES (v_f.id, v_a.unidade_id, 'liberacao_apc', v_a.ml_reservado, v_granel + v_a.ml_reservado, 'APC cancelado: '||p_justificativa, 'apc', v_a.id, auth.uid(), v_user);
    UPDATE public.decant_frascos SET ml_decants = COALESCE(ml_decants,0) + v_a.ml_reservado WHERE id = v_f.id;
  ELSE
    PERFORM public.fn__decant_exigir(v_a.unidade_id,'decant.abrir');
    IF p_status = 'disponivel' THEN
      v_granel := public.fn_decant_saldo_frasco(v_f.id);
      IF v_granel > 0 THEN RAISE EXCEPTION 'Ainda há % ml de decants dentro do frasco. Envase ou registre esse líquido antes de liberar o APC.', v_granel; END IF;
    END IF;
  END IF;
  UPDATE public.decant_apc SET status = p_status, updated_at = now() WHERE id = v_a.id;
  INSERT INTO public.decant_apc_eventos (apc_id, tipo, antes, depois, justificativa, usuario_id, usuario_nome)
  VALUES (v_a.id, 'status', jsonb_build_object('status', v_a.status), jsonb_build_object('status', p_status), COALESCE(p_justificativa,''), auth.uid(), v_user);
  RETURN jsonb_build_object('id', v_a.id, 'status', p_status);
END $$;

CREATE OR REPLACE FUNCTION public.fn_decant_apc_listar(p_unidade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
    SELECT a.*, f.codigo AS frasco_codigo, f.volume_nominal_ml, f.ml_decants, p.marca, p.nome, p.concentracao,
      u.nome_exibicao AS unidade_nome, public.fn_decant_saldo_frasco(f.id) AS granel_ml
    FROM public.decant_apc a JOIN public.decant_frascos f ON f.id=a.frasco_id JOIN public.perfumes p ON p.id=a.produto_id
    JOIN public.unidades u ON u.id=a.unidade_id
    WHERE (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id) AND public.fn__pode(a.unidade_id,'decant.ver')) x
$$;

REVOKE ALL ON FUNCTION public.fn_decant_dividir_frasco(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,boolean,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_decant_apc_status(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_decant_apc_listar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_decant_dividir_frasco(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,boolean,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decant_apc_status(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decant_apc_listar(uuid) TO authenticated;