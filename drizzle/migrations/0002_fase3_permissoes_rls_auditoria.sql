-- ============ FASE 3: catálogo de permissões, acesso por unidade, RLS e auditoria ============

-- 1) Catálogo de permissões
CREATE TABLE IF NOT EXISTS public.permissoes_catalogo (
  chave TEXT PRIMARY KEY,
  modulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissoes_catalogo TO authenticated;
GRANT ALL ON public.permissoes_catalogo TO service_role;
ALTER TABLE public.permissoes_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissoes_catalogo_select ON public.permissoes_catalogo;
CREATE POLICY permissoes_catalogo_select ON public.permissoes_catalogo FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS permissoes_catalogo_master ON public.permissoes_catalogo;
CREATE POLICY permissoes_catalogo_master ON public.permissoes_catalogo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

INSERT INTO public.permissoes_catalogo (chave, modulo, descricao) VALUES
  ('venda.visualizar','venda','Visualizar vendas'),
  ('venda.realizar','venda','Realizar vendas'),
  ('venda.cancelar','venda','Cancelar vendas'),
  ('venda.desconto','venda','Conceder descontos'),
  ('estoque.visualizar','estoque','Visualizar estoque'),
  ('estoque.movimentar','estoque','Movimentar estoque'),
  ('estoque.ajustar','estoque','Ajustar estoque'),
  ('estoque.transferir','estoque','Transferir estoque'),
  ('reposicao.criar','reposicao','Criar reposição'),
  ('reposicao.separar','reposicao','Separar reposição'),
  ('reposicao.enviar','reposicao','Enviar reposição'),
  ('reposicao.receber','reposicao','Receber reposição'),
  ('reposicao.aprovar_divergencia','reposicao','Aprovar divergências'),
  ('caixa.abrir','caixa','Abrir caixa'),
  ('caixa.sangria','caixa','Registrar sangria'),
  ('caixa.suprimento','caixa','Registrar suprimento'),
  ('caixa.fechar','caixa','Fechar caixa'),
  ('fiscal.visualizar','fiscal','Visualizar dados fiscais'),
  ('fiscal.emitir','fiscal','Emitir NFC-e'),
  ('fiscal.cancelar','fiscal','Cancelar NFC-e'),
  ('relatorio.visualizar','relatorio','Visualizar relatórios')
ON CONFLICT (chave) DO NOTHING;

-- 2) Permissões por usuário + unidade
CREATE TABLE IF NOT EXISTS public.usuario_unidade_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  permissao TEXT NOT NULL REFERENCES public.permissoes_catalogo(chave),
  concedido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, unidade_id, permissao)
);
CREATE INDEX IF NOT EXISTS idx_uup_usuario ON public.usuario_unidade_permissoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_uup_unidade ON public.usuario_unidade_permissoes(unidade_id);
GRANT SELECT ON public.usuario_unidade_permissoes TO authenticated;
GRANT ALL ON public.usuario_unidade_permissoes TO service_role;
ALTER TABLE public.usuario_unidade_permissoes ENABLE ROW LEVEL SECURITY;

-- 3) Funções SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_unidade(_unidade_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _unidade_id IS NULL
      OR public.has_role(auth.uid(), 'master')
      OR EXISTS (
        SELECT 1 FROM public.usuario_unidades uu
        WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = _unidade_id AND uu.ativo
      );
$$;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(_unidade_id UUID, _permissao TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'master')
      OR (
        public.usuario_tem_acesso_unidade(_unidade_id)
        AND EXISTS (
          SELECT 1 FROM public.usuario_unidade_permissoes p
          WHERE p.usuario_id = auth.uid()
            AND p.permissao = _permissao
            AND (_unidade_id IS NULL OR p.unidade_id = _unidade_id)
        )
      );
$$;
GRANT EXECUTE ON FUNCTION public.usuario_tem_acesso_unidade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS uup_select ON public.usuario_unidade_permissoes;
CREATE POLICY uup_select ON public.usuario_unidade_permissoes FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS uup_master ON public.usuario_unidade_permissoes;
CREATE POLICY uup_master ON public.usuario_unidade_permissoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 4) Auditoria ampliada
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  usuario_nome TEXT NOT NULL DEFAULT '',
  unidade_id UUID REFERENCES public.unidades(id),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL DEFAULT '',
  entidade_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_unidade ON public.audit_logs(unidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON public.audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.usuario_tem_acesso_unidade(unidade_id));
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_unidade(unidade_id));

