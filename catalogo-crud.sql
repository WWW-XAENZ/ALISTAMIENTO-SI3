-- CRUD transaccional para el catálogo logístico.
-- Ejecutar después de supabase-schema.sql y supabase-migration.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  referencia TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.producto_componentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descripcion TEXT,
  cantidad_por_base NUMERIC(10, 2) NOT NULL DEFAULT 1,
  categoria TEXT CHECK (categoria IN ('base', 'adicional', 'kit', 'anti_vibrante', 'pin')),
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS referencia TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.producto_componentes
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS cantidad_por_base NUMERIC(10, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_referencia_unique
  ON public.productos (referencia)
  WHERE referencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_producto_componentes_producto_orden
  ON public.producto_componentes (producto_id, orden);

-- Consolida duplicados por nombre normalizado. Conserva la fila con más
-- componentes y, en empate, la de componentes actualizados más recientemente.
DO $$
BEGIN
CREATE TEMP TABLE catalogo_productos_duplicados ON COMMIT DROP AS
WITH resumen AS (
  SELECT
    p.id,
    lower(regexp_replace(BTRIM(p.nombre), '\s+', ' ', 'g')) AS clave_nombre,
    COUNT(pc.id) AS total_componentes,
    MAX(pc.created_at) AS ultimo_componente,
    MAX(p.created_at) AS creado
  FROM public.productos p
  LEFT JOIN public.producto_componentes pc ON pc.producto_id = p.id
  WHERE NULLIF(BTRIM(p.nombre), '') IS NOT NULL
  GROUP BY p.id
), ordenados AS (
  SELECT
    resumen.*,
    ROW_NUMBER() OVER (
      PARTITION BY clave_nombre
      ORDER BY total_componentes DESC, ultimo_componente DESC NULLS LAST, creado DESC NULLS LAST, id
    ) AS posicion
  FROM resumen
)
SELECT duplicado.id AS duplicate_id, canonico.id AS canonical_id
FROM ordenados duplicado
JOIN ordenados canonico
  ON canonico.clave_nombre = duplicado.clave_nombre
 AND canonico.posicion = 1
WHERE duplicado.posicion > 1;

WITH heredados AS (
  SELECT DISTINCT ON (
    duplicados.canonical_id,
    lower(BTRIM(componente.tipo)),
    BTRIM(componente.codigo)
  )
    duplicados.canonical_id,
    componente.tipo,
    componente.codigo,
    componente.descripcion,
    componente.cantidad_por_base,
    componente.categoria
  FROM catalogo_productos_duplicados duplicados
  JOIN public.producto_componentes componente ON componente.producto_id = duplicados.duplicate_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.producto_componentes existente
    WHERE existente.producto_id = duplicados.canonical_id
      AND lower(BTRIM(existente.tipo)) = lower(BTRIM(componente.tipo))
      AND BTRIM(existente.codigo) = BTRIM(componente.codigo)
  )
  ORDER BY
    duplicados.canonical_id,
    lower(BTRIM(componente.tipo)),
    BTRIM(componente.codigo),
    componente.created_at DESC NULLS LAST,
    componente.id
), ordenados AS (
  SELECT
    heredados.*,
    COALESCE((
      SELECT MAX(actual.orden) + 1
      FROM public.producto_componentes actual
      WHERE actual.producto_id = heredados.canonical_id
    ), 0) + ROW_NUMBER() OVER (
      PARTITION BY canonical_id
      ORDER BY lower(BTRIM(tipo)), BTRIM(codigo)
    ) - 1 AS siguiente_orden
  FROM heredados
)
INSERT INTO public.producto_componentes (
  producto_id, tipo, codigo, descripcion, cantidad_por_base, categoria, orden
)
SELECT
  canonical_id,
  tipo,
  codigo,
  descripcion,
  COALESCE(cantidad_por_base, 1),
  CASE
    WHEN categoria IN ('base', 'adicional', 'kit', 'anti_vibrante', 'pin') THEN categoria
    WHEN lower(tipo) LIKE '%base%' OR lower(tipo) LIKE '%forro%' THEN 'base'
    ELSE 'adicional'
  END,
  siguiente_orden::INTEGER
FROM ordenados;

