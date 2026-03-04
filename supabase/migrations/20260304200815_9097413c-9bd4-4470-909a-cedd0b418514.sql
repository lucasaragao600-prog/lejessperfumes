
CREATE TABLE public.preco_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
  preco_antigo numeric NOT NULL DEFAULT 0,
  preco_novo numeric NOT NULL DEFAULT 0,
  alterado_por text NOT NULL DEFAULT '',
  data timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preco_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read preco_historico" ON public.preco_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters can manage preco_historico" ON public.preco_historico FOR ALL TO authenticated USING (has_role(auth.uid(), 'master')) WITH CHECK (has_role(auth.uid(), 'master'));
CREATE POLICY "Authenticated can insert preco_historico" ON public.preco_historico FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
