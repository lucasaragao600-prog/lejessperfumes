
-- Fix movimentacoes policies: change from RESTRICTIVE to PERMISSIVE

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated can insert movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Masters can manage movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Masters can read all movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Vendedores can read own movimentacoes" ON public.movimentacoes;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Masters can do all on movimentacoes"
  ON public.movimentacoes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Authenticated can insert movimentacoes"
  ON public.movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Masters can read all movimentacoes"
  ON public.movimentacoes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Vendedores can read own movimentacoes"
  ON public.movimentacoes FOR SELECT
  TO authenticated
  USING (registrado_por = (SELECT profiles.nome FROM profiles WHERE profiles.user_id = auth.uid()));
