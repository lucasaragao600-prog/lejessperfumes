
-- Fix: movimentacoes INSERT policy must be PERMISSIVE for vendedores
DROP POLICY IF EXISTS "Authenticated can insert movimentacoes" ON public.movimentacoes;
CREATE POLICY "Authenticated can insert movimentacoes"
  ON public.movimentacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix: vendedores need to be able to update perfumes stock columns
-- Create a permissive policy that allows authenticated users to update only stock columns
DROP POLICY IF EXISTS "Authenticated can update perfume stock" ON public.perfumes;
CREATE POLICY "Authenticated can update perfume stock"
  ON public.perfumes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix: Make master policies on movimentacoes permissive for read
DROP POLICY IF EXISTS "Masters can read all movimentacoes" ON public.movimentacoes;
CREATE POLICY "Masters can read all movimentacoes"
  ON public.movimentacoes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));

-- Fix: vendedores read own - make permissive  
DROP POLICY IF EXISTS "Vendedores can read own movimentacoes" ON public.movimentacoes;
CREATE POLICY "Vendedores can read own movimentacoes"
  ON public.movimentacoes
  FOR SELECT
  TO authenticated
  USING (registrado_por = (SELECT profiles.nome FROM profiles WHERE profiles.user_id = auth.uid()));

-- Fix: master manage movimentacoes - make permissive
DROP POLICY IF EXISTS "Masters can manage movimentacoes" ON public.movimentacoes;
CREATE POLICY "Masters can manage movimentacoes"
  ON public.movimentacoes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Also fix testers INSERT for vendedores
DROP POLICY IF EXISTS "Authenticated can insert testers" ON public.testers;
CREATE POLICY "Authenticated can insert testers"
  ON public.testers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
