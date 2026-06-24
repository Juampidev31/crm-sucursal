# Analistas dinámicos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un admin agregue, oculte y elimine analistas desde la UI, quedando cada uno exactamente igual a los actuales en todo el proyecto.

**Architecture:** Tabla Supabase `analistas` como única fuente de verdad → cargada en `SettingsProvider` (con realtime broadcast) → consumida por un hook `useAnalistas()` que reemplaza la constante hardcodeada `CONFIG.ANALISTAS_DEFAULT` / `ANALISTAS` en todos los puntos de consumo. UI de gestión en una sub-tab de Ajustes (solo admin).

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase (Postgres + Realtime), zod.

**Verificación:** El proyecto no tiene runner de tests (solo `lint` y `build`). Cada tarea se verifica con `npx tsc --noEmit`, `npm run lint` y smoke manual en `npm run dev` donde aplique. No se introduce Jest (YAGNI, no solicitado).

**Spec:** `docs/superpowers/specs/2026-06-24-analistas-dinamicos-design.md`

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---------|-----------------|--------|
| `supabase-schema.sql` | DDL + seed tabla `analistas` | Modificar |
| `src/types/index.ts` | Tipo `Analista` + `analistaSchema` | Modificar |
| `src/lib/utils.ts` | Helper `hexToRgba` | Modificar |
| `src/features/settings/SettingsProvider.tsx` | Fetch + realtime + mutadores de `analistas`; hook `useAnalistas` | Modificar |
| `src/app/ajustes/AnalistasTab.tsx` | UI de gestión (alta/ocultar/eliminar) | Crear |
| `src/app/ajustes/page.tsx` | Montar sub-tab "Analistas" (admin) | Modificar |
| Consumidores (§ Tasks 5–8) | Reemplazar constante por hook | Modificar |

---

## Task 1: Migración DB — tabla `analistas` + seed

**Files:**
- Modify: `supabase-schema.sql` (agregar al final del bloque de CREATE TABLE, antes de los triggers)

- [ ] **Step 1: Agregar DDL + seed idempotente**

En `supabase-schema.sql`, después de `CREATE TABLE IF NOT EXISTS configuracion (...)` y antes del bloque `-- TRIGGERS`, agregar:

