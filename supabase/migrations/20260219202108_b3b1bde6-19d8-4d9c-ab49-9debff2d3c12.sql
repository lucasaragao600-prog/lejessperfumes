
-- Drop the overly permissive policies
DROP POLICY "Vendedores can insert vendas" ON public.vendas;
DROP POLICY "Vendedores can insert movimentacoes" ON public.movimentacoes;
DROP POLICY "Vendedores can insert testers" ON public.testers;

-- Recreate with authenticated check (not true)
CREATE POLICY "Authenticated can insert vendas"
  ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert movimentacoes"
  ON public.movimentacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert testers"
  ON public.testers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
