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

## 4. Configurar la aplicación

Edita `supabase-client.js` y reemplaza:

```javascript
const SUPABASE_URL = 'TU_SUPABASE_URL'; // ej: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';
```

Con tus credenciales reales.

## 5. Agregar Supabase a tu HTML

En `Alistamiento.html`, antes de `app.js`, agrega:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
```

## 6. Modificar app.js para usar Supabase

Reemplaza las llamadas a `localStorage` con las funciones de `SupabaseDB`:

```javascript
// Antes:
const registros = getRegistros();
saveRegistros(registros);

// Después:
const registros = await DB.getRegistros();
await DB.saveRegistro(registro);
```

## 7. Habilitar Realtime

En Supabase Dashboard:
1. Ve a **Database** → **Replication**
2. Habilita **realtime** para las tablas `registros` y `trazabilidad`

## 8. Probar

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
