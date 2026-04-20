-- Tabela principal de balanços
CREATE TABLE public.balancos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  depositos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | em_andamento | concluido | ajustado | cancelado
  responsavel TEXT NOT NULL DEFAULT '',
  responsavel_id UUID,
  observacoes TEXT NOT NULL DEFAULT '',
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  concluido_em TIMESTAMP WITH TIME ZONE,
  ajustado_em TIMESTAMP WITH TIME ZONE,
  ajustado_por TEXT,
  cancelado_em TIMESTAMP WITH TIME ZONE,
  cancelado_por TEXT,
  motivo_cancelamento TEXT,
  total_itens INTEGER NOT NULL DEFAULT 0,
  total_conferidos INTEGER NOT NULL DEFAULT 0,
  total_divergencias INTEGER NOT NULL DEFAULT 0,
  total_sobras INTEGER NOT NULL DEFAULT 0,
  total_faltas INTEGER NOT NULL DEFAULT 0,
  valor_divergencia NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Itens do balanço (snapshot do estoque + contagem)
CREATE TABLE public.balanco_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balanco_id UUID NOT NULL REFERENCES public.balancos(id) ON DELETE CASCADE,
  perfume_id UUID NOT NULL REFERENCES public.perfumes(id) ON DELETE RESTRICT,
  perfume_codigo TEXT NOT NULL DEFAULT '',
  perfume_nome TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  deposito TEXT NOT NULL,
  estoque_sistema INTEGER NOT NULL DEFAULT 0,
  quantidade_contada INTEGER,
  diferenca INTEGER NOT NULL DEFAULT 0,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  impacto_financeiro NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | sem_divergencia | sobra | falta
  justificativa TEXT NOT NULL DEFAULT '',
  conferido_por TEXT,
  conferido_em TIMESTAMP WITH TIME ZONE,
  ajuste_aplicado BOOLEAN NOT NULL DEFAULT false,
  movimentacao_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(balanco_id, perfume_id, deposito)
);

-- Log de auditoria
CREATE TABLE public.balanco_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balanco_id UUID NOT NULL REFERENCES public.balancos(id) ON DELETE CASCADE,
  acao TEXT NOT NULL, -- criado | item_conferido | salvo | concluido | ajuste_aplicado | cancelado | reaberto
  usuario TEXT NOT NULL DEFAULT '',
  usuario_id UUID,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_balanco_itens_balanco ON public.balanco_itens(balanco_id);
CREATE INDEX idx_balanco_itens_perfume ON public.balanco_itens(perfume_id);
CREATE INDEX idx_balanco_itens_status ON public.balanco_itens(status);
CREATE INDEX idx_balanco_auditoria_balanco ON public.balanco_auditoria(balanco_id);
CREATE INDEX idx_balancos_status ON public.balancos(status);

-- RLS
ALTER TABLE public.balancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balanco_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balanco_auditoria ENABLE ROW LEVEL SECURITY;

-- balancos: leitura para autenticados, insert/update para autenticados, delete só master
CREATE POLICY "Authenticated can read balancos"
  ON public.balancos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert balancos"
  ON public.balancos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update balancos"
  ON public.balancos FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters can manage balancos"
  ON public.balancos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- balanco_itens
CREATE POLICY "Authenticated can read balanco_itens"
  ON public.balanco_itens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert balanco_itens"
  ON public.balanco_itens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update balanco_itens"
  ON public.balanco_itens FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters can manage balanco_itens"
  ON public.balanco_itens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- balanco_auditoria
CREATE POLICY "Authenticated can read balanco_auditoria"
  ON public.balanco_auditoria FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert balanco_auditoria"
  ON public.balanco_auditoria FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Masters can manage balanco_auditoria"
  ON public.balanco_auditoria FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Triggers de updated_at
CREATE TRIGGER update_balancos_updated_at
  BEFORE UPDATE ON public.balancos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_balanco_itens_updated_at
  BEFORE UPDATE ON public.balanco_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();