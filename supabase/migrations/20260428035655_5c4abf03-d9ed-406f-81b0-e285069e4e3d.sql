ALTER TABLE public.produto_custos
ADD COLUMN IF NOT EXISTS aliquota_icms numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS aliquota_ipi numeric NOT NULL DEFAULT 0;