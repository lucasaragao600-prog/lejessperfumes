
-- Clientes table for PDV customer identification
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf_cnpj text DEFAULT '',
  telefone text DEFAULT '',
  email text DEFAULT '',
  data_nascimento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on CPF/CNPJ when not empty
CREATE UNIQUE INDEX idx_clientes_cpf_cnpj ON public.clientes (cpf_cnpj) WHERE cpf_cnpj <> '';

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Masters can manage clientes" ON public.clientes FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Caixa sessions table for cash register management
CREATE TABLE public.caixa_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id uuid NOT NULL,
  operador_nome text NOT NULL DEFAULT '',
  loja text NOT NULL,
  valor_abertura numeric NOT NULL DEFAULT 0,
  valor_fechamento numeric,
  valor_esperado numeric,
  diferenca numeric,
  status text NOT NULL DEFAULT 'aberto',
  aberto_em timestamptz NOT NULL DEFAULT now(),
  fechado_em timestamptz,
  observacao text DEFAULT ''
);

ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read caixa_sessoes" ON public.caixa_sessoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert caixa_sessoes" ON public.caixa_sessoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update own caixa" ON public.caixa_sessoes FOR UPDATE TO authenticated USING (operador_id = auth.uid());
CREATE POLICY "Masters can manage caixa_sessoes" ON public.caixa_sessoes FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Caixa movements (sangria, suprimento)
CREATE TABLE public.caixa_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'sangria' | 'suprimento'
  valor numeric NOT NULL DEFAULT 0,
  motivo text DEFAULT '',
  registrado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read caixa_movimentacoes" ON public.caixa_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert caixa_movimentacoes" ON public.caixa_movimentacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Masters can manage caixa_movimentacoes" ON public.caixa_movimentacoes FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Add cliente_id to vendas table
ALTER TABLE public.vendas ADD COLUMN cliente_id uuid REFERENCES public.clientes(id);
ALTER TABLE public.vendas ADD COLUMN tipo_documento text NOT NULL DEFAULT 'comprovante';
ALTER TABLE public.vendas ADD COLUMN nfce_status text DEFAULT 'pendente';
ALTER TABLE public.vendas ADD COLUMN nfce_chave text DEFAULT '';
ALTER TABLE public.vendas ADD COLUMN sessao_caixa_id uuid REFERENCES public.caixa_sessoes(id);

-- Add parcelas to venda_pagamentos
ALTER TABLE public.venda_pagamentos ADD COLUMN parcelas integer NOT NULL DEFAULT 1;
ALTER TABLE public.venda_pagamentos ADD COLUMN valor_parcela numeric NOT NULL DEFAULT 0;
