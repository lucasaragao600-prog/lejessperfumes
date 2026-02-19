
-- Vendas
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  perfume_id uuid NOT NULL REFERENCES public.perfumes(id),
  perfume_nome text NOT NULL,
  deposito text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  tipo_ajuste text NOT NULL DEFAULT 'desconto',
  desconto numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  vendedora text NOT NULL DEFAULT '',
  tipo_pagamento text NOT NULL DEFAULT 'Pix',
  bandeira text NOT NULL DEFAULT 'N/A',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendas"
  ON public.vendas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage vendas"
  ON public.vendas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Vendedores também podem inserir vendas
CREATE POLICY "Vendedores can insert vendas"
  ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (true);

-- Movimentações
CREATE TABLE public.movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL,
  perfume_id uuid NOT NULL REFERENCES public.perfumes(id),
  perfume_nome text NOT NULL,
  deposito_origem text,
  deposito_destino text,
  deposito text,
  quantidade integer NOT NULL DEFAULT 0,
  observacao text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read movimentacoes"
  ON public.movimentacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage movimentacoes"
  ON public.movimentacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Vendedores can insert movimentacoes"
  ON public.movimentacoes FOR INSERT TO authenticated
  WITH CHECK (true);

-- Testers
CREATE TABLE public.testers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfume_id uuid NOT NULL REFERENCES public.perfumes(id),
  perfume_nome text NOT NULL,
  marca text NOT NULL,
  deposito text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  custo numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read testers"
  ON public.testers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage testers"
  ON public.testers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Vendedores can insert testers"
  ON public.testers FOR INSERT TO authenticated
  WITH CHECK (true);

-- Vendedoras
CREATE TABLE public.vendedoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendedoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendedoras"
  ON public.vendedoras FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage vendedoras"
  ON public.vendedoras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Configurações do sistema (tipos, concentrações, volumes)
CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read configuracoes"
  ON public.configuracoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage configuracoes"
  ON public.configuracoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
