-- Allow authenticated users to upload proof images
CREATE POLICY "Allow auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proof-images');

-- Allow public to read proof images
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'proof-images');