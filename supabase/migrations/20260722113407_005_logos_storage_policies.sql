/*
# Storage policies para bucket logos

## Resumen
Crea políticas RLS para el bucket `logos` en Supabase Storage:
- SELECT público (anyone can read the logo)
- INSERT/UPDATE/DELETE para anon+authenticated (admin sube el logo)

## Seguridad
El bucket es público (public=true) para que las imágenes se carguen sin
autenticación en el frontend. Las escrituras se permiten a anon/authenticated
ya que la app no tiene login de Supabase (usa PIN-based auth local).
*/

-- Política de lectura pública
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logos');

-- Política de escritura
DROP POLICY IF EXISTS "logos_write" ON storage.objects;
CREATE POLICY "logos_write"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_update" ON storage.objects;
CREATE POLICY "logos_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'logos')
WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
CREATE POLICY "logos_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'logos');