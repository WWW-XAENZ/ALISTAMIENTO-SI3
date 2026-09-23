-- ============================================
-- TABLA: noconformes (registro de no conformes)
-- ============================================
DROP TRIGGER IF EXISTS update_noconformes_updated_at ON noconformes;
DROP TABLE IF EXISTS noconformes;

CREATE TABLE noconformes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fecha DATE NOT NULL,
  codigo TEXT,
  tipo TEXT,
  proveedor TEXT,
  descripcion TEXT,
  cantidad INTEGER,
  responsable TEXT,
  accion TEXT,
  doc_bloqueado TEXT,
  imagen TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibilidad con instalaciones que ya tienen creada la tabla.
ALTER TABLE noconformes ADD COLUMN IF NOT EXISTS proveedor TEXT;

ALTER TABLE noconformes REPLICA IDENTITY FULL;

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_noconformes_fecha ON noconformes(fecha);
CREATE INDEX idx_noconformes_codigo ON noconformes(codigo);
CREATE INDEX idx_noconformes_tipo ON noconformes(tipo);
CREATE INDEX idx_noconformes_responsable ON noconformes(responsable);
CREATE INDEX idx_noconformes_accion ON noconformes(accion);

-- ============================================
-- TRIGGER: updated_at automático
-- ============================================
CREATE TRIGGER update_noconformes_updated_at
  BEFORE UPDATE ON noconformes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REAL-TIME
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE noconformes;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE noconformes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura noconformes" ON noconformes;
DROP POLICY IF EXISTS "Permitir inserción noconformes" ON noconformes;
DROP POLICY IF EXISTS "Permitir actualización noconformes" ON noconformes;
DROP POLICY IF EXISTS "Permitir eliminación noconformes" ON noconformes;

CREATE POLICY "Permitir lectura noconformes" ON noconformes FOR SELECT USING (true);
CREATE POLICY "Permitir inserción noconformes" ON noconformes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización noconformes" ON noconformes FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación noconformes" ON noconformes FOR DELETE USING (true);
