-- Permissões por cargo
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem permissoes" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master gerencia permissoes" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'master') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  )
$$;

INSERT INTO public.role_permissions (role, permission) VALUES
  ('vendedor','reposicao_visualizar'),
  ('vendedor','reposicao_criar'),
  ('vendedor','reposicao_receber'),
  ('vendedor','reposicao_conferir'),
  ('vendedor','reposicao_visualizar_historico')
ON CONFLICT DO NOTHING;

-- Substitui estrutura antiga
DROP TABLE IF EXISTS public.reposicoes CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.reposicao_codigo_seq;

CREATE TABLE public.reposicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT ('REP-' || lpad(nextval('public.reposicao_codigo_seq')::text, 6, '0')),
  origem text NOT NULL,
  destino text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  observacoes text NOT NULL DEFAULT '',
  criado_por uuid,
  criado_por_nome text NOT NULL DEFAULT '',
  separado_por uuid,
  separado_por_nome text,
  separado_em timestamptz,
  enviado_por uuid,
  enviado_por_nome text,
  enviado_em timestamptz,
  recebido_por uuid,
  recebido_por_nome text,
  recebido_em timestamptz,
  finalizado_por uuid,
  finalizado_por_nome text,
  finalizado_em timestamptz,
  cancelado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reposicoes_origem_destino_diff CHECK (origem <> destino)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reposicoes TO authenticated;
GRANT ALL ON public.reposicoes TO service_role;
ALTER TABLE public.reposicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver reposicoes" ON public.reposicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criar reposicoes" ON public.reposicoes FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'reposicao_criar'));
CREATE POLICY "Atualizar reposicoes" ON public.reposicoes FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'reposicao_editar')
      OR public.has_permission(auth.uid(), 'reposicao_separar')
      OR public.has_permission(auth.uid(), 'reposicao_enviar')
      OR public.has_permission(auth.uid(), 'reposicao_receber')
      OR public.has_permission(auth.uid(), 'reposicao_conferir')
      OR public.has_permission(auth.uid(), 'reposicao_finalizar'));
CREATE POLICY "Excluir rascunho" ON public.reposicoes FOR DELETE TO authenticated
  USING (status = 'rascunho' AND public.has_permission(auth.uid(), 'reposicao_cancelar'));
CREATE TRIGGER update_reposicoes_updated_at BEFORE UPDATE ON public.reposicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reposicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reposicao_id uuid NOT NULL REFERENCES public.reposicoes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  produto_nome text NOT NULL,
  categoria text NOT NULL DEFAULT '',
  quantidade_solicitada integer NOT NULL DEFAULT 0,
  quantidade_separada integer,
  quantidade_enviada integer,
  quantidade_recebida integer,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reposicao_id, produto_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reposicao_itens TO authenticated;
GRANT ALL ON public.reposicao_itens TO service_role;
ALTER TABLE public.reposicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver itens" ON public.reposicao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciar itens" ON public.reposicao_itens FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'reposicao_criar')
      OR public.has_permission(auth.uid(), 'reposicao_editar')
      OR public.has_permission(auth.uid(), 'reposicao_separar')
      OR public.has_permission(auth.uid(), 'reposicao_conferir'))
  WITH CHECK (public.has_permission(auth.uid(), 'reposicao_criar')
      OR public.has_permission(auth.uid(), 'reposicao_editar')
      OR public.has_permission(auth.uid(), 'reposicao_separar')
      OR public.has_permission(auth.uid(), 'reposicao_conferir'));
CREATE TRIGGER update_reposicao_itens_updated_at BEFORE UPDATE ON public.reposicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reposicao_conferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reposicao_id uuid NOT NULL REFERENCES public.reposicoes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.perfumes(id),
  produto_nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reposicao_id, produto_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reposicao_conferencias TO authenticated;
GRANT ALL ON public.reposicao_conferencias TO service_role;
ALTER TABLE public.reposicao_conferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver conferencias" ON public.reposicao_conferencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciar conferencias" ON public.reposicao_conferencias FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'reposicao_conferir'))
  WITH CHECK (public.has_permission(auth.uid(), 'reposicao_conferir'));

CREATE TABLE public.reposicao_divergencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reposicao_id uuid NOT NULL REFERENCES public.reposicoes(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.perfumes(id),
  produto_nome text NOT NULL DEFAULT '',
  tipo text NOT NULL,
  quantidade_esperada integer NOT NULL DEFAULT 0,
  quantidade_recebida integer NOT NULL DEFAULT 0,
  justificativa text NOT NULL DEFAULT '',
  foto_url text,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  aprovado_por uuid,
  aprovado_por_nome text,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reposicao_divergencias TO authenticated;
GRANT ALL ON public.reposicao_divergencias TO service_role;
ALTER TABLE public.reposicao_divergencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver divergencias" ON public.reposicao_divergencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Registrar divergencias" ON public.reposicao_divergencias FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'reposicao_conferir'));
CREATE POLICY "Aprovar divergencias" ON public.reposicao_divergencias FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'reposicao_aprovar_divergencia'))
  WITH CHECK (public.has_permission(auth.uid(), 'reposicao_aprovar_divergencia'));

CREATE TABLE public.reposicao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reposicao_id uuid NOT NULL REFERENCES public.reposicoes(id) ON DELETE CASCADE,
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  acao text NOT NULL,
  detalhes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reposicao_historico TO authenticated;
GRANT ALL ON public.reposicao_historico TO service_role;
ALTER TABLE public.reposicao_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver historico" ON public.reposicao_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Registrar historico" ON public.reposicao_historico FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_reposicao_itens_reposicao ON public.reposicao_itens(reposicao_id);
CREATE INDEX idx_reposicao_conf_reposicao ON public.reposicao_conferencias(reposicao_id);
CREATE INDEX idx_reposicao_div_reposicao ON public.reposicao_divergencias(reposicao_id);
CREATE INDEX idx_reposicao_hist_reposicao ON public.reposicao_historico(reposicao_id);