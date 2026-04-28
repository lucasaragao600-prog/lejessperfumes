-- Adicionar colunas de discriminação fiscal no histórico de custos
ALTER TABLE public.produto_custos
  ADD COLUMN IF NOT EXISTS valor_produto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_icms numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_ipi numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_frete numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_outros numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacao text NOT NULL DEFAULT '';

-- Adicionar colunas fiscais por item da nota para preservar a decomposição
ALTER TABLE public.notas_fiscais_itens
  ADD COLUMN IF NOT EXISTS valor_produto_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_icms_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_ipi_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_frete_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_outros_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto_unit numeric NOT NULL DEFAULT 0;