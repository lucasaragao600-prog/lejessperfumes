
-- Add image_url column to perfumes
ALTER TABLE public.perfumes ADD COLUMN image_url text DEFAULT '';

-- Create storage bucket for product photos
INSERT INTO storage.buckets (id, name, public) VALUES ('product-photos', 'product-photos', true);

-- Storage policies for product photos
CREATE POLICY "Anyone can view product photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

CREATE POLICY "Authenticated users can upload product photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update product photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Masters can delete product photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'master'));