DELETE FROM public.productos producto
USING catalogo_productos_duplicados duplicados
WHERE producto.id = duplicados.duplicate_id;
END;
$$;

-- Hunk y Fomi tienen componentes canónicos más recientes en Registros.json.
DELETE FROM public.producto_componentes componente
USING public.productos producto
WHERE componente.producto_id = producto.id
  AND lower(BTRIM(producto.nombre)) = 'hunk'
  AND lower(BTRIM(componente.tipo)) = 'base'
  AND BTRIM(componente.codigo) = '10001619';

DELETE FROM public.producto_componentes componente
USING public.productos producto
WHERE componente.producto_id = producto.id
  AND lower(BTRIM(producto.nombre)) = 'fomi'
  AND lower(BTRIM(componente.tipo)) = 'fomi'
  AND BTRIM(componente.codigo) = '10001201';

-- Repone componentes ausentes desde el catálogo local. Es seguro reejecutar:
-- cada componente se identifica por producto, tipo y código.
WITH respaldo(producto_id, tipo, codigo, descripcion, cantidad, categoria, orden) AS (
  VALUES
    ('5633c51f-df1f-412a-ba12-3787b16d5545'::UUID, 'Base', '7000080', '', 1::NUMERIC, 'base', 0),
    ('5633c51f-df1f-412a-ba12-3787b16d5545'::UUID, 'Forro', '10002917', '', 1::NUMERIC, 'base', 1),
    ('32c7b91e-6276-4c18-9d30-d24898f1ec77'::UUID, 'Base', '30013112', '', 1::NUMERIC, 'base', 0),
    ('32c7b91e-6276-4c18-9d30-d24898f1ec77'::UUID, 'Forro', '10003229', '', 1::NUMERIC, 'base', 1),
    ('32c7b91e-6276-4c18-9d30-d24898f1ec77'::UUID, 'Tira de goma Bet ADV', '30013197', 'Tira de goma Bet ADV', 1::NUMERIC, 'adicional', 2),
    ('9a59ca76-9e42-44be-a22d-db50d9c16209'::UUID, 'Base', '30013364', '', 1::NUMERIC, 'base', 0),
    ('9a59ca76-9e42-44be-a22d-db50d9c16209'::UUID, 'Forro', '10003265', '', 1::NUMERIC, 'base', 1),
    ('4718db62-bd52-43bc-bba4-ec073807c3ed'::UUID, 'Base', '70000077', '', 1::NUMERIC, 'base', 0),
    ('4718db62-bd52-43bc-bba4-ec073807c3ed'::UUID, 'Forro', '10002198', '', 1::NUMERIC, 'base', 1),
    ('4718db62-bd52-43bc-bba4-ec073807c3ed'::UUID, 'Pin', '30011473', '', 1::NUMERIC, 'pin', 2),
    ('d2420000-0000-0000-0000-000000000001'::UUID, 'Base', '70000077', '', 1::NUMERIC, 'base', 0),
    ('d2420000-0000-0000-0000-000000000001'::UUID, 'Forro', '10002198', '', 1::NUMERIC, 'base', 1),
    ('d2420000-0000-0000-0000-000000000001'::UUID, 'Pin', '30011473', '', 1::NUMERIC, 'pin', 2),
    ('d2420000-0000-0000-0000-000000000001'::UUID, 'CAUCHO ANTIVIBRANTE SILLIN D24', '10003264', 'CAUCHO ANTIVIBRANTE SILLIN D24', 4::NUMERIC, 'anti_vibrante', 3),
    ('4d6e49de-a35f-4c2f-b6a3-cbdfd6cd8442'::UUID, 'Base', '30005837', '', 1::NUMERIC, 'base', 0),
    ('4d6e49de-a35f-4c2f-b6a3-cbdfd6cd8442'::UUID, 'Forro', '10002469', '', 1::NUMERIC, 'base', 1),
    ('4d6e49de-a35f-4c2f-b6a3-cbdfd6cd8442'::UUID, 'Forro Rojo', '10003268', '', 1::NUMERIC, 'base', 2),
    ('4d6e49de-a35f-4c2f-b6a3-cbdfd6cd8442'::UUID, 'Forro Gris-negro', '10003272', '', 1::NUMERIC, 'base', 3),
    ('c3d4e5f6-3333-3333-3333-333333333333'::UUID, 'Base', '30005837', '', 1::NUMERIC, 'base', 0),
    ('c3d4e5f6-3333-3333-3333-333333333333'::UUID, 'Forro', '10002150', '', 1::NUMERIC, 'base', 1),
    ('c3d4e5f6-3333-3333-3333-333333333333'::UUID, 'Forro Gris-negro', '10003273', '', 1::NUMERIC, 'base', 2),
    ('c3d4e5f6-3333-3333-3333-333333333333'::UUID, 'Forro Rojo', '10003269', '', 1::NUMERIC, 'base', 3),
    ('b21a73d7-6a34-4de2-9e4e-470d8bb49974'::UUID, 'Base delantero', '30008522', '', 1::NUMERIC, 'base', 0),
    ('b21a73d7-6a34-4de2-9e4e-470d8bb49974'::UUID, 'Base trasero', '30008521', '', 1::NUMERIC, 'base', 1),
    ('b21a73d7-6a34-4de2-9e4e-470d8bb49974'::UUID, 'Forro delantero', '10002190', '', 1::NUMERIC, 'base', 2),
    ('b21a73d7-6a34-4de2-9e4e-470d8bb49974'::UUID, 'Forro trasero', '10002683', '', 1::NUMERIC, 'base', 3),
    ('77d965d0-20fa-458b-ba27-d02a6c98353d'::UUID, 'Base', '30013111', '', 1::NUMERIC, 'base', 0),
    ('77d965d0-20fa-458b-ba27-d02a6c98353d'::UUID, 'Forro', '10003228', '', 1::NUMERIC, 'base', 1)
)
INSERT INTO public.producto_componentes (
  producto_id, tipo, codigo, descripcion, cantidad_por_base, categoria, orden
)
SELECT respaldo.producto_id, respaldo.tipo, respaldo.codigo, respaldo.descripcion,
       respaldo.cantidad, respaldo.categoria, respaldo.orden
