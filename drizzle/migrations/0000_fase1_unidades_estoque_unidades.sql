-- ============================================================
-- FASE 1 — Estrutura multi-unidade (aditiva e idempotente)
-- Nenhuma coluna legada é removida. Nenhum saldo é alterado.
-- ============================================================

-- 1. UNIDADES ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  codigo_legado text UNIQUE,
  nome text NOT NULL,
  nome_exibicao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'LOJA',
  cnpj text NOT NULL DEFAULT '',
  inscricao_estadual text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  logradouro text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  complemento text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  responsavel_id uuid,
  status text NOT NULL DEFAULT 'EM_IMPLANTACAO',
  data_prevista_inauguracao date,
  data_inauguracao date,
  inativada_em timestamptz,
  motivo_inativacao text NOT NULL DEFAULT '',
  permite_venda boolean NOT NULL DEFAULT true,
  permite_estoque boolean NOT NULL DEFAULT true,
  permite_transferencia boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unidades_tipo_check CHECK (tipo IN ('LOJA','ESTOQUE','ESTOQUE_CENTRAL','SHOWROOM','QUIOSQUE','ECOMMERCE','OUTRO')),
  CONSTRAINT unidades_status_check CHECK (status IN ('EM_IMPLANTACAO','EM_CONFIGURACAO','EM_TESTE','OPERACIONAL','INATIVA'))
);

GRANT SELECT ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem unidades" ON public.unidades;
CREATE POLICY "Autenticados leem unidades" ON public.unidades
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Masters gerenciam unidades" ON public.unidades;
CREATE POLICY "Masters gerenciam unidades" ON public.unidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_unidades_updated_at ON public.unidades;
CREATE TRIGGER update_unidades_updated_at BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. SEED ----------------------------------------------------
INSERT INTO public.unidades (codigo, codigo_legado, nome, nome_exibicao, tipo, status, permite_venda, permite_estoque, permite_transferencia, ordem)
VALUES
  ('CASA',     'Casa',     'Casa',     'Casa',     'LOJA', 'OPERACIONAL', true,  true,  true,  1),
  ('SUMAUMA',  'Sumaúma',  'Sumaúma',  'Sumaúma',  'LOJA', 'OPERACIONAL', true,  true,  true,  2),
  ('AMAZONAS', 'Amazonas', 'Amazonas', 'Amazonas', 'LOJA', 'INATIVA',     false, false, false, 3)
ON CONFLICT (codigo) DO NOTHING;

UPDATE public.unidades
   SET inativada_em = COALESCE(inativada_em, now()),
       motivo_inativacao = CASE WHEN motivo_inativacao = '' THEN 'Unidade desativada; histórico preservado.' ELSE motivo_inativacao END
 WHERE codigo = 'AMAZONAS' AND status = 'INATIVA';

-- 3. ESTOQUE_UNIDADES ----------------------------------------
CREATE TABLE IF NOT EXISTS public.estoque_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 0,
  quantidade_reservada integer NOT NULL DEFAULT 0,
  estoque_minimo integer NOT NULL DEFAULT 0,
  estoque_maximo integer,
  data_ultima_entrada timestamptz,
  data_ultima_saida timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estoque_unidades_unq UNIQUE (produto_id, unidade_id),
  CONSTRAINT estoque_unidades_qtd_check CHECK (quantidade >= 0),
  CONSTRAINT estoque_unidades_res_check CHECK (quantidade_reservada >= 0),
  CONSTRAINT estoque_unidades_res_le_qtd CHECK (quantidade_reservada <= quantidade)
);

