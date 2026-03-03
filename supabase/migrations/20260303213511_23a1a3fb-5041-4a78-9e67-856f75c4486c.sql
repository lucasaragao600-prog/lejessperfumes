
-- Add custo_medio and ultimo_custo_em to perfumes
ALTER TABLE public.perfumes
  ADD COLUMN IF NOT EXISTS custo_medio numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_custo_em timestamp with time zone DEFAULT now();

-- Histórico de custos
CREATE TABLE public.produto_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id) ON DELETE CASCADE,
  data timestamp with time zone NOT NULL DEFAULT now(),
  custo_unitario numeric NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual', -- nota | manual | ajuste
  nota_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.produto_custos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read produto_custos" ON public.produto_custos FOR SELECT USING (true);
CREATE POLICY "Masters can manage produto_custos" ON public.produto_custos FOR ALL USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Authenticated can insert produto_custos" ON public.produto_custos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Alertas de estoque
CREATE TABLE public.alertas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.perfumes(id) ON DELETE CASCADE,
  loja text NOT NULL,
  tipo text NOT NULL, -- ZEROU | BAIXO
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | ENVIADO | LIDO | RESOLVIDO
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  resolvido_em timestamp with time zone
);
ALTER TABLE public.alertas_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read alertas_estoque" ON public.alertas_estoque FOR SELECT USING (true);
CREATE POLICY "Masters can manage alertas_estoque" ON public.alertas_estoque FOR ALL USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Authenticated can insert alertas_estoque" ON public.alertas_estoque FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update alertas_estoque" ON public.alertas_estoque FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Notas fiscais
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  fornecedor text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  data_emissao date,
  status text NOT NULL DEFAULT 'pendente', -- pendente | conciliada | cancelada
  xml_url text,
  deposito_destino text,
  conciliada_em timestamp with time zone,
  conciliada_por text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read notas_fiscais" ON public.notas_fiscais FOR SELECT USING (true);
CREATE POLICY "Masters can manage notas_fiscais" ON public.notas_fiscais FOR ALL USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Itens da nota fiscal
CREATE TABLE public.notas_fiscais_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  descricao_xml text NOT NULL DEFAULT '',
  codigo_xml text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  perfume_id uuid REFERENCES public.perfumes(id),
  status_correspondencia text NOT NULL DEFAULT 'pendente', -- pendente | correspondido | ignorado
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read notas_fiscais_itens" ON public.notas_fiscais_itens FOR SELECT USING (true);
CREATE POLICY "Masters can manage notas_fiscais_itens" ON public.notas_fiscais_itens FOR ALL USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Auditoria de importação
CREATE TABLE public.auditoria_importacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid,
  usuario_nome text NOT NULL DEFAULT '',
  data timestamp with time zone NOT NULL DEFAULT now(),
  arquivo_nome text NOT NULL DEFAULT '',
  total_alterados integer NOT NULL DEFAULT 0,
  resumo text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria_importacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read auditoria_importacao" ON public.auditoria_importacao FOR SELECT USING (true);
CREATE POLICY "Masters can manage auditoria_importacao" ON public.auditoria_importacao FOR ALL USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Authenticated can insert auditoria_importacao" ON public.auditoria_importacao FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
