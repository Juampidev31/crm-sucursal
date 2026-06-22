# Vista consolidada de proyectados (PDV · Luciana · Victoria) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un modo admin-only en el reporte Analistas que muestre los proyectados de PDV, Luciana y Victoria juntos en una sola pantalla.

**Architecture:** Se reutiliza la data ya calculada (`kpiTotal` + `kpiPorAnalista`). Se extrae el bloque de proyección inline a un componente presentacional `ProyeccionCard`, y se agrega un valor de selector `'PROYECTADOS'` que se comporta como `'PDV'` a nivel datos pero renderiza un grid de 3 cards.

**Tech Stack:** Next.js (App Router), React client component, TypeScript, estilos inline (patrón existente del archivo).

**Verificación:** No hay framework de tests en el repo (sin jest/vitest). Cada tarea se valida con `npm run build` (typecheck de TS/Next) y chequeo visual en `npm run dev`.

---

## File Structure

- `src/app/analistas/ProyeccionCard.tsx` — **nuevo**. Componente presentacional puro: recibe un kpi + título y pinta el bloque de proyección/ritmo. Una sola responsabilidad.
- `src/app/analistas/page.tsx` — **modificar**. Nuevo modo `'PROYECTADOS'`, opción condicional en el selector, render del grid consolidado, y refactor del bloque inline para consumir `ProyeccionCard`.

---

### Task 1: Crear `ProyeccionCard` con la forma del kpi y extraer el markup inline

**Files:**
- Create: `src/app/analistas/ProyeccionCard.tsx`
- Reference (no modificar todavía): `src/app/analistas/page.tsx:1340-1424`

- [ ] **Step 1: Crear el componente**

Crear `src/app/analistas/ProyeccionCard.tsx` con el contenido exacto del bloque inline, parametrizado. La prop `kpi` es un subconjunto de lo que devuelven `kpiTotal`/`kpiPorAnalista`.

```tsx
'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';

export interface ProyeccionKpi {
  metaDiariaCapital: number | null;
  ventaPorDia: number | null;
  metaDiariaOps: number | null;
  opsPorDia: number | null;
  proyCapital: number | null;
  cumplProyCapital: number | null;
  proyOps: number | null;
  cumplProyOps: number | null;
  faltaCapital: number | null;
  faltaOps: number | null;
  metaCapital: number;
  metaOps: number;
  esMesActual: boolean;
  tieneDiasAdmin: boolean;
}

const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 };
const valueStyle: React.CSSProperties = { fontSize: 20, fontWeight: 900, color: '#fff' };
const ritmoStyle: React.CSSProperties = { fontSize: 10, color: '#555', fontWeight: 700, marginTop: 4 };
const divider: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,0.04)' };

export default function ProyeccionCard({ kpi, titulo }: { kpi: ProyeccionKpi; titulo: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 24, border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>{titulo}</div>
      {kpi.esMesActual && !kpi.tieneDiasAdmin ? (
        <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Cargá días hábiles en Ajustes para ver proyección
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              {kpi.metaDiariaCapital !== null && (
                <>
                  <div style={labelStyle}>Venta / día ({kpi.esMesActual ? 'Necesario' : 'Meta'})</div>
                  <div style={valueStyle}>{formatCurrency(kpi.metaDiariaCapital)}</div>
                  {kpi.ventaPorDia !== null && <div style={ritmoStyle}>RITMO: {formatCurrency(kpi.ventaPorDia)}</div>}
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {kpi.metaDiariaOps !== null && (
                <>
                  <div style={labelStyle}>Ops. / día ({kpi.esMesActual ? 'Necesario' : 'Meta'})</div>
                  <div style={valueStyle}>{Math.round(kpi.metaDiariaOps)}</div>
                  {kpi.opsPorDia !== null && <div style={ritmoStyle}>RITMO: {Math.round(kpi.opsPorDia)}</div>}
                </>
              )}
            </div>
          </div>

          <div style={divider} />

          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              {kpi.proyCapital !== null && (
                <>
                  <div style={labelStyle}>{kpi.esMesActual ? 'Proy. fin mes (K)' : 'Final mes (K)'}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ ...valueStyle, color: kpi.proyCapital >= kpi.metaCapital ? '#10b981' : '#f87171' }}>{formatCurrency(kpi.proyCapital)}</div>
                    {kpi.cumplProyCapital !== null && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: kpi.cumplProyCapital >= 100 ? '#10b981' : '#f87171' }}>({kpi.cumplProyCapital.toFixed(2)}%)</span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {kpi.proyOps !== null && (
                <>
                  <div style={labelStyle}>{kpi.esMesActual ? 'Proy. fin mes (Q)' : 'Final mes (Q)'}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ ...valueStyle, color: kpi.proyOps >= kpi.metaOps ? '#10b981' : '#f87171' }}>{Math.round(kpi.proyOps)}</div>
                    {kpi.cumplProyOps !== null && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: kpi.cumplProyOps >= 100 ? '#10b981' : '#f87171' }}>({kpi.cumplProyOps.toFixed(2)}%)</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={divider} />

          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              {kpi.faltaCapital !== null && (
                <>
                  <div style={labelStyle}>Falta 100% (K)</div>
                  <div style={{ ...valueStyle, color: kpi.faltaCapital === 0 ? '#10b981' : '#f87171' }}>{formatCurrency(kpi.faltaCapital)}</div>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {kpi.faltaOps !== null && (
                <>
                  <div style={labelStyle}>Falta 100% (Q)</div>
                  <div style={{ ...valueStyle, color: kpi.faltaOps === 0 ? '#10b981' : '#f87171' }}>{Math.round(kpi.faltaOps || 0)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run build`
