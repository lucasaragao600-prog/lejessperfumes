ALTER TABLE public.balancos
  ADD COLUMN IF NOT EXISTS areas_split boolean NOT NULL DEFAULT false;

ALTER TABLE public.balanco_itens
  ADD COLUMN IF NOT EXISTS quantidade_deposito integer,
  ADD COLUMN IF NOT EXISTS quantidade_salao integer,
  ADD COLUMN IF NOT EXISTS vendas_durante integer NOT NULL DEFAULT 0;