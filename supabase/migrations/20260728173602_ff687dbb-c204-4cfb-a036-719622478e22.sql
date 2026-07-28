
CREATE TABLE public.reposicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.perfumes(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  quantidade_sugerida INTEGER NOT NULL DEFAULT 0,
  quantidade_enviada INTEGER,
  quantidade_recebida INTEGER,
  status TEXT NOT NULL DEFAULT 'sugerida',
  solicitado_por TEXT NOT NULL,
  conferido_por TEXT,
  recebido_por TEXT,
  foto_saida_url TEXT,
  foto_chegada_url TEXT,
  observacao TEXT,
  enviado_em TIMESTAMPTZ,
  recebido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reposicoes TO authenticated;
GRANT ALL ON public.reposicoes TO service_role;

ALTER TABLE public.reposicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reposicoes"
  ON public.reposicoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert reposicoes"
  ON public.reposicoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update reposicoes"
  ON public.reposicoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Master can delete reposicoes"
  ON public.reposicoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'));

CREATE TRIGGER update_reposicoes_updated_at
  BEFORE UPDATE ON public.reposicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reposicoes_status ON public.reposicoes(status);
CREATE INDEX idx_reposicoes_produto ON public.reposicoes(produto_id);
CREATE INDEX idx_reposicoes_destino ON public.reposicoes(destino);