Expected: build OK, sin errores de TS sobre `ProyeccionCard.tsx`. (El componente todavía no se usa; solo valida que compila.)

- [ ] **Step 3: Commit**

```bash
git add src/app/analistas/ProyeccionCard.tsx
git commit -m "feat: ProyeccionCard presentacional (extrae bloque proyeccion)"
```

---

### Task 2: Tratar `'PROYECTADOS'` como `'PDV'` en la capa de datos

**Files:**
- Modify: `src/app/analistas/page.tsx`

El objetivo es que cuando `analista === 'PROYECTADOS'`, los memos de datos se comporten igual que en `'PDV'`, de modo que `kpiTotal` y `kpiPorAnalista` queden poblados con los 3. Se introduce un flag derivado `esVistaGlobal` y se reemplazan las comparaciones `analista === 'PDV'` que afectan **datos** (no el render de gráficos individuales).

- [ ] **Step 1: Agregar flag derivado**

En `AnalistasPage`, justo después de `const chartsLoaded = useDeferredMount();` (línea ~169), agregar:

```tsx
  const esVistaGlobal = analista === 'PDV' || analista === 'PROYECTADOS';
```

- [ ] **Step 2: Usar el flag en los memos de datos**

Reemplazar estas referencias (todas dentro de memos de datos):

- Línea ~172 (`registros`):
```tsx
  const registros = useMemo(() => {
    return esVistaGlobal ? allRegistros : allRegistros.filter(r => r.analista === analista);
  }, [allRegistros, analista, esVistaGlobal]);
```

- Línea ~175 (`analistasParaMostrar`):
```tsx
  const analistasParaMostrar = esVistaGlobal ? CONFIG.ANALISTAS_DEFAULT : [analista];
```

- En `kpiTotal`, línea ~502 (`cfgDias`):
```tsx
    const cfgDias = esVistaGlobal
      ? diasConfig.find(d => d.analista === 'Todos')
      : diasConfig.find(d => d.analista === analista);
```

- En `kpiCards`, línea ~759:
```tsx
  const kpiCards = useMemo(
    () => (esVistaGlobal ? [kpiTotal] : kpiPorAnalista),
    [esVistaGlobal, kpiTotal, kpiPorAnalista]
  );
```

> Nota: NO cambiar las comparaciones `analista === 'PDV'` dentro de los `chart*` memos ni en los `baseChartOpts(..., analista !== 'PDV')` de render. En modo `'PROYECTADOS'` esos gráficos no se muestran (Task 3), así que mantenerlos como están evita efectos colaterales.

- [ ] **Step 3: Verificar typecheck**

Run: `npm run build`
Expected: build OK. El comportamiento visible aún no cambia (no hay opción de selector todavía).

- [ ] **Step 4: Commit**

```bash
git add src/app/analistas/page.tsx
git commit -m "refactor: esVistaGlobal cubre PDV y PROYECTADOS en capa de datos"
```

---

### Task 3: Agregar opción admin al selector y render del grid consolidado

**Files:**
- Modify: `src/app/analistas/page.tsx`

- [ ] **Step 1: Importar `ProyeccionCard`**

Junto a los imports de componentes (después de la línea ~23 `import DistBlock ...`):

```tsx
import ProyeccionCard from './ProyeccionCard';
```

- [ ] **Step 2: Agregar la opción condicional en el selector de analista**

En el `CustomSelect` de analista (línea ~1158), reemplazar la prop `options`:

```tsx
              options={[
                { label: 'PDV', value: 'PDV' },
                ...CONFIG.ANALISTAS_DEFAULT.map(a => ({ label: a, value: a })),
                ...(isAdmin ? [{ label: '📊 Proyectados', value: 'PROYECTADOS' }] : []),
              ]}
```

- [ ] **Step 3: Renderizar el grid consolidado y ocultar el dashboard normal**