```sql
-- ============================================
-- TABLA: analistas (gestión dinámica)
-- ============================================
CREATE TABLE IF NOT EXISTS analistas (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre          TEXT NOT NULL UNIQUE,
  color           TEXT NOT NULL,
  oculto          BOOLEAN NOT NULL DEFAULT false,
  tiene_incentivo BOOLEAN NOT NULL DEFAULT true,
  orden           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO analistas (nombre, color, orden) VALUES
  ('Luciana',    '#06b6d4', 1),
  ('Victoria',   '#f59e0b', 2),
  ('Juan Pablo', '#6366f1', 3),
  ('Yamil',      '#14b8a6', 4)
ON CONFLICT (nombre) DO NOTHING;
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Ejecutar el bloque anterior en el SQL editor de Supabase (o vía MCP `apply_migration` con name `create_analistas`). 
Verificar: `SELECT * FROM analistas ORDER BY orden;` → devuelve las 4 filas seed.

- [ ] **Step 3: Commit**

```bash
git add supabase-schema.sql
git commit -m "feat(db): tabla analistas + seed inicial"
```

---

## Task 2: Tipo `Analista`, schema zod y helper `hexToRgba`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Agregar tipo + schema en `src/types/index.ts`**

Junto a los otros schemas (ej. cerca de `diasConfigSchema`), agregar:

```ts
export const analistaSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1),
  color: z.string().min(1),
  oculto: z.boolean(),
  tiene_incentivo: z.boolean(),
  orden: z.number(),
});
export type Analista = z.infer<typeof analistaSchema>;
```

(Si `z` no está importado en el archivo, agregar `import { z } from 'zod';` al tope — verificar primero; otros schemas ya lo usan, así que debería estar.)

- [ ] **Step 2: Agregar `hexToRgba` en `src/lib/utils.ts`**

Al final del archivo:

```ts
/**
 * Convierte un color hex (#rrggbb) a string rgba con el alpha dado.
 * Ej: hexToRgba('#06b6d4', 0.1) → 'rgba(6, 182, 212, 0.1)'
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/utils.ts
git commit -m "feat: tipo Analista, analistaSchema y helper hexToRgba"
```

---

## Task 3: Cargar `analistas` en SettingsProvider + hook `useAnalistas`

**Files:**
- Modify: `src/features/settings/SettingsProvider.tsx`

- [ ] **Step 1: Importar tipo/schema**

En el import desde `'@/types'`, agregar `Analista, analistaSchema`:

```ts
import {
  AlertaConfig, DiasConfig, PermisoRol, Analista,
  alertaConfigSchema, diasConfigSchema, permisoRolSchema, analistaSchema, parseRows,
} from '@/types';
```

- [ ] **Step 2: Estado + schema de cambio**

Agregar junto a los otros `useState` y schemas de cambio:

```ts
const analistaChangeSchema = z.object({ type: changeType, config: analistaSchema });
```

Dentro de `SettingsProvider`, junto a los otros estados:

```ts
const [analistas, setAnalistas] = useState<Analista[]>([]);
```

- [ ] **Step 3: Fetch**

En `fetchSettings`, agregar `analistas` al `Promise.all` y su validación:

```ts
const [alertasR, diasR, permisosR, analistasR] = await Promise.all([
  supabase.from('alertas_config').select('id,nombre,estado,dias,mensaje,color'),
  supabase.from('dias_habiles_config').select('analista,dias_habiles,dias_transcurridos'),
  supabase.from('permisos_roles').select('id,rol,permiso,activo'),
  supabase.from('analistas').select('id,nombre,color,oculto,tiene_incentivo,orden').order('orden'),
]);
```

Y después de las validaciones existentes:

```ts
if (analistasR.error && analistasR.error.code !== '42P01') reportError('refresh:analistas', analistasR.error);
else if (!analistasR.error) validateAndSet<Analista>('analistas', analistaSchema, analistasR.data, setAnalistas);
```

- [ ] **Step 4: Realtime handler + mutador**

En el objeto de `useRealtimeBroadcast`, agregar el handler:

```ts
analistas_change: (payload) => {
  const data = validateBroadcast('analistas_change', analistaChangeSchema, payload);
  if (!data) return;
  const { type, config } = data;
  setAnalistas(prev => {
    if (type === 'DELETE') return prev.filter(a => a.nombre !== config.nombre);
    return prev.some(a => a.nombre === config.nombre)
      ? prev.map(a => a.nombre === config.nombre ? config : a)
      : [...prev, config];
  });
},
```

Y agregar el mutador (junto a `applyDiasConfigChange`):

```ts
const applyAnalistaChange = useCallback((type: ChangeType, config: Analista) => {
  setAnalistas(prev => {
    if (type === 'DELETE') return prev.filter(a => a.nombre !== config.nombre);
    return prev.some(a => a.nombre === config.nombre)
      ? prev.map(a => a.nombre === config.nombre ? config : a)
      : [...prev, config];
  });
  broadcastRef.current?.send({ type: 'broadcast', event: 'analistas_change', payload: { type, config } }).catch(() => {});
}, [broadcastRef]);
```

- [ ] **Step 5: Exponer en el contexto**

Agregar `analistas: Analista[]` y `applyAnalistaChange` a la interfaz `SettingsCtx`, e incluirlos en el objeto `value` y sus deps del `useMemo`.

- [ ] **Step 6: Hook de conveniencia `useAnalistas`**

Al final del archivo, después de `useSettings`:

```ts
export function useAnalistas() {
  const { analistas: all, applyAnalistaChange } = useSettings();
  const visibles = useMemo(() => all.filter(a => !a.oculto), [all]);
  const nombres = useMemo(() => visibles.map(a => a.nombre), [visibles]);
  const colorDe = useCallback(
    (nombre: string) => all.find(a => a.nombre === nombre)?.color ?? '#10b981',
    [all],
  );
  const cobraIncentivo = useCallback(
    (nombre: string) => all.find(a => a.nombre === nombre)?.tiene_incentivo ?? false,
    [all],
  );
  return { analistas: visibles, analistasAll: all, nombres, colorDe, cobraIncentivo, applyAnalistaChange };
}
```

(Asegurar que `useMemo`/`useCallback` estén importados de React — ya lo están.)

- [ ] **Step 7: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/settings/SettingsProvider.tsx
git commit -m "feat: cargar analistas en SettingsProvider + hook useAnalistas"
```

---

## Task 4: Sidebar — nav items y dropdown dinámicos

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Importar el hook**

```ts
import { useAnalistas } from '@/features/settings/SettingsProvider';
```

Y dentro del componente: `const { nombres: analistaNombres } = useAnalistas();`

- [ ] **Step 2: Render dinámico — submenú Registros**

Reemplazar los `NavItem` hardcodeados de Luciana/Victoria/Juan Pablo/Yamil (los 4 bloques entre el item "Total" y el item "Clientes en revisión") por:

```tsx
{analistaNombres.map(nombre => (
  <NavItem
    key={nombre}
    href="/registros"
    icon={Users}
    label={nombre}
    active={pathname === '/registros' && filters.analista.toLowerCase() === nombre.toLowerCase() && filters.estados.length === 0}
    onClick={() => { limpiarFiltros(); setFilter('analista', nombre); }}
    indent
    isTreeItem
  />
))}
```

- [ ] **Step 3: Render dinámico — submenú Reportes › Ventas**

Reemplazar los `NavItem` hardcodeados de analistas (después del de "PDV") por:

```tsx
{analistaNombres.map((nombre, idx) => (
  <NavItem
    key={nombre}
    href={`/analistas?analista=${encodeURIComponent(nombre)}`}
    icon={TrendingUp}
    label={nombre}
    active={pathname === '/analistas' && currentAnalistaPage === nombre}
    indent
    isDoubleTreeItem
    isLastTreeItem={idx === analistaNombres.length - 1}
  />
))}
```

(El item "PDV" se mantiene tal cual antes de este `.map`.)

- [ ] **Step 4: Dropdown de filtro ANALISTA**

Reemplazar `options={ANALISTAS}` (en el `CustomSelect` de la sección ANALISTA) por `options={analistaNombres}`. Quitar el import de `ANALISTAS` si queda sin uso (dejar `ESTADOS`).

- [ ] **Step 5: Verificar typecheck + smoke**

Run: `npx tsc --noEmit` → exit 0.
Smoke (`npm run dev`): el sidebar muestra los 4 analistas en Registros y en Reportes › Ventas; el filtro ANALISTA los lista.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: sidebar con analistas dinámicos"
```

---

## Task 5: ResumenMensualTab — colores y filtros dinámicos

**Files:**
- Modify: `src/app/ajustes/ResumenMensualTab.tsx`

- [ ] **Step 1: Importar hook + helper**

```ts
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { hexToRgba } from '@/lib/utils';
```

- [ ] **Step 2: Derivar colores y filtros desde la lista**

Eliminar las constantes module-scope `ANALISTA_COLORES` y `FILTROS_ACTIVIDAD` (agregadas en el cambio previo). Dentro del componente, agregar:

```ts
const { analistas } = useAnalistas();
const ANALISTA_COLORES = useMemo(
  () => analistas.map(a => ({ nombre: a.nombre, color: a.color, bg: hexToRgba(a.color, 0.1) })),
  [analistas],
);
const FILTROS_ACTIVIDAD = useMemo(
  () => ['PDV', ...analistas.map(a => a.nombre), 'Comparativa'],
  [analistas],
);
```

- [ ] **Step 3: Actualizar deps de los `useMemo` que usan `ANALISTA_COLORES`**

En el `useMemo` de `chartVentaDiaria` (el que arma Comparativa/individual), agregar `ANALISTA_COLORES` al array de dependencias.

- [ ] **Step 4: Verificar typecheck + smoke**

Run: `npx tsc --noEmit` → exit 0.
Smoke: en Ajustes › Resumen Mensual, los botones de filtro muestran los 4 analistas + Comparativa; la Comparativa dibuja una línea por analista con su color.

- [ ] **Step 5: Commit**

```bash
git add src/app/ajustes/ResumenMensualTab.tsx
git commit -m "feat: ResumenMensualTab con colores/filtros de analistas dinámicos"
```

---

## Task 6: analistas/page — lista dinámica + gate de incentivos por flag

**Files:**
- Modify: `src/app/analistas/page.tsx`

- [ ] **Step 1: Importar hook**

```ts
import { useAnalistas } from '@/features/settings/SettingsProvider';
```

Dentro del componente: `const { nombres: analistasDefault, cobraIncentivo } = useAnalistas();`

- [ ] **Step 2: Reemplazar `CONFIG.ANALISTAS_DEFAULT`**

Cambiar las 3 ocurrencias (`analistasParaMostrar` ~177, mapa de charts ~1036, opciones ~1232) de `CONFIG.ANALISTAS_DEFAULT` por `analistasDefault`. Verificar que los `useMemo` afectados incluyan `analistasDefault` en sus deps.

- [ ] **Step 3: Gate de incentivos por flag**

Reemplazar:

```ts
const analistasConIncentivo = ['luciana','victoria','juan pablo','yamil'];
const tieneIncentivo = analistasConIncentivo.includes(analista.toLowerCase());
```

por:

```ts
const tieneIncentivo = cobraIncentivo(analista);
```

- [ ] **Step 4: Verificar typecheck + smoke**

Run: `npx tsc --noEmit` → exit 0.
Smoke: la vista global muestra todos los analistas visibles; KPIs/incentivos coherentes.

- [ ] **Step 5: Commit**

```bash
git add src/app/analistas/page.tsx
git commit -m "feat: analistas/page dinámica + incentivos por flag"
```

---

## Task 7: Consumidores in-app restantes

Reemplazo mecánico uniforme: importar `useAnalistas`, obtener `const { nombres: analistasDefault } = useAnalistas();` y sustituir `CONFIG.ANALISTAS_DEFAULT` → `analistasDefault` (y la constante local `ANALISTAS` donde aplique). Quitar imports de `CONFIG` si quedan sin uso. Un archivo por step.

**Files:**
- Modify: `src/components/ExportXlsxModal.tsx` (const `ANALISTAS` → hook)
- Modify: `src/app/registros/page.tsx` (`ANALISTAS[0]` default + dropdowns 854, 2115)
- Modify: `src/app/ajustes/page.tsx` (202, 253, 778, 813, 953 + default `'Luciana'`)
- Modify: `src/app/ajustes/ResumenMensualView.tsx` (644)
- Modify: `src/app/ajustes/BulkModifyTab.tsx` (15, 568, 1185, 3515, 3765)
- Modify: `src/app/ajustes/AvisosTab.tsx` (74, 164)
- Modify: `src/app/proyeccion/page.tsx` (61, 80)
- Modify: `src/app/proyeccion/ProyeccionClient.tsx` (54)

- [ ] **Step 1: ExportXlsxModal** — reemplazar `const ANALISTAS = [...]` por hook; usar en el `CustomSelect`. `npx tsc --noEmit` → 0.
- [ ] **Step 2: registros/page** — default de nuevo registro: `analista: nombres[0] ?? ''`; dropdowns desde `nombres`. Nota: el default debe recalcularse cuando `nombres` carga (si el form inicializa con `''`, setear al primer visible al abrir el modal). `npx tsc --noEmit` → 0.
- [ ] **Step 3: ajustes/page** — `histAnalista` default = `nombres[0]`; `consultaAnalista` default = `nombres[0] ?? ''`; mapas 253/778/813/953 desde `analistasDefault`. `npx tsc --noEmit` → 0.
- [ ] **Step 4: ResumenMensualView** — 644 desde `analistasDefault`. `npx tsc --noEmit` → 0.
- [ ] **Step 5: BulkModifyTab** — `const ANALISTAS = analistasDefault` (desde hook dentro del componente, no module-scope); usos 568/1185/3515/3765. `npx tsc --noEmit` → 0.
- [ ] **Step 6: AvisosTab** — 74/164 desde `analistasDefault`. `npx tsc --noEmit` → 0.
- [ ] **Step 7: proyeccion/page + ProyeccionClient** — 61/80 y `['PDV', ...analistasDefault]`. `npx tsc --noEmit` → 0.
- [ ] **Step 8: Lint + commit**

```bash
npm run lint
git add -A
git commit -m "feat: consumidores in-app usan analistas dinámicos (hook)"
```

---

## Task 8: Componentes compartidos + link público

Los componentes `MetricasTab` y `SeccionGraficosResumen` se usan tanto in-app (con provider) como en `ResumenHTML` del público (sin provider). Reciben la lista por prop.

**Files:**
- Modify: `src/app/ajustes/MetricasTab.tsx`
- Modify: `src/app/ajustes/SeccionGraficosResumen.tsx` (solo si usa la lista de analistas; los colores por categoría NO se tocan)
- Modify: `src/app/publico/resumen-mensual/page.tsx`
- Modify: `src/app/publico/resumen-mensual/ResumenHTML.tsx`

- [ ] **Step 1: MetricasTab acepta prop `analistas`**

Agregar a sus props `analistas?: string[]`. Reemplazar `CONFIG.ANALISTAS_DEFAULT` (línea 134) por:

```ts
const analistasList = analistas ?? CONFIG.ANALISTAS_DEFAULT;
```

y usar `analistasList`. (El fallback a `CONFIG` cubre callers que aún no pasen la prop; los callers in-app la pasarán desde el hook.)

- [ ] **Step 2: Callers in-app pasan la prop**

En `ResumenMensualTab.tsx`, `ResumenMensualView.tsx` y `analistas/page.tsx` donde se renderiza `<MetricasTab .../>`, pasar `analistas={nombres}` desde `useAnalistas()`. `npx tsc --noEmit` → 0.

- [ ] **Step 3: page.tsx público hace fetch y pasa lista**

En `src/app/publico/resumen-mensual/page.tsx` (server), agregar el fetch:

```ts
const { data: analistasRows } = await supabase
  .from('analistas')
  .select('nombre,oculto,orden')
  .eq('oculto', false)
  .order('orden');
const analistasPublico = (analistasRows ?? []).map(a => a.nombre);
```

Pasar `analistasPublico` a `<ResumenHTML ... analistas={analistasPublico} />`.

- [ ] **Step 4: ResumenHTML threadea la prop**

`ResumenHTML` recibe `analistas: string[]` y lo pasa a `<MetricasTab analistas={analistas} ... />` (y a `SeccionGraficosResumen` si aplica). `npx tsc --noEmit` → 0.

- [ ] **Step 5: Smoke público**

`npm run dev` → abrir `/publico/resumen-mensual?...` y confirmar que muestra los mismos analistas visibles.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: componentes compartidos + link público con analistas dinámicos"
```

---

## Task 9: UI de gestión — AnalistasTab (alta / ocultar / eliminar)

**Files:**
- Create: `src/app/ajustes/AnalistasTab.tsx`
- Modify: `src/app/ajustes/page.tsx`

- [ ] **Step 1: Crear `AnalistasTab.tsx`**

Componente client que usa `useAnalistas()` + `supabase`. Estructura:

```tsx
'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { capitalizarTexto } from '@/lib/utils';
import { Analista } from '@/types';
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';

export default function AnalistasTab() {
  const { analistasAll, applyAnalistaChange } = useAnalistas();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [incentivo, setIncentivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const existe = (n: string) => analistasAll.some(a => a.nombre.toLowerCase() === n.toLowerCase());

  const agregar = async () => {
    const n = capitalizarTexto(nombre).trim();
    if (!n) { setError('Ingresá un nombre'); return; }
    if (existe(n)) { setError('Ya existe un analista con ese nombre'); return; }
    const orden = Math.max(0, ...analistasAll.map(a => a.orden)) + 1;
    const fila: Analista = { nombre: n, color, oculto: false, tiene_incentivo: incentivo, orden };
    const { data, error: e } = await supabase.from('analistas').insert(fila).select().single();
    if (e) { setError(e.message); return; }
    applyAnalistaChange('INSERT', data as Analista);
    setNombre(''); setColor('#6366f1'); setIncentivo(true); setError(null);
  };

  const toggleOculto = async (a: Analista) => {
    const next = { ...a, oculto: !a.oculto };
    const { error: e } = await supabase.from('analistas').update({ oculto: next.oculto }).eq('nombre', a.nombre);
    if (e) { setError(e.message); return; }
    applyAnalistaChange('UPDATE', next);
  };

  const eliminar = async (a: Analista) => {
    const { count } = await supabase.from('registros').select('id', { count: 'exact', head: true }).eq('analista', a.nombre);
    if ((count ?? 0) > 0) {
      setError(`"${a.nombre}" tiene ${count} registros. Ocultalo, o reasigná sus registros en Modificación Masiva antes de eliminar.`);
      return;
    }
    await supabase.from('objetivos').delete().eq('analista', a.nombre);
    await supabase.from('dias_habiles_config').delete().eq('analista', a.nombre);
    const { error: e } = await supabase.from('analistas').delete().eq('nombre', a.nombre);
    if (e) { setError(e.message); return; }
    applyAnalistaChange('DELETE', a);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Form de alta */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del analista" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)} title="Color" />
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={incentivo} onChange={e => setIncentivo(e.target.checked)} /> Cobra incentivos
        </label>
        <button onClick={agregar}><Plus size={16} /> Agregar</button>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {analistasAll.map(a => (
          <div key={a.nombre} style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: a.oculto ? 0.5 : 1 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: a.color }} />
            <span style={{ flex: 1 }}>{a.nombre}</span>
            {!a.tiene_incentivo && <span style={{ fontSize: 11, color: '#888' }}>Sin incentivo</span>}
            {a.oculto && <span style={{ fontSize: 11, color: '#888' }}>Oculto</span>}
            <button onClick={() => toggleOculto(a)} title={a.oculto ? 'Mostrar' : 'Ocultar'}>
              {a.oculto ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button onClick={() => eliminar(a)} title="Eliminar"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

(Ajustar estilos/clases a las del proyecto siguiendo el patrón visual de otras tabs de Ajustes; lo de arriba es funcionalmente completo.)

- [ ] **Step 2: Montar sub-tab en `ajustes/page.tsx`**

En el bloque de sub-tabs de "configuracion" (cerca de línea 686), agregar (solo admin):

```tsx
...(isAdmin ? [{ id: 'analistas' as const, label: 'Analistas', icon: Users }] : []),
```

Agregar `'analistas'` al tipo del estado `configSubTab` y, donde se renderiza el contenido de cada `configSubTab`, agregar:

```tsx
{activeTab === 'configuracion' && configSubTab === 'analistas' && isAdmin && <AnalistasTab />}
```

Importar: `import AnalistasTab from './AnalistasTab';` (y `Users` de lucide si no está importado).

- [ ] **Step 3: Verificar typecheck + lint**

Run: `npx tsc --noEmit` → exit 0. `npm run lint` → sin errores nuevos.

- [ ] **Step 4: Smoke completo**

`npm run dev` como admin:
1. Ajustes › Configuración › Analistas: agregar "Test" con color → aparece en sidebar, dropdowns, charts y Comparativa al instante.
2. Ocultar "Test" → desaparece de UI activa; un registro viejo suyo seguiría sumando al total PDV.
3. Eliminar "Test" (sin registros) → se borra. Crear un registro para otro analista y probar que eliminar ese se bloquea con el mensaje.

- [ ] **Step 5: Commit**

```bash
git add src/app/ajustes/AnalistasTab.tsx src/app/ajustes/page.tsx
git commit -m "feat: UI de gestión de analistas (alta/ocultar/eliminar) en Ajustes"
```

---

## Task 10: Verificación final

- [ ] **Step 1: Typecheck + lint + build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: los tres sin errores.

- [ ] **Step 2: Grep de residuos**

Run: `grep -rn "CONFIG.ANALISTAS_DEFAULT" src/ ; grep -rn "= \['Luciana'" src/`
Expected: solo aparece `CONFIG.ANALISTAS_DEFAULT` como fallback en `MetricasTab` (y la definición en `types`). Ningún nav/dropdown/chart con nombres hardcodeados.

- [ ] **Step 3: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: verificación final analistas dinámicos"
```

---

## Notas de parità (checklist de equivalencia)

Un analista creado debe aparecer automáticamente e idéntico en: sidebar (Registros + Reportes›Ventas), dropdown de filtro, modal de alta de registro, ExportXlsx, BulkModify, Avisos, página Analistas (KPIs/metas/proyección/incentivos/charts), Resumen Mensual (tab/vista/Comparativa con su color), proyección y link público. Como todo deriva del mismo hook, la equivalencia es estructural.
