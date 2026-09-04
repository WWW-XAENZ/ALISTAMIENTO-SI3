-- ============================================
-- SUPABASE SCHEMA - SISTEMA DE ALISTAMIENTO
-- ============================================

-- Extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: productos (catálogo)
-- ============================================
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  referencia TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: producto_componentes
-- ============================================
CREATE TABLE IF NOT EXISTS producto_componentes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descripcion TEXT,
  cantidad_por_base DECIMAL(10,2) DEFAULT 1,
  categoria TEXT CHECK (categoria IN ('base', 'adicional', 'kit', 'anti_vibrante', 'pin')),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: registros (alistamiento)
-- ============================================
CREATE TABLE IF NOT EXISTS registros (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID NOT NULL,
  fecha DATE NOT NULL,
  turno TEXT CHECK (turno IN ('1', '2')),
  referencia TEXT NOT NULL,
  base TEXT,
  fomi TEXT,
  componentes TEXT,
  forro TEXT,
  contabilizado TEXT,
  responsable TEXT,
  descripcion TEXT,
  recibe TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: trazabilidad
-- ============================================
CREATE TABLE IF NOT EXISTS trazabilidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fecha DATE NOT NULL,
  referencia TEXT NOT NULL,
  ckd TEXT CHECK (ckd IN ('CARTAGENA', 'RIONEGRO')),
  responsable TEXT CHECK (responsable IN ('JUAN JOSE SAENZ', 'DAVID VALENCIA')),
  cantidad TEXT,
  novedades TEXT,
  foto TEXT,
  revisado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: board_fotos (fotos del tablero)
-- ============================================
CREATE TABLE IF NOT EXISTS board_fotos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  src TEXT NOT NULL,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_productos_referencia ON productos(referencia);
CREATE INDEX IF NOT EXISTS idx_producto_componentes_producto ON producto_componentes(producto_id);
CREATE INDEX IF NOT EXISTS idx_registros_grupo ON registros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha);
CREATE INDEX IF NOT EXISTS idx_registros_referencia ON registros(referencia);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_fecha ON trazabilidad(fecha);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_referencia ON trazabilidad(referencia);
CREATE INDEX IF NOT EXISTS idx_board_fotos_orden ON board_fotos(orden);

-- ============================================
-- TRIGGER: updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_productos_updated_at ON productos;
CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HABILITAR REAL-TIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE registros;
ALTER PUBLICATION supabase_realtime ADD TABLE trazabilidad;
ALTER PUBLICATION supabase_realtime ADD TABLE board_fotos;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE trazabilidad ENABLE ROW LEVEL SECURITY;

-- Productos: lectura pública, escritura autenticada
CREATE POLICY "Permitir lectura productos" ON productos FOR SELECT USING (true);
CREATE POLICY "Permitir inserción productos" ON productos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización productos" ON productos FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación productos" ON productos FOR DELETE USING (true);

-- Componentes: lectura pública, escritura autenticada
CREATE POLICY "Permitir lectura componentes" ON producto_componentes FOR SELECT USING (true);
CREATE POLICY "Permitir inserción componentes" ON producto_componentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización componentes" ON producto_componentes FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación componentes" ON producto_componentes FOR DELETE USING (true);

-- Registros: lectura pública, escritura pública (sin auth por ahora)
CREATE POLICY "Permitir lectura registros" ON registros FOR SELECT USING (true);
CREATE POLICY "Permitir inserción registros" ON registros FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización registros" ON registros FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación registros" ON registros FOR DELETE USING (true);

-- Trazabilidad: lectura pública, escritura pública
CREATE POLICY "Permitir lectura trazabilidad" ON trazabilidad FOR SELECT USING (true);
CREATE POLICY "Permitir inserción trazabilidad" ON trazabilidad FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización trazabilidad" ON trazabilidad FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación trazabilidad" ON trazabilidad FOR DELETE USING (true);

-- Board fotos: lectura pública, escritura pública
CREATE POLICY "Permitir lectura board_fotos" ON board_fotos FOR SELECT USING (true);
CREATE POLICY "Permitir inserción board_fotos" ON board_fotos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización board_fotos" ON board_fotos FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación board_fotos" ON board_fotos FOR DELETE USING (true);

-- ============================================
-- FUNCIÓN: Obtener registros agrupados por grupo_id
-- ============================================
CREATE OR REPLACE FUNCTION get_registros_agrupados()
RETURNS TABLE (
  grupo_id UUID,
  fecha DATE,
  turno TEXT,
  referencia TEXT,
  base TEXT,
  fomi TEXT,
  forro TEXT,
  contabilizado TEXT,
  responsable TEXT,
  firma TEXT,
  componentes JSONB,
  total_items BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.grupo_id,
    r.fecha,
    r.turno,
    r.referencia,
    r.base,
    r.fomi,
    r.forro,
    r.contabilizado,
    r.responsable,
    r.recibe,
    jsonb_agg(
      jsonb_build_object(
        'id', r2.id,
        'referencia', r2.referencia,
        'componentes', r2.componentes,
        'descripcion', r2.descripcion
      )
    ) AS componentes,
    count(r2.id) AS total_items
  FROM registros r
  LEFT JOIN registros r2 ON r2.grupo_id = r.grupo_id AND r2.id != r.id
  WHERE r.grupo_id IS NOT NULL
  GROUP BY r.grupo_id, r.fecha, r.turno, r.referencia, r.base, r.fomi, r.forro, r.contabilizado, r.responsable, r.recibe
  ORDER BY r.fecha DESC, r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;
