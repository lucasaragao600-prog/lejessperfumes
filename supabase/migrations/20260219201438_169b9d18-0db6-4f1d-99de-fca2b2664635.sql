
-- Casas (marcas)
CREATE TABLE public.casas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL, -- TipoPerfume: AR, NI, NA, KI
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.casas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read casas"
  ON public.casas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage casas"
  ON public.casas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Perfumes
CREATE TABLE public.perfumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  marca text NOT NULL,
  casa_sigla text NOT NULL REFERENCES public.casas(sigla),
  tipo text NOT NULL,
  concentracao text NOT NULL,
  tamanho text NOT NULL,
  volume integer NOT NULL,
  custo numeric(10,2) NOT NULL DEFAULT 0,
  preco_venda numeric(10,2) NOT NULL DEFAULT 0,
  estoque_casa integer NOT NULL DEFAULT 0,
  estoque_sumauma integer NOT NULL DEFAULT 0,
  estoque_amazonas integer NOT NULL DEFAULT 0,
  estoque_minimo integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read perfumes"
  ON public.perfumes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Masters can manage perfumes"
  ON public.perfumes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_perfumes_updated_at
  BEFORE UPDATE ON public.perfumes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
