-- FASE 5 — MÓDULO IMPLANTAÇÃO DE UNIDADES (aditivo e idempotente)

-- 1) IMPLANTACOES
CREATE TABLE IF NOT EXISTS public.implantacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  responsavel_id UUID,
  responsavel_nome TEXT NOT NULL DEFAULT '',
  data_prevista_inauguracao DATE,
  data_inauguracao DATE,
  observacoes TEXT NOT NULL DEFAULT '',
  progresso INTEGER NOT NULL DEFAULT 0,
  liberado_por UUID,
  liberado_por_nome TEXT NOT NULL DEFAULT '',
  liberado_em TIMESTAMPTZ,
  criado_por UUID,
  criado_por_nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_implantacoes_unidade ON public.implantacoes(unidade_id);

GRANT SELECT, INSERT, UPDATE ON public.implantacoes TO authenticated;
GRANT ALL ON public.implantacoes TO service_role;
ALTER TABLE public.implantacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "implantacoes_select" ON public.implantacoes;
CREATE POLICY "implantacoes_select" ON public.implantacoes FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id) OR public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS "implantacoes_write" ON public.implantacoes;
CREATE POLICY "implantacoes_write" ON public.implantacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS "implantacoes_update" ON public.implantacoes;
CREATE POLICY "implantacoes_update" ON public.implantacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_implantacoes_updated_at ON public.implantacoes;
CREATE TRIGGER update_implantacoes_updated_at BEFORE UPDATE ON public.implantacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) ETAPAS
CREATE TABLE IF NOT EXISTS public.implantacao_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id UUID NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  chave TEXT NOT NULL,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NAO_INICIADA',
  aplicavel BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT NOT NULL DEFAULT '',
  concluida_por UUID,
  concluida_por_nome TEXT NOT NULL DEFAULT '',
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_impl_etapas_unica ON public.implantacao_etapas(implantacao_id, chave);

GRANT SELECT, INSERT, UPDATE ON public.implantacao_etapas TO authenticated;
GRANT ALL ON public.implantacao_etapas TO service_role;
ALTER TABLE public.implantacao_etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impl_etapas_all" ON public.implantacao_etapas;
CREATE POLICY "impl_etapas_all" ON public.implantacao_etapas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.implantacoes i WHERE i.id = implantacao_id
                  AND (public.usuario_tem_acesso_unidade(i.unidade_id) OR public.has_role(auth.uid(), 'master'))))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_impl_etapas_updated_at ON public.implantacao_etapas;
CREATE TRIGGER update_impl_etapas_updated_at BEFORE UPDATE ON public.implantacao_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) MODELO DE CHECKLIST (configurável)
CREATE TABLE IF NOT EXISTS public.implantacao_checklist_modelo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_chave TEXT NOT NULL,
  item TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_impl_modelo_unico ON public.implantacao_checklist_modelo(etapa_chave, item);
GRANT SELECT ON public.implantacao_checklist_modelo TO authenticated;
GRANT ALL ON public.implantacao_checklist_modelo TO service_role;
ALTER TABLE public.implantacao_checklist_modelo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impl_modelo_select" ON public.implantacao_checklist_modelo;
CREATE POLICY "impl_modelo_select" ON public.implantacao_checklist_modelo FOR SELECT TO authenticated USING (true);

INSERT INTO public.implantacao_checklist_modelo (etapa_chave, item, ordem) VALUES
  ('estrutura','Internet contratada e ativa',1),
  ('estrutura','Rede cabeada',2),
  ('estrutura','Wi-Fi configurado',3),
  ('estrutura','PDV instalado',4),
  ('estrutura','Impressora não fiscal',5),
  ('estrutura','Maquininha de cartão',6),
  ('estrutura','Computador',7),
  ('estrutura','Leitor de código de barras',8),
  ('estrutura','Impressora fiscal',9),
  ('estrutura','Câmeras de segurança',10),
  ('estrutura','Som ambiente',11),
  ('estrutura','Telefone',12),
  ('estrutura','Mobiliário',13),
  ('estrutura','Teste de energia',14)
ON CONFLICT (etapa_chave, item) DO NOTHING;

-- 4) CHECKLIST DA IMPLANTAÇÃO
CREATE TABLE IF NOT EXISTS public.implantacao_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id UUID NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  etapa_chave TEXT NOT NULL DEFAULT 'estrutura',
  item TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  responsavel_id UUID,
  responsavel_nome TEXT NOT NULL DEFAULT '',
  data_prevista DATE,
  data_conclusao DATE,
  observacao TEXT NOT NULL DEFAULT '',
  anexo_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impl_checklist_impl ON public.implantacao_checklist(implantacao_id);
GRANT SELECT, INSERT, UPDATE ON public.implantacao_checklist TO authenticated;
GRANT ALL ON public.implantacao_checklist TO service_role;
ALTER TABLE public.implantacao_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impl_checklist_all" ON public.implantacao_checklist;
CREATE POLICY "impl_checklist_all" ON public.implantacao_checklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.implantacoes i WHERE i.id = implantacao_id
                  AND (public.usuario_tem_acesso_unidade(i.unidade_id) OR public.has_role(auth.uid(), 'master'))))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_impl_checklist_updated_at ON public.implantacao_checklist;