El cuerpo del dashboard (todo lo que sigue al header de selectores) debe mostrarse solo cuando NO estamos en modo proyectados. Envolver el render consolidado y el dashboard existente.

Localizar el cierre del bloque de selectores (el `</div>` que cierra la fila de los 3 `CustomSelect`, alrededor de la línea ~1172) e insertar inmediatamente después:

```tsx
            {analista === 'PROYECTADOS' && isAdmin ? (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'stretch' }}>
                {[{ kpi: kpiTotal, titulo: 'PDV (Total General)' }, ...kpiPorAnalista.map(k => ({ kpi: k, titulo: k.analista }))].map(({ kpi, titulo }) => (
                  <ProyeccionCard key={titulo} kpi={kpi} titulo={titulo} />
                ))}
              </div>
            ) : (
```

Y cerrar el ternario `)}` justo antes del cierre del contenedor del dashboard (el `</div>` de más alto nivel del return, antes del cierre del componente). Identificarlo abriendo el archivo y ubicando el último `</div>` antes de `);` final del `return`.

> Importante: el contenido existente del dashboard queda como rama `else` del ternario, sin modificar su markup interno.

- [ ] **Step 4: Verificar typecheck**

Run: `npm run build`
Expected: build OK. Si falla por desbalance de JSX, revisar que el `(` de apertura del ternario y el `)}` de cierre envuelvan exactamente el dashboard previo.

- [ ] **Step 5: Verificación visual**

Run: `npm run dev` y abrir el reporte Analistas como admin.
Expected:
- El selector muestra `📊 Proyectados` (solo admin).
- Al elegirlo se ven 3 cards (PDV, Luciana, Victoria) con Venta/día, Ops/día, Proy. fin mes K/Q con % y Falta 100% K/Q.
- Cambiar a PDV/Luciana/Victoria vuelve a mostrar el dashboard normal sin cambios.

- [ ] **Step 6: Commit**

```bash
git add src/app/analistas/page.tsx
git commit -m "feat: vista admin Proyectados con PDV/Luciana/Victoria juntos"
```

---

### Task 4: Refactor del bloque inline de PDV para consumir `ProyeccionCard` (DRY)

**Files:**
- Modify: `src/app/analistas/page.tsx:1340-1424`

Eliminar la duplicación: el bloque de proyección inline de la vista PDV (líneas ~1340-1424) se reemplaza por un único `ProyeccionCard`.

- [ ] **Step 1: Reemplazar el markup inline**

Sustituir todo el bloque `{/* ── BLOQUE DE PROYECCIÓN ── */}` (desde el `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' ...` hasta su `</div>` de cierre) por:

```tsx
                {/* ── BLOQUE DE PROYECCIÓN ── */}
                <div style={{ marginTop: 12 }}>
                  <ProyeccionCard kpi={kpiTotal} titulo={analista === 'PDV' ? 'Proyección' : analista} />
                </div>
```

> Si el bloque inline mostraba campos extra no incluidos en `ProyeccionCard`, NO eliminarlos: dejarlos fuera del reemplazo. Confirmar visualmente que el contenido coincide con el de Task 1 (Venta/día, Ops/día, Proy K/Q, Falta K/Q).

- [ ] **Step 2: Verificar typecheck**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Verificación visual**

Run: `npm run dev`
Expected: la vista PDV (y Luciana/Victoria) muestra el bloque de proyección idéntico al anterior, ahora vía `ProyeccionCard`.

- [ ] **Step 4: Commit**

```bash
git add src/app/analistas/page.tsx
git commit -m "refactor: vista PDV reutiliza ProyeccionCard (DRY)"
```

---

## Self-Review

- **Cobertura del spec:**
  - Modo admin-only `'PROYECTADOS'` → Task 2 (datos) + Task 3 (selector condicional `isAdmin` + render `isAdmin`).
  - 3 cards PDV·Luciana·Victoria, nivel "proyección + ritmo" → Task 3 usa `[kpiTotal, ...kpiPorAnalista]`.
  - `ProyeccionCard` reutilizable → Task 1 (creación) + Task 4 (consumo en PDV).
  - Sin export/link/cambios de datos → ninguna tarea los toca.
  - Guarda contra query param `?analista=PROYECTADOS` → Task 3 Step 3 (`&& isAdmin` en el render).
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `ProyeccionKpi` (Task 1) es un subconjunto estructural de lo que devuelven `kpiTotal`/`kpiPorAnalista` (verificado contra `page.tsx:434-447` y `551-565`); `kpiPorAnalista` incluye `analista`, usado como título en Task 3.

---

**Nota:** No existe framework de tests en el repo; la verificación es `npm run build` (typecheck) + chequeo visual con `npm run dev`. No se inventa harness de tests para una capa puramente presentacional.
