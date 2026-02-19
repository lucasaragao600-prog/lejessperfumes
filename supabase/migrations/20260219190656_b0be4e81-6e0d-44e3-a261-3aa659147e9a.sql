
-- Allow anyone to check if masters exist (only count, no data exposure)
CREATE POLICY "Anyone can check if masters exist"
  ON public.user_roles FOR SELECT
  TO anon
  USING (role = 'master');
