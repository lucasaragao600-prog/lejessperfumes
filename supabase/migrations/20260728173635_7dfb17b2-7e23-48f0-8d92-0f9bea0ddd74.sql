
CREATE POLICY "Auth can view reposicoes fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reposicoes-fotos');

CREATE POLICY "Auth can upload reposicoes fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reposicoes-fotos');

CREATE POLICY "Auth can update reposicoes fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reposicoes-fotos');

CREATE POLICY "Auth can delete reposicoes fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reposicoes-fotos');