CREATE OR REPLACE FUNCTION public.fn_audit(
  p_acao TEXT,
  p_entidade TEXT DEFAULT '',
  p_entidade_id UUID DEFAULT NULL,
  p_unidade_id UUID DEFAULT NULL,
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL,
  p_ip TEXT DEFAULT ''
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_nome TEXT;
BEGIN
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.audit_logs (usuario_id, usuario_nome, unidade_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip)
  VALUES (auth.uid(), COALESCE(v_nome, ''), p_unidade_id, p_acao, COALESCE(p_entidade, ''), p_entidade_id, p_dados_anteriores, p_dados_novos, COALESCE(p_ip, ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_audit(TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT) TO authenticated;

-- 5) Preenchimento automático de unidade_id a partir do texto legado (evita linhas sem unidade)
CREATE OR REPLACE FUNCTION public.trg_set_unidade_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_txt TEXT;
BEGIN
  IF NEW.unidade_id IS NULL THEN
    v_txt := CASE TG_TABLE_NAME
      WHEN 'vendas' THEN NEW.deposito
      WHEN 'caixa_sessoes' THEN NEW.loja
      WHEN 'testers' THEN NEW.deposito
      WHEN 'movimentacoes' THEN COALESCE(NEW.deposito, NEW.deposito_destino, NEW.deposito_origem)
      ELSE NULL END;
    IF v_txt IS NOT NULL THEN
      NEW.unidade_id := public.fn_unidade_por_texto(v_txt);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_unidade_id_vendas ON public.vendas;
CREATE TRIGGER set_unidade_id_vendas BEFORE INSERT ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_unidade_id();
DROP TRIGGER IF EXISTS set_unidade_id_caixa ON public.caixa_sessoes;
CREATE TRIGGER set_unidade_id_caixa BEFORE INSERT ON public.caixa_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_unidade_id();
DROP TRIGGER IF EXISTS set_unidade_id_testers ON public.testers;
CREATE TRIGGER set_unidade_id_testers BEFORE INSERT ON public.testers
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_unidade_id();
DROP TRIGGER IF EXISTS set_unidade_id_mov ON public.movimentacoes;
CREATE TRIGGER set_unidade_id_mov BEFORE INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_unidade_id();

-- 6) Índices por unidade
CREATE INDEX IF NOT EXISTS idx_vendas_unidade ON public.vendas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_mov_unidade ON public.movimentacoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_mov_unidade_origem ON public.movimentacoes(unidade_origem_id);
CREATE INDEX IF NOT EXISTS idx_mov_unidade_destino ON public.movimentacoes(unidade_destino_id);
CREATE INDEX IF NOT EXISTS idx_caixa_unidade ON public.caixa_sessoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_rep_unidade_origem ON public.reposicoes(unidade_origem_id);
CREATE INDEX IF NOT EXISTS idx_rep_unidade_destino ON public.reposicoes(unidade_destino_id);
CREATE INDEX IF NOT EXISTS idx_cfg_fiscais_unidade ON public.configuracoes_fiscais(unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_unidades_unidade ON public.estoque_unidades(unidade_id);

-- 7) RLS por unidade ---------------------------------------------------------

-- unidades: leitura para autenticados (necessária para navegação), gestão master
DROP POLICY IF EXISTS unidades_select ON public.unidades;
DROP POLICY IF EXISTS "Autenticados leem unidades" ON public.unidades;
CREATE POLICY unidades_select ON public.unidades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS unidades_master ON public.unidades;
DROP POLICY IF EXISTS "Masters gerenciam unidades" ON public.unidades;
CREATE POLICY unidades_master ON public.unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- estoque_unidades
DROP POLICY IF EXISTS "Autenticados leem estoque_unidades" ON public.estoque_unidades;
DROP POLICY IF EXISTS estoque_unidades_select ON public.estoque_unidades;
DROP POLICY IF EXISTS "Masters gerenciam estoque_unidades" ON public.estoque_unidades;
CREATE POLICY estoque_unidades_select ON public.estoque_unidades FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));
CREATE POLICY estoque_unidades_master ON public.estoque_unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- vendas
DROP POLICY IF EXISTS "Authenticated can insert vendas" ON public.vendas;
DROP POLICY IF EXISTS "Authenticated can read vendas" ON public.vendas;
DROP POLICY IF EXISTS "Masters can manage vendas" ON public.vendas;
DROP POLICY IF EXISTS "Masters can read all vendas" ON public.vendas;
DROP POLICY IF EXISTS "Vendedores can read own vendas" ON public.vendas;
DROP POLICY IF EXISTS vendas_select ON public.vendas;
DROP POLICY IF EXISTS vendas_insert ON public.vendas;
DROP POLICY IF EXISTS vendas_master ON public.vendas;
CREATE POLICY vendas_select ON public.vendas FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));
CREATE POLICY vendas_insert ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_unidade(unidade_id));
CREATE POLICY vendas_master ON public.vendas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- movimentacoes
DROP POLICY IF EXISTS "Authenticated can insert movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Masters can do all on movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Masters can read all movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Vendedores can read own movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS movimentacoes_select ON public.movimentacoes;
DROP POLICY IF EXISTS movimentacoes_insert ON public.movimentacoes;
DROP POLICY IF EXISTS movimentacoes_master ON public.movimentacoes;
CREATE POLICY movimentacoes_select ON public.movimentacoes FOR SELECT TO authenticated
  USING (
    public.usuario_tem_acesso_unidade(unidade_id)
    OR public.usuario_tem_acesso_unidade(unidade_origem_id)
    OR public.usuario_tem_acesso_unidade(unidade_destino_id)
  );