FROM respaldo
JOIN public.productos producto ON producto.id = respaldo.producto_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.producto_componentes existente
  WHERE existente.producto_id = respaldo.producto_id
    AND lower(BTRIM(existente.tipo)) = lower(BTRIM(respaldo.tipo))
    AND BTRIM(existente.codigo) = BTRIM(respaldo.codigo)
);

WITH respaldo(producto_nombre, tipo, codigo, descripcion, cantidad, categoria, orden) AS (
  VALUES
    ('hunk', 'Base', '70000086', '', 1::NUMERIC, 'base', 0),
    ('hunk', 'Forro', '90006670', '', 1::NUMERIC, 'base', 1),
    ('hunk', 'RUBBER A SEAT SETTING HUNK', '10003276', 'RUBBER A SEAT SETTING HUNK', 4::NUMERIC, 'adicional', 2),
    ('hunk', 'RUBBER A SEAT SETTING HUNK', '10003278', 'RUBBER A SEAT SETTING HUNK', 4::NUMERIC, 'adicional', 3),
    ('fomi', 'FOMI MARIPOSA', '10001201', '', 1::NUMERIC, 'adicional', 0),
    ('fomi', 'FOMI RIGIDO', '10003279', '', 1::NUMERIC, 'adicional', 1)
)
INSERT INTO public.producto_componentes (
  producto_id, tipo, codigo, descripcion, cantidad_por_base, categoria, orden
)
SELECT producto.id, respaldo.tipo, respaldo.codigo, NULLIF(respaldo.descripcion, ''),
       respaldo.cantidad, respaldo.categoria, respaldo.orden
FROM respaldo
JOIN public.productos producto
  ON lower(BTRIM(producto.nombre)) = respaldo.producto_nombre
