
-- Add grupo_venda to vendas to link multiple products in same sale
ALTER TABLE public.vendas ADD COLUMN grupo_venda uuid DEFAULT gen_random_uuid();

-- Create table for split payments
CREATE TABLE public.venda_pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_venda uuid NOT NULL,
  tipo_pagamento text NOT NULL DEFAULT 'Pix',
  bandeira text NOT NULL DEFAULT 'N/A',
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venda_pagamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies matching vendas table
CREATE POLICY "Authenticated users can read venda_pagamentos"
  ON public.venda_pagamentos FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert venda_pagamentos"
  ON public.venda_pagamentos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Masters can manage venda_pagamentos"
  ON public.venda_pagamentos FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Masters can delete venda_pagamentos"
  ON public.venda_pagamentos FOR DELETE
  USING (has_role(auth.uid(), 'master'::app_role));
