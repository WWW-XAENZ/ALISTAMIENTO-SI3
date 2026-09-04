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

CREATE INDEX IF NOT EXISTS idx_board_fotos_orden ON board_fotos(orden);

ALTER PUBLICATION supabase_realtime ADD TABLE board_fotos;

-- Board fotos: lectura pública, escritura pública
CREATE POLICY "Permitir lectura board_fotos" ON board_fotos FOR SELECT USING (true);
CREATE POLICY "Permitir inserción board_fotos" ON board_fotos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización board_fotos" ON board_fotos FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación board_fotos" ON board_fotos FOR DELETE USING (true);

-- Trigger updated_at automático
CREATE TRIGGER update_board_fotos_updated_at
  BEFORE UPDATE ON board_fotos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
