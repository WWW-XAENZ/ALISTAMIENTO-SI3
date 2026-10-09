# Configuración de Supabase - Sistema de Alistamiento

## 1. Crear proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta
2. Crea un nuevo proyecto
3. Anota la **URL** y la **ANON KEY** (Settings → API)

## 2. Ejecutar el schema

1. En Supabase Dashboard, ve a **SQL Editor**
2. Copia y pega el contenido de `supabase-schema.sql`
3. Ejecuta el script

## 3. Migrar datos del catálogo

1. En SQL Editor, copia y pega el contenido de `supabase-migration.sql`
2. Ejecuta el script
3. Verifica en **Table Editor** que aparezcan los 33 productos

## 4. Habilitar edición del catálogo

1. En SQL Editor, copia y pega el contenido de `catalogo-crud.sql`
2. Ejecuta el script después de `supabase-schema.sql` y `supabase-migration.sql`
3. El script consolida productos duplicados, conserva componentes, repone componentes faltantes e impone unicidad por nombre
4. Abre `listado.html` para administrar el catálogo. Si las RPC todavía no están instaladas, la página usa escritura directa sobre las tablas existentes.

> **Seguridad:** las políticas actuales permiten escrituras con la clave anónima. Cualquier persona que pueda abrir la aplicación podría modificar el catálogo. Antes de publicar el sistema fuera de una red interna, configura Supabase Auth y restringe las políticas RLS.

## 5. Configurar la aplicación

Edita `supabase-client.js` y reemplaza:

```javascript
const SUPABASE_URL = 'TU_SUPABASE_URL'; // ej: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';
```

Con tus credenciales reales.

## 6. Agregar Supabase a tu HTML

En `Alistamiento.html`, antes de `app.js`, agrega:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
```

## 7. Modificar app.js para usar Supabase

Reemplaza las llamadas a `localStorage` con las funciones de `SupabaseDB`:

```javascript
// Antes:
const registros = getRegistros();
saveRegistros(registros);

// Después:
const registros = await DB.getRegistros();
await DB.saveRegistro(registro);
```

## 8. Habilitar Realtime

En Supabase Dashboard:
1. Ve a **Database** → **Replication**
2. Habilita **realtime** para las tablas `registros` y `trazabilidad`

## 9. Probar

1. Abre la aplicación
2. Verifica en consola que diga "Supabase conectado"
3. Crea un registro y verifica en Supabase Table Editor

## Notas importantes

- Las firmas (Data URLs PNG) se guardan en `recibe` como TEXT
- Las fotos de trazabilidad se guardan en `foto` como TEXT
- Cada componente se guarda como registro separado con `grupo_id` compartido
- El header del grupo tiene `referencia` = nombre del producto
- Los items tienen `referencia` = código del componente

## Estructura de tablas

```
productos (id, nombre, referencia)
  └── producto_componentes (id, producto_id, tipo, codigo, ...)

registros (id, grupo_id, fecha, turno, referencia, base, fomi, ...)
  ├── Header: referencia = nombre producto
  └── Items: referencia = código componente

trazabilidad (id, fecha, referencia, ckd, responsable, foto, ...)
```

## Panel de documentos

1. En Supabase SQL Editor, ejecuta `documentos-schema.sql` para crear las tablas, políticas y el bucket público `documentos-netoncrea`.
2. Abre `documentos.html` desde la aplicación y crea un libro.
3. Adjunta archivos PNG, JPG, PDF o TXT, escribe notas dentro de un libro o captura una imagen para guardarla y transcribirla automáticamente al español.

Los archivos se guardan en Supabase Storage y sus datos descriptivos en `documentos_archivos`. Para aplicar los nuevos tipos y retirar el límite de 20 MB configurado por este panel, vuelve a ejecutar `documentos-schema.sql` en SQL Editor. El límite global de carga que imponga tu plan de Supabase Storage seguirá vigente. La transcripción OCR requiere conexión a internet para cargar Tesseract.js y el modelo de español. El bucket es público para permitir la vista previa y apertura de enlaces. Igual que el resto de la aplicación, las políticas de escritura de este panel son públicas y deben restringirse con Supabase Auth antes de exponerlo fuera de una red interna.
