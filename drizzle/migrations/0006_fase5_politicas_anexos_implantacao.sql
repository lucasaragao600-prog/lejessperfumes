DROP POLICY IF EXISTS "impl_anexos_select" ON storage.objects;
CREATE POLICY "impl_anexos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'implantacao-anexos');

DROP POLICY IF EXISTS "impl_anexos_insert" ON storage.objects;
CREATE POLICY "impl_anexos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'implantacao-anexos');

DROP POLICY IF EXISTS "impl_anexos_update" ON storage.objects;
CREATE POLICY "impl_anexos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'implantacao-anexos' AND public.has_role(auth.uid(), 'master'));