CREATE POLICY movimentacoes_insert ON public.movimentacoes FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_tem_acesso_unidade(unidade_id)
    OR public.usuario_tem_acesso_unidade(unidade_origem_id)
    OR public.usuario_tem_acesso_unidade(unidade_destino_id)
  );
CREATE POLICY movimentacoes_master ON public.movimentacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- reposicoes
DROP POLICY IF EXISTS "Authenticated can read reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS "Authenticated can insert reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS "Authenticated can update reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS "Masters can manage reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS reposicoes_select ON public.reposicoes;
DROP POLICY IF EXISTS reposicoes_insert ON public.reposicoes;
DROP POLICY IF EXISTS reposicoes_update ON public.reposicoes;
DROP POLICY IF EXISTS reposicoes_master ON public.reposicoes;
CREATE POLICY reposicoes_select ON public.reposicoes FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id));
CREATE POLICY reposicoes_insert ON public.reposicoes FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id));
CREATE POLICY reposicoes_update ON public.reposicoes FOR UPDATE TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_origem_id) OR public.usuario_tem_acesso_unidade(unidade_destino_id));
CREATE POLICY reposicoes_master ON public.reposicoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- caixa_sessoes
DROP POLICY IF EXISTS "Authenticated can insert caixa_sessoes" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Authenticated can read caixa_sessoes" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Authenticated can update own caixa" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Masters can manage caixa_sessoes" ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_select ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_insert ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_update ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_master ON public.caixa_sessoes;
CREATE POLICY caixa_sessoes_select ON public.caixa_sessoes FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));
CREATE POLICY caixa_sessoes_insert ON public.caixa_sessoes FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_unidade(unidade_id));
CREATE POLICY caixa_sessoes_update ON public.caixa_sessoes FOR UPDATE TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));
CREATE POLICY caixa_sessoes_master ON public.caixa_sessoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- caixa_movimentacoes: segue a sessão
DROP POLICY IF EXISTS "Authenticated can read caixa_movimentacoes" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Authenticated can insert caixa_movimentacoes" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_mov_select ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_mov_insert ON public.caixa_movimentacoes;
CREATE POLICY caixa_mov_select ON public.caixa_movimentacoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.caixa_sessoes s WHERE s.id = sessao_id AND public.usuario_tem_acesso_unidade(s.unidade_id)));
CREATE POLICY caixa_mov_insert ON public.caixa_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.caixa_sessoes s WHERE s.id = sessao_id AND public.usuario_tem_acesso_unidade(s.unidade_id)));

-- configuracoes_fiscais: dado sensível (CSC/senha) — somente master
DROP POLICY IF EXISTS "Authenticated can read configuracoes_fiscais" ON public.configuracoes_fiscais;
DROP POLICY IF EXISTS configuracoes_fiscais_select ON public.configuracoes_fiscais;
DROP POLICY IF EXISTS configuracoes_fiscais_master ON public.configuracoes_fiscais;
CREATE POLICY configuracoes_fiscais_master ON public.configuracoes_fiscais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- testers e alertas por unidade
DROP POLICY IF EXISTS "Authenticated can read testers" ON public.testers;
DROP POLICY IF EXISTS testers_select ON public.testers;
CREATE POLICY testers_select ON public.testers FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));
DROP POLICY IF EXISTS "Authenticated can read alertas_estoque" ON public.alertas_estoque;
DROP POLICY IF EXISTS alertas_estoque_select ON public.alertas_estoque;
CREATE POLICY alertas_estoque_select ON public.alertas_estoque FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_unidade(unidade_id));

-- usuario_unidades: usuário vê os próprios vínculos, master gerencia
DROP POLICY IF EXISTS "Autenticados leem usuario_unidades" ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_select ON public.usuario_unidades;
DROP POLICY IF EXISTS usuario_unidades_master ON public.usuario_unidades;
DROP POLICY IF EXISTS "Masters gerenciam usuario_unidades" ON public.usuario_unidades;
CREATE POLICY usuario_unidades_select ON public.usuario_unidades FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'master'));
CREATE POLICY usuario_unidades_master ON public.usuario_unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));