CREATE TRIGGER update_impl_checklist_updated_at BEFORE UPDATE ON public.implantacao_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) PENDÊNCIAS
CREATE TABLE IF NOT EXISTS public.implantacao_pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id UUID NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  criticidade TEXT NOT NULL DEFAULT 'NORMAL',
  origem TEXT NOT NULL DEFAULT 'ETAPA',
  etapa_chave TEXT NOT NULL DEFAULT '',
  responsavel_id UUID,
  responsavel_nome TEXT NOT NULL DEFAULT '',
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'ABERTA',
  resolvido_por UUID,
  resolvido_por_nome TEXT NOT NULL DEFAULT '',
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impl_pend_impl ON public.implantacao_pendencias(implantacao_id);
GRANT SELECT, INSERT, UPDATE ON public.implantacao_pendencias TO authenticated;
GRANT ALL ON public.implantacao_pendencias TO service_role;
ALTER TABLE public.implantacao_pendencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impl_pend_all" ON public.implantacao_pendencias;
CREATE POLICY "impl_pend_all" ON public.implantacao_pendencias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.implantacoes i WHERE i.id = implantacao_id
                  AND (public.usuario_tem_acesso_unidade(i.unidade_id) OR public.has_role(auth.uid(), 'master'))))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_impl_pend_updated_at ON public.implantacao_pendencias;
CREATE TRIGGER update_impl_pend_updated_at BEFORE UPDATE ON public.implantacao_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) EQUIPAMENTOS
CREATE TABLE IF NOT EXISTS public.equipamentos_unidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  implantacao_id UUID REFERENCES public.implantacoes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  numero_serie TEXT NOT NULL DEFAULT '',
  patrimonio TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ATIVO',
  observacao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equip_unidade ON public.equipamentos_unidade(unidade_id);
GRANT SELECT, INSERT, UPDATE ON public.equipamentos_unidade TO authenticated;
GRANT ALL ON public.equipamentos_unidade TO service_role;
ALTER TABLE public.equipamentos_unidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equip_select" ON public.equipamentos_unidade;
CREATE POLICY "equip_select" ON public.equipamentos_unidade FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id) OR public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS "equip_insert" ON public.equipamentos_unidade;
CREATE POLICY "equip_insert" ON public.equipamentos_unidade FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS "equip_update" ON public.equipamentos_unidade;
CREATE POLICY "equip_update" ON public.equipamentos_unidade FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_equip_updated_at ON public.equipamentos_unidade;
CREATE TRIGGER update_equip_updated_at BEFORE UPDATE ON public.equipamentos_unidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) RPC: cria implantação + etapas padrão + checklist a partir do modelo
CREATE OR REPLACE FUNCTION public.fn_implantacao_criar(p_unidade_id uuid, p_responsavel_nome text DEFAULT '', p_data_prevista date DEFAULT NULL, p_observacoes text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_nome text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Somente o master pode iniciar uma implantação.';
  END IF;

  SELECT id INTO v_id FROM public.implantacoes WHERE unidade_id = p_unidade_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.implantacoes (unidade_id, responsavel_id, responsavel_nome, data_prevista_inauguracao, observacoes, criado_por, criado_por_nome)
  VALUES (p_unidade_id, auth.uid(), COALESCE(NULLIF(p_responsavel_nome,''), COALESCE(v_nome,'')), p_data_prevista, COALESCE(p_observacoes,''), auth.uid(), COALESCE(v_nome,''))
  RETURNING id INTO v_id;

  INSERT INTO public.implantacao_etapas (implantacao_id, numero, chave, nome, status)
  VALUES
    (v_id, 1,'cadastro','Cadastro','CONCLUIDA'),
    (v_id, 2,'fiscal','Fiscal','NAO_INICIADA'),
    (v_id, 3,'estrutura','Estrutura','NAO_INICIADA'),
    (v_id, 4,'usuarios','Usuários','NAO_INICIADA'),
    (v_id, 5,'estoque','Estoque Inicial','NAO_INICIADA'),
    (v_id, 6,'caixa','Caixa','NAO_INICIADA'),
    (v_id, 7,'equipamentos','Equipamentos','NAO_INICIADA'),
    (v_id, 8,'testes','Testes','NAO_INICIADA'),
    (v_id, 9,'checklist','Checklist Final','NAO_INICIADA'),
    (v_id,10,'liberacao','Liberação','NAO_INICIADA')
  ON CONFLICT (implantacao_id, chave) DO NOTHING;

  INSERT INTO public.implantacao_checklist (implantacao_id, etapa_chave, item, ordem)
  SELECT v_id, m.etapa_chave, m.item, m.ordem
    FROM public.implantacao_checklist_modelo m
   WHERE m.ativo;

  PERFORM public.fn_audit('UNIDADE_CRIADA','implantacoes', v_id, p_unidade_id, NULL, jsonb_build_object('unidade_id', p_unidade_id));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_criar(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_criar(uuid, text, date, text) TO authenticated;

-- 8) RPC: recalcula progresso
CREATE OR REPLACE FUNCTION public.fn_implantacao_recalcular_progresso(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_total int; v_ok int; v_pct int;
BEGIN
  SELECT count(*) FILTER (WHERE aplicavel), count(*) FILTER (WHERE aplicavel AND status = 'CONCLUIDA')
    INTO v_total, v_ok FROM public.implantacao_etapas WHERE implantacao_id = p_id;
  v_pct := CASE WHEN COALESCE(v_total,0) = 0 THEN 0 ELSE round(v_ok::numeric * 100 / v_total) END;
  UPDATE public.implantacoes SET progresso = v_pct WHERE id = p_id;
  RETURN v_pct;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_implantacao_recalcular_progresso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_implantacao_recalcular_progresso(uuid) TO authenticated;