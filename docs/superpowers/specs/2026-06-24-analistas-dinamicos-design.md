# Analistas dinámicos (agregar / ocultar / eliminar)

**Fecha:** 2026-06-24
**Estado:** Aprobado (diseño), pendiente plan de implementación

## Objetivo

Permitir a un administrador **agregar, ocultar y eliminar** analistas desde la UI,
y que cada analista quede **exactamente igual** a los actuales (Luciana, Victoria,
Juan Pablo, Yamil) en todo el proyecto, sin intervención manual en código.

### Garantía de parità total

La equivalencia se garantiza por construcción: **una sola fuente de verdad (tabla
`analistas`) consumida por un único hook `useAnalistas()` en todos los puntos de
consumo**. Se elimina todo nombre de analista hardcodeado. Como internamente ya no
existe diferencia entre un analista "viejo" y uno "nuevo", es imposible que se
comporten distinto.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Ocultar | Desaparece de filtros/dropdowns/gráficas activas, pero sus ventas siguen contando en totales (PDV) e histórico. |
| Eliminar | Solo permitido si el analista no tiene registros. Si tiene, se bloquea y se sugiere ocultar o reasignar. Sin pérdida de datos. |
| Color | Lo elige el usuario al crear (selector obligatorio). Editable luego. |
| Incentivos | Toggle por analista (`tiene_incentivo`), **activado por defecto** → un analista nuevo es equivalente a los demás sin tocar nada. |
| Permisos | Solo admin gestiona (agregar/ocultar/eliminar). |
| Ubicación UI | Nueva sub-tab "Analistas" en Ajustes (visible solo a admin). |
| Reasignación | Reusa Modificación Masiva (BulkModifyTab) existente. No se duplica. |
| Renombrar | **Fuera de alcance** (orfandaría registros). No se implementa. |

## 1. Modelo de datos

Nueva tabla Supabase `analistas`:

```sql
CREATE TABLE IF NOT EXISTS analistas (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre          TEXT NOT NULL UNIQUE,        -- valor exacto guardado en registros.analista
  color           TEXT NOT NULL,               -- hex, ej '#06b6d4'
  oculto          BOOLEAN NOT NULL DEFAULT false,
  tiene_incentivo BOOLEAN NOT NULL DEFAULT true,
  orden           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- **PDV no va en esta tabla**: es "Punto de Venta" = total virtual, se sigue tratando
  aparte como hasta ahora (no es un analista real).
- Seed inicial idempotente con los 4 actuales:

```sql
INSERT INTO analistas (nombre, color, orden) VALUES
  ('Luciana',    '#06b6d4', 1),
  ('Victoria',   '#f59e0b', 2),
  ('Juan Pablo', '#6366f1', 3),
  ('Yamil',      '#14b8a6', 4)