CREATE INDEX IF NOT EXISTS idx_estoque_unidades_unidade ON public.estoque_unidades (unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_unidades_produto ON public.estoque_unidades (produto_id);

GRANT SELECT ON public.estoque_unidades TO authenticated;
GRANT ALL ON public.estoque_unidades TO service_role;
ALTER TABLE public.estoque_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem estoque_unidades" ON public.estoque_unidades;
CREATE POLICY "Autenticados leem estoque_unidades" ON public.estoque_unidades
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Masters gerenciam estoque_unidades" ON public.estoque_unidades;
CREATE POLICY "Masters gerenciam estoque_unidades" ON public.estoque_unidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP TRIGGER IF EXISTS update_estoque_unidades_updated_at ON public.estoque_unidades;
CREATE TRIGGER update_estoque_unidades_updated_at BEFORE UPDATE ON public.estoque_unidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. BACKFILL DE SALDOS (idempotente) -------------------------
INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, estoque_minimo)
SELECT p.id, u.id, GREATEST(p.estoque_casa, 0), COALESCE(p.estoque_minimo, 0)
  FROM public.perfumes p CROSS JOIN public.unidades u WHERE u.codigo = 'CASA'
ON CONFLICT (produto_id, unidade_id) DO NOTHING;

INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, estoque_minimo)
SELECT p.id, u.id, GREATEST(p.estoque_sumauma, 0), COALESCE(p.estoque_minimo, 0)
  FROM public.perfumes p CROSS JOIN public.unidades u WHERE u.codigo = 'SUMAUMA'
ON CONFLICT (produto_id, unidade_id) DO NOTHING;

INSERT INTO public.estoque_unidades (produto_id, unidade_id, quantidade, estoque_minimo)
SELECT p.id, u.id, GREATEST(p.estoque_amazonas, 0), COALESCE(p.estoque_minimo, 0)
  FROM public.perfumes p CROSS JOIN public.unidades u WHERE u.codigo = 'AMAZONAS'
ON CONFLICT (produto_id, unidade_id) DO NOTHING;

-- 5. USUARIO_UNIDADES ----------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  perfil_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_unidades_unq UNIQUE (usuario_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_unidades_usuario ON public.usuario_unidades (usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_unidades_unidade ON public.usuario_unidades (unidade_id);

GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT ALL ON public.usuario_unidades TO service_role;
ALTER TABLE public.usuario_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le seus vinculos" ON public.usuario_unidades;
CREATE POLICY "Usuario le seus vinculos" ON public.usuario_unidades
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS "Masters gerenciam vinculos" ON public.usuario_unidades;
CREATE POLICY "Masters gerenciam vinculos" ON public.usuario_unidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Função de apoio para RLS por unidade (uso nas próximas fases)
CREATE OR REPLACE FUNCTION public.user_tem_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'master') OR EXISTS (
    SELECT 1 FROM public.usuario_unidades
     WHERE usuario_id = _user_id AND unidade_id = _unidade_id AND ativo
  )
$$;

-- Backfill: master = todas as unidades; demais = unidade do profiles.loja
INSERT INTO public.usuario_unidades (usuario_id, unidade_id, ativo)
SELECT ur.user_id, u.id, (u.status <> 'INATIVA')
  FROM public.user_roles ur CROSS JOIN public.unidades u
 WHERE ur.role = 'master'
ON CONFLICT (usuario_id, unidade_id) DO NOTHING;

INSERT INTO public.usuario_unidades (usuario_id, unidade_id, ativo)
SELECT pr.user_id, u.id, true
  FROM public.profiles pr
  JOIN public.unidades u
    ON lower(btrim(u.codigo_legado)) = lower(btrim(pr.loja))
 WHERE btrim(coalesce(pr.loja,'')) <> ''
ON CONFLICT (usuario_id, unidade_id) DO NOTHING;

-- 6. unidade_id NULLABLE NAS TABELAS OPERACIONAIS --------------
ALTER TABLE public.vendas              ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.movimentacoes       ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.movimentacoes       ADD COLUMN IF NOT EXISTS unidade_origem_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.movimentacoes       ADD COLUMN IF NOT EXISTS unidade_destino_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.reposicoes          ADD COLUMN IF NOT EXISTS unidade_origem_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.reposicoes          ADD COLUMN IF NOT EXISTS unidade_destino_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.caixa_sessoes       ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.nfce_emissoes       ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.notas_fiscais       ADD COLUMN IF NOT EXISTS unidade_destino_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.testers             ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.alertas_estoque     ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.ajuste_auditoria    ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);
ALTER TABLE public.profiles            ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);