WHERE NOT EXISTS (
  SELECT 1
  FROM public.producto_componentes existente
  WHERE existente.producto_id = producto.id
    AND lower(BTRIM(existente.tipo)) = lower(BTRIM(respaldo.tipo))
    AND BTRIM(existente.codigo) = BTRIM(respaldo.codigo)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_nombre_normalizado_unique
  ON public.productos (lower(regexp_replace(BTRIM(nombre), '\s+', ' ', 'g')))
  WHERE NULLIF(BTRIM(nombre), '') IS NOT NULL;

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_componentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura productos" ON public.productos;
DROP POLICY IF EXISTS "Permitir inserción productos" ON public.productos;
DROP POLICY IF EXISTS "Permitir actualización productos" ON public.productos;
DROP POLICY IF EXISTS "Permitir eliminación productos" ON public.productos;
CREATE POLICY "Permitir lectura productos" ON public.productos FOR SELECT USING (true);
CREATE POLICY "Permitir inserción productos" ON public.productos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización productos" ON public.productos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir eliminación productos" ON public.productos FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir lectura componentes" ON public.producto_componentes;
DROP POLICY IF EXISTS "Permitir inserción componentes" ON public.producto_componentes;
DROP POLICY IF EXISTS "Permitir actualización componentes" ON public.producto_componentes;
DROP POLICY IF EXISTS "Permitir eliminación componentes" ON public.producto_componentes;
CREATE POLICY "Permitir lectura componentes" ON public.producto_componentes FOR SELECT USING (true);
CREATE POLICY "Permitir inserción componentes" ON public.producto_componentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización componentes" ON public.producto_componentes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir eliminación componentes" ON public.producto_componentes FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_componentes TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_guardar_producto(
  p_id UUID,
  p_nombre TEXT,
  p_referencia TEXT,
  p_componentes JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_producto_id UUID;
  v_componente JSONB;
BEGIN
  IF NULLIF(BTRIM(p_nombre), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del producto es obligatorio.' USING ERRCODE = '22023';
  END IF;

  IF p_componentes IS NULL OR JSONB_TYPEOF(p_componentes) <> 'array' THEN
    RAISE EXCEPTION 'Los componentes deben enviarse como una lista.' USING ERRCODE = '22023';
  END IF;

  FOR v_componente IN SELECT VALUE FROM JSONB_ARRAY_ELEMENTS(p_componentes)
  LOOP
    IF NULLIF(BTRIM(v_componente->>'tipo'), '') IS NULL
      OR NULLIF(BTRIM(v_componente->>'codigo'), '') IS NULL THEN
      RAISE EXCEPTION 'Cada componente necesita tipo y código.' USING ERRCODE = '22023';
    END IF;

    IF COALESCE(NULLIF(v_componente->>'cantidad_por_base', '')::NUMERIC, 1) < 0 THEN
      RAISE EXCEPTION 'La cantidad por base no puede ser negativa.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_id IS NULL THEN
    INSERT INTO public.productos (nombre, referencia)
    VALUES (BTRIM(p_nombre), NULLIF(BTRIM(p_referencia), ''))
    RETURNING id INTO v_producto_id;
  ELSE
    UPDATE public.productos
    SET nombre = BTRIM(p_nombre),
        referencia = NULLIF(BTRIM(p_referencia), '')
    WHERE id = p_id
    RETURNING id INTO v_producto_id;

    IF v_producto_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró el producto.' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.producto_componentes
    WHERE producto_id = v_producto_id;
  END IF;

  INSERT INTO public.producto_componentes (
    producto_id,
    tipo,
    codigo,
    descripcion,
    cantidad_por_base,
    categoria,
    orden
  )
  SELECT
    v_producto_id,
    BTRIM(componente.tipo),
    BTRIM(componente.codigo),
    NULLIF(BTRIM(componente.descripcion), ''),
    COALESCE(componente.cantidad_por_base, 1),
    CASE
      WHEN componente.categoria IN ('base', 'adicional', 'kit', 'anti_vibrante', 'pin') THEN componente.categoria
      ELSE 'base'
    END,
    COALESCE(componente.orden, 0)
  FROM JSONB_TO_RECORDSET(p_componentes) AS componente(
    tipo TEXT,
    codigo TEXT,
    descripcion TEXT,
    cantidad_por_base NUMERIC,
    categoria TEXT,
    orden INTEGER
  );

  RETURN v_producto_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_eliminar_producto(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.productos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el producto.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_guardar_producto(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.catalogo_eliminar_producto(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_guardar_producto(UUID, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalogo_eliminar_producto(UUID) TO anon, authenticated;

COMMIT;
