
-- Fix: Restrict movimentacoes read access by role
DROP POLICY IF EXISTS "Authenticated users can read movimentacoes" ON public.movimentacoes;

CREATE POLICY "Masters can read all movimentacoes"
  ON public.movimentacoes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Vendedores can read own movimentacoes"
  ON public.movimentacoes FOR SELECT
  TO authenticated
  USING (
    registrado_por = (SELECT nome FROM public.profiles WHERE user_id = auth.uid())
  );