CREATE INDEX IF NOT EXISTS idx_vendas_unidade ON public.vendas (unidade_id);
CREATE INDEX IF NOT EXISTS idx_mov_unidade ON public.movimentacoes (unidade_id);
CREATE INDEX IF NOT EXISTS idx_caixa_unidade ON public.caixa_sessoes (unidade_id);

-- Backfill via codigo_legado (case/trim tolerante)
UPDATE public.vendas v SET unidade_id = u.id
  FROM public.unidades u WHERE v.unidade_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(v.deposito));

UPDATE public.movimentacoes m SET unidade_id = u.id
  FROM public.unidades u WHERE m.unidade_id IS NULL AND m.deposito IS NOT NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(m.deposito));
UPDATE public.movimentacoes m SET unidade_origem_id = u.id
  FROM public.unidades u WHERE m.unidade_origem_id IS NULL AND m.deposito_origem IS NOT NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(m.deposito_origem));
UPDATE public.movimentacoes m SET unidade_destino_id = u.id
  FROM public.unidades u WHERE m.unidade_destino_id IS NULL AND m.deposito_destino IS NOT NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(m.deposito_destino));

UPDATE public.reposicoes r SET unidade_origem_id = u.id
  FROM public.unidades u WHERE r.unidade_origem_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(r.origem));
UPDATE public.reposicoes r SET unidade_destino_id = u.id
  FROM public.unidades u WHERE r.unidade_destino_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(r.destino));

UPDATE public.caixa_sessoes c SET unidade_id = u.id
  FROM public.unidades u WHERE c.unidade_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(c.loja));

UPDATE public.testers t SET unidade_id = u.id
  FROM public.unidades u WHERE t.unidade_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(t.deposito));

UPDATE public.alertas_estoque a SET unidade_id = u.id
  FROM public.unidades u WHERE a.unidade_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(a.loja));

UPDATE public.notas_fiscais nf SET unidade_destino_id = u.id
  FROM public.unidades u WHERE nf.unidade_destino_id IS NULL AND nf.deposito_destino IS NOT NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(nf.deposito_destino));

UPDATE public.ajuste_auditoria aa SET unidade_id = u.id
  FROM public.unidades u WHERE aa.unidade_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(aa.deposito));

UPDATE public.profiles pr SET unidade_id = u.id
  FROM public.unidades u WHERE pr.unidade_id IS NULL AND lower(btrim(u.codigo_legado)) = lower(btrim(pr.loja));

-- 7. VIEW DE COMPATIBILIDADE ----------------------------------
CREATE OR REPLACE VIEW public.perfumes_estoque_compat AS
SELECT
  p.id AS produto_id,
  COALESCE(SUM(eu.quantidade) FILTER (WHERE u.codigo = 'CASA'), 0)::int     AS estoque_casa,
  COALESCE(SUM(eu.quantidade) FILTER (WHERE u.codigo = 'SUMAUMA'), 0)::int  AS estoque_sumauma,
  COALESCE(SUM(eu.quantidade) FILTER (WHERE u.codigo = 'AMAZONAS'), 0)::int AS estoque_amazonas,
  COALESCE(SUM(eu.quantidade), 0)::int                                      AS estoque_total,
  COALESCE(SUM(eu.quantidade - eu.quantidade_reservada), 0)::int            AS disponivel_total
FROM public.perfumes p
LEFT JOIN public.estoque_unidades eu ON eu.produto_id = p.id
LEFT JOIN public.unidades u ON u.id = eu.unidade_id
GROUP BY p.id;

GRANT SELECT ON public.perfumes_estoque_compat TO authenticated;
GRANT SELECT ON public.perfumes_estoque_compat TO service_role;
