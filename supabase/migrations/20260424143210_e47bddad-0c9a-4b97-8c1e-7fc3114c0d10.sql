-- 1) Múltiplos GTINs por produto
CREATE TABLE IF NOT EXISTS public.produto_gtins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL,
  gtin TEXT NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT false,
  criado_por TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produto_gtins_gtin_unique UNIQUE (gtin)
);
CREATE INDEX IF NOT EXISTS idx_produto_gtins_produto ON public.produto_gtins(produto_id);

ALTER TABLE public.produto_gtins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read produto_gtins"
  ON public.produto_gtins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert produto_gtins"
  ON public.produto_gtins FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Masters can manage produto_gtins"
  ON public.produto_gtins FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Migrar códigos de barras existentes
INSERT INTO public.produto_gtins (produto_id, gtin, principal, criado_por)
SELECT id, codigo_barras, true, 'migração'
FROM public.perfumes
WHERE codigo_barras IS NOT NULL
  AND codigo_barras <> ''
ON CONFLICT (gtin) DO NOTHING;

-- 2) Novos campos no balanço
ALTER TABLE public.balancos
  ADD COLUMN IF NOT EXISTS tipo_contagem TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS modo_contagem TEXT NOT NULL DEFAULT 'codigo_barras',
  ADD COLUMN IF NOT EXISTS dupla_conferencia BOOLEAN NOT NULL DEFAULT false;

-- 3) Segunda contagem em balanco_itens
ALTER TABLE public.balanco_itens
  ADD COLUMN IF NOT EXISTS quantidade_contada_2 INTEGER,
  ADD COLUMN IF NOT EXISTS conferido_por_2 TEXT,
  ADD COLUMN IF NOT EXISTS conferido_em_2 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS divergencia_contadores BOOLEAN NOT NULL DEFAULT false;

-- 4) Auditoria de leituras (bipadas)
CREATE TABLE IF NOT EXISTS public.balanco_leituras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balanco_id UUID NOT NULL,
  perfume_id UUID,
  codigo_lido TEXT NOT NULL,
  encontrado BOOLEAN NOT NULL DEFAULT false,
  origem TEXT NOT NULL DEFAULT 'gtin', -- gtin | sku | manual | lote
  quantidade INTEGER NOT NULL DEFAULT 1,
  contagem INTEGER NOT NULL DEFAULT 1, -- 1 = primeira passagem, 2 = dupla conferência
  usuario TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_balanco_leituras_balanco ON public.balanco_leituras(balanco_id);

ALTER TABLE public.balanco_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read balanco_leituras"
  ON public.balanco_leituras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert balanco_leituras"
  ON public.balanco_leituras FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Masters can manage balanco_leituras"
  ON public.balanco_leituras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));