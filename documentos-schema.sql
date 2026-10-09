-- Biblioteca de libros y archivos adjuntos SI3.
-- Ejecutar en Supabase SQL Editor antes de usar documentos.html.

CREATE TABLE IF NOT EXISTS public.documentos_libros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 1 AND 120),
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.documentos_archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libro_id UUID NOT NULL REFERENCES public.documentos_libros(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  ruta_storage TEXT NOT NULL UNIQUE,
  url_publica TEXT NOT NULL,
  tipo_mime TEXT NOT NULL CHECK (tipo_mime IN ('image/png', 'image/jpeg', 'application/pdf', 'text/plain')),
  tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documentos_archivos DROP CONSTRAINT IF EXISTS documentos_archivos_tipo_mime_check;
ALTER TABLE public.documentos_archivos
  ADD CONSTRAINT documentos_archivos_tipo_mime_check
  CHECK (tipo_mime IN ('image/png', 'image/jpeg', 'application/pdf', 'text/plain'));
ALTER TABLE public.documentos_archivos DROP CONSTRAINT IF EXISTS documentos_archivos_tamano_bytes_check;
ALTER TABLE public.documentos_archivos
  ADD CONSTRAINT documentos_archivos_tamano_bytes_check CHECK (tamano_bytes > 0);

CREATE INDEX IF NOT EXISTS idx_documentos_archivos_libro
  ON public.documentos_archivos(libro_id, created_at DESC);

ALTER TABLE public.documentos_libros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_archivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública libros documentos" ON public.documentos_libros;
DROP POLICY IF EXISTS "Inserción pública libros documentos" ON public.documentos_libros;
DROP POLICY IF EXISTS "Eliminación pública libros documentos" ON public.documentos_libros;
CREATE POLICY "Lectura pública libros documentos" ON public.documentos_libros FOR SELECT USING (true);
CREATE POLICY "Inserción pública libros documentos" ON public.documentos_libros FOR INSERT WITH CHECK (true);
CREATE POLICY "Eliminación pública libros documentos" ON public.documentos_libros FOR DELETE USING (true);

DROP POLICY IF EXISTS "Lectura pública archivos documentos" ON public.documentos_archivos;
DROP POLICY IF EXISTS "Inserción pública archivos documentos" ON public.documentos_archivos;
DROP POLICY IF EXISTS "Eliminación pública archivos documentos" ON public.documentos_archivos;
CREATE POLICY "Lectura pública archivos documentos" ON public.documentos_archivos FOR SELECT USING (true);
CREATE POLICY "Inserción pública archivos documentos" ON public.documentos_archivos FOR INSERT WITH CHECK (true);
CREATE POLICY "Eliminación pública archivos documentos" ON public.documentos_archivos FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-netoncrea',
  'documentos-netoncrea',
  true,
  NULL,
  ARRAY['image/png', 'image/jpeg', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Lectura pública archivos Netoncrea" ON storage.objects;
DROP POLICY IF EXISTS "Carga pública archivos Netoncrea" ON storage.objects;
DROP POLICY IF EXISTS "Eliminación pública archivos Netoncrea" ON storage.objects;
CREATE POLICY "Lectura pública archivos Netoncrea" ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos-netoncrea');
CREATE POLICY "Carga pública archivos Netoncrea" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documentos-netoncrea');
CREATE POLICY "Eliminación pública archivos Netoncrea" ON storage.objects
  FOR DELETE USING (bucket_id = 'documentos-netoncrea');