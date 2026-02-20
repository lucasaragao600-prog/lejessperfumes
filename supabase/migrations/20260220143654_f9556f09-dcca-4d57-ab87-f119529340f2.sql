
-- Add registrado_por column to vendas
ALTER TABLE public.vendas ADD COLUMN registrado_por text NOT NULL DEFAULT '';

-- Add registrado_por column to movimentacoes
ALTER TABLE public.movimentacoes ADD COLUMN registrado_por text NOT NULL DEFAULT '';

-- Add registrado_por column to testers
ALTER TABLE public.testers ADD COLUMN registrado_por text NOT NULL DEFAULT '';

-- Allow authenticated users to delete vendas (will be restricted in app to master only via RLS)
CREATE POLICY "Masters can delete vendas"
ON public.vendas
FOR DELETE
USING (has_role(auth.uid(), 'master'::app_role));