ON CONFLICT (nombre) DO NOTHING;
```

### Validación

`analistaSchema` (zod) en `src/types/index.ts`:
- `nombre`: string no vacío
- `color`: string hex
- `oculto`, `tiene_incentivo`: boolean
- `orden`: number

## 2. Capa de datos

### SettingsProvider

Se agrega `analistas` al `SettingsProvider` existente (que ya wrappea toda la app vía
`AppShell` y maneja realtime/broadcast):
- Fetch: `supabase.from('analistas').select('id,nombre,color,oculto,tiene_incentivo,orden').order('orden')`
- Realtime: nuevo evento broadcast `analistas_change` (INSERT/UPDATE/DELETE), siguiendo
  el patrón de `dias_config_change`.
- Mutador optimista `applyAnalistaChange(type, analista)` + broadcast.

### Hook `useAnalistas()`

Nuevo hook (o extensión de `useSettings`) que expone:

```ts
{
  analistas: Analista[];        // SOLO visibles (oculto=false), ordenados — para UI activa
  analistasAll: Analista[];     // todos, incluye ocultos — para históricos si hace falta
  nombres: string[];            // analistas.map(a => a.nombre) — reemplaza ANALISTAS_DEFAULT
  colorDe: (nombre: string) => string;       // color del analista, con fallback
  cobraIncentivo: (nombre: string) => boolean; // lee flag tiene_incentivo de BD
  // mutadores (admin):
  addAnalista, toggleOculto, deleteAnalista
}
```

Regla de uso:
- **UI activa** (dropdowns, filtros, gráficas, nav) → `analistas`/`nombres` (visibles).
- **Totales/PDV** → se siguen calculando sobre `registros` crudos, no sobre la lista de
  analistas. Así un analista oculto sigue sumando al total e histórico.

## 3. Refactor de consumo

Reemplazar **todo** uso de `CONFIG.ANALISTAS_DEFAULT` y la constante `ANALISTAS`
(de `FilterContext`) por el hook. `CONFIG.ANALISTAS_DEFAULT` se conserva **solo** como
constante de seed/fallback, ya no como fuente de verdad de la UI.

Archivos a refactorizar (dentro de la app, tienen provider):

| Archivo | Uso actual | Cambio |
|---------|-----------|--------|
| `src/context/FilterContext.tsx` | `ANALISTAS` const | Deprecar como fuente; dropdown de filtro usa hook |
| `src/components/Sidebar.tsx` | nav items hardcodeados + `ANALISTAS` | Render dinámico de items Registros y Reportes›Ventas desde `nombres`; dropdown filtro desde hook |
| `src/components/ExportXlsxModal.tsx` | array `ANALISTAS` propio | Usar hook |
| `src/app/registros/page.tsx` | `ANALISTAS[0]` default + dropdowns | Default = primer visible; dropdowns desde hook |
| `src/app/analistas/page.tsx` | `CONFIG.ANALISTAS_DEFAULT` (177,1036,1232) + gate incentivos (365) | Lista desde hook; gate usa `tieneIncentivo(nombre)`; colores desde `colorDe` |
| `src/app/ajustes/page.tsx` | `CONFIG.ANALISTAS_DEFAULT` (202,253,778,813,953) + default `'Luciana'` | Desde hook; default = primer visible |
| `src/app/ajustes/ResumenMensualTab.tsx` | `ANALISTA_COLORES` + `CONFIG.ANALISTAS_DEFAULT` (muchos) + `FILTROS_ACTIVIDAD` | `ANALISTA_COLORES` derivado de la lista; filtros y labels desde hook |
| `src/app/ajustes/ResumenMensualView.tsx` | `CONFIG.ANALISTAS_DEFAULT` (644) | Desde hook |
| `src/app/ajustes/BulkModifyTab.tsx` | `const ANALISTAS = CONFIG.ANALISTAS_DEFAULT` (15,568,1185,3515,3765) | Desde hook |
| `src/app/ajustes/AvisosTab.tsx` | `CONFIG.ANALISTAS_DEFAULT` (74,164) | Desde hook |
| `src/app/ajustes/MetricasTab.tsx` | `CONFIG.ANALISTAS_DEFAULT` (134) | Ver §5 (componente compartido con público) |
| `src/app/proyeccion/page.tsx` | `CONFIG.ANALISTAS_DEFAULT` (61,80) | Desde hook |
| `src/app/proyeccion/ProyeccionClient.tsx` | `['PDV', ...CONFIG.ANALISTAS_DEFAULT]` (54) | `['PDV', ...nombres]` desde hook |

Sin cambio: `SeccionGraficosResumen.tsx:168` y `analistas/page.tsx:1709` usan arrays de
color **por categoría** (PREMIUM/Riesgo/etc.), no por analista.

### Colores

`ANALISTA_COLORES` (hoy hardcodeado en ResumenMensualTab) pasa a derivarse de la lista:
`analistas.map(a => ({ nombre: a.nombre, color: a.color, bg: hexToRgba(a.color, 0.1) }))`.
Se agrega helper `hexToRgba` en `src/lib/utils.ts`.

### Incentivos

En `analistas/page.tsx`, reemplazar:
```ts
const analistasConIncentivo = ['luciana','victoria','juan pablo','yamil'];
const tieneIncentivo = analistasConIncentivo.includes(analista.toLowerCase());
```
por la variable local `tieneIncentivo` derivada del helper del hook (que internamente
lee el flag `tiene_incentivo` de BD). El helper del hook se nombra distinto de la
variable local para evitar shadowing (ej. helper `cobraIncentivo(nombre)` →
`const tieneIncentivo = cobraIncentivo(analista);`).

## 4. UI de gestión — Ajustes › "Analistas" (solo admin)

Nueva sub-tab. Componente `AnalistasTab.tsx`:

- **Lista** ordenada por `orden`: swatch de color, nombre, badges (`Oculto`, `Sin incentivo`).
- **Agregar**: form con
  - `nombre` (requerido, capitalizado con `capitalizarTexto`, único case-insensitive
    via `dedupCI`/check contra lista),
  - selector de color (requerido),
  - toggle incentivo (default on).
  Inserta fila (`orden` = max+1) + broadcast.
- **Ocultar/Mostrar**: toggle `oculto` (update + broadcast).
- **Editar color / incentivo**: inline (update + broadcast).
- **Eliminar**:
  1. `count` de `registros where analista = nombre`.
  2. Si `> 0` → bloquea con mensaje: *"Tiene N registros. Ocultalo, o reasigná sus
     registros en Modificación Masiva antes de eliminar."*
  3. Si `0` → borra fila `analistas` + limpia filas asociadas en `objetivos` y
     `dias_habiles_config` de ese analista + broadcast.

## 5. Link público (`/publico/resumen-mensual`)

La ruta `/publico` es server-side y **no** tiene `SettingsProvider`. Los componentes
compartidos `MetricasTab` y `SeccionGraficosResumen` (usados tanto in-app como en
`ResumenHTML`) hoy leen `CONFIG.ANALISTAS_DEFAULT` directamente.

Cambio: estos componentes aceptan un prop opcional `analistas: string[]`.
- Callers in-app lo pasan desde `useAnalistas()`.
- `page.tsx` de público hace `select` de `analistas` (visibles, ordenados) server-side
  y lo pasa a `ResumenHTML` → componentes.

Así el link público refleja exactamente los mismos analistas que la app.

## 6. Migración

Archivo SQL idempotente (en `supabase-schema.sql` y/o migración dedicada):
- `CREATE TABLE IF NOT EXISTS analistas` (§1)
- Seed `ON CONFLICT DO NOTHING` de los 4 actuales (§1)

## Edge cases

- **Lista vacía** (todos ocultos/eliminados): la UI no debe romper; dropdowns vacíos,
  gráficas sin series. Default de nuevo registro = `''` si no hay visibles.
- **Carga inicial**: antes de que `analistas` cargue, el hook devuelve `[]` (igual que
  los demás providers); las gráficas se pueblan al llegar la data.
- **Unicidad de nombre**: case-insensitive, usando el patrón `dedupCI` ya existente.
- **Analista oculto con ventas en un mes pasado**: su línea individual no se muestra,
  pero el Total PDV de ese mes las sigue incluyendo (se calcula sobre `registros`).

## Fuera de alcance

- Renombrar analistas (orfandaría `registros`; usar Modificación Masiva si hace falta).
- Reasignación masiva propia (ya existe en BulkModifyTab).
- Gestión de analistas desde el link público (es solo lectura).
