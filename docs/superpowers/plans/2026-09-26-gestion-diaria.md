# Gestión diaria (reemplazo de Apps Script "Gestiones VICTORIA/MAGALI") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el sistema de Google Apps Script + Sheets ("Ingreso Diario Ventas") que hoy usan Victoria y Magali por un módulo nuevo dentro de `next-ventas`: tabla Supabase, CRUD con los mismos campos, mismos KPIs, y migración del histórico de Victoria.

**Architecture:** Tabla Supabase `gestion_diaria` (una fila por gestión diaria, columna `analista` para generalizar) → `GestionDiariaProvider` (mismo patrón que `RegistrosProvider`: fetch paginado + realtime + broadcast) → página `/gestion-diaria` con tabla, filtros, KPIs y modal de alta/edición que replica el formulario del Apps Script. Entrada propia en el sidebar con un botón por analista (no un filtro dentro de "Registros").

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase (Postgres + Realtime), zod.

**Verificación:** El proyecto no tiene runner de tests (solo `lint` y `build`). Cada tarea se verifica con `npx tsc --noEmit`, `npm run lint` y smoke manual en `npm run dev` (ya corriendo en `localhost:3000`). La tabla se crea directamente contra el Supabase del proyecto (`cnjqjvqgmclwkuswjzzf`, el mismo de `.env.local`) vía el SQL Editor del dashboard — no hay Supabase local en este repo.

**Spec:** `docs/superpowers/specs/2026-09-26-gestion-diaria-design.md`

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| Supabase (dashboard, proyecto `cnjqjvqgmclwkuswjzzf`) | Tabla `gestion_diaria` + índices | Crear (SQL Editor) |
| `supabase-schema.sql` | Mantener el DDL versionado junto al resto del schema | Modificar |
| `src/types/index.ts` | Tipo `GestionDiaria` + `gestionDiariaSchema` + listas de opciones | Modificar |
| `src/components/PremiumSelect.tsx` | Extraído de `registros/page.tsx` (reutilizable) | Crear |
| `src/components/CorporateDatePicker.tsx` | Extraído de `registros/page.tsx` (reutilizable) | Crear |
| `src/app/registros/page.tsx` | Usa los componentes extraídos en vez de las copias locales | Modificar |
| `src/features/gestion-diaria/GestionDiariaProvider.tsx` | Fetch + realtime + broadcast de `gestion_diaria` | Crear |
| `src/app/gestion-diaria/page.tsx` | Route (server) | Crear |
| `src/app/gestion-diaria/GestionDiariaClient.tsx` | KPIs + filtros + tabla + modal alta/edición | Crear |
| `src/components/Sidebar.tsx` | Nuevo ítem "Gestión diaria" con flyout por analista | Modificar |
| `src/app/layout.tsx` | Montar `GestionDiariaProvider` junto a los demás providers | Modificar |
| `scripts/migrar-gestion-diaria.mjs` | Migración one-off del CSV histórico de Victoria | Crear |

---

## Task 1: Tabla Supabase `gestion_diaria`

**Files:**
- Modify: `supabase-schema.sql` (agregar al final, antes de los triggers de `registros`)
- Ejecutar en: Supabase SQL Editor del proyecto `cnjqjvqgmclwkuswjzzf`

- [ ] **Step 1: Agregar el DDL a `supabase-schema.sql`**

```sql
-- ============================================
-- TABLA: gestion_diaria (Ingreso Diario Ventas — Victoria/Magali)
-- ============================================
CREATE TABLE IF NOT EXISTS gestion_diaria (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analista            TEXT NOT NULL,
  tipo_cliente        TEXT NOT NULL DEFAULT '',
  fecha               DATE,
  nombre              TEXT NOT NULL DEFAULT '',
  cuil                TEXT NOT NULL DEFAULT '',
  actividad           TEXT DEFAULT '',
  donde_nos_conocio   TEXT DEFAULT '',
  estado              TEXT DEFAULT '',
  score               INTEGER,
  tipo_operacion      TEXT DEFAULT '',
  monto_otorgado      NUMERIC(15,2) DEFAULT 0,
  capital_x_venta     NUMERIC(15,2),
  interes_x_venta     NUMERIC(15,2),
  comentarios         TEXT DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestion_diaria_analista ON gestion_diaria (analista);
CREATE INDEX IF NOT EXISTS idx_gestion_diaria_fecha ON gestion_diaria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gestion_diaria_cuil ON gestion_diaria (cuil);
CREATE INDEX IF NOT EXISTS idx_gestion_diaria_estado ON gestion_diaria (estado);

CREATE TRIGGER trigger_gestion_diaria_updated_at
  BEFORE UPDATE ON gestion_diaria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

(`update_updated_at()` ya existe en el schema — no se duplica.)

- [ ] **Step 2: Aplicar en Supabase (dashboard, proyecto `cnjqjvqgmclwkuswjzzf`)**

Abrir `https://supabase.com/dashboard/project/cnjqjvqgmclwkuswjzzf/sql/new`, pegar el bloque del Step 1 y ejecutar.
Verificar: `select * from gestion_diaria limit 1;` → devuelve 0 filas sin error.

- [ ] **Step 3: Commit**

```bash
git add supabase-schema.sql
git commit -m "feat(db): tabla gestion_diaria (reemplazo de Apps Script Ingreso Diario Ventas)"
```

---

## Task 2: Tipo `GestionDiaria`, schema zod y listas de opciones

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Agregar el schema, junto a los otros (cerca de `bitacoraNotaSchema`)**

```ts
export const gestionDiariaSchema = z.object({
  id: z.string(),
  analista: z.string(),
  tipo_cliente: z.string().nullish().transform(v => v ?? ''),
  fecha: z.string().nullable(),
  nombre: z.string().nullish().transform(v => v ?? ''),
  cuil: z.string().nullish().transform(v => v ?? ''),
  actividad: z.string().nullish().transform(v => v ?? ''),
  donde_nos_conocio: z.string().nullish().transform(v => v ?? ''),
  estado: z.string().nullish().transform(v => v ?? ''),
  score: z.coerce.number().nullish().transform(v => v ?? null),
  tipo_operacion: z.string().nullish().transform(v => v ?? ''),
  monto_otorgado: z.coerce.number().nullish().transform(v => v ?? 0),
  capital_x_venta: z.coerce.number().nullish().transform(v => v ?? null),
  interes_x_venta: z.coerce.number().nullish().transform(v => v ?? null),
  comentarios: z.string().nullish().transform(v => v ?? ''),
  created_at: z.string().nullish().transform(v => v ?? undefined),
  updated_at: z.string().nullish().transform(v => v ?? undefined),
});

export type GestionDiaria = z.infer<typeof gestionDiariaSchema>;

// Opciones vigentes del formulario (fuente: dropdowns actuales del Apps Script
// + valores limpios del histórico). Cada campo admite "agregar otro" en la UI.
export const GESTION_DIARIA_OPCIONES = {
  tipoCliente: ['Proyeccion 0', 'Tramo 1-29', 'Cetrogar', 'Cancelacion', 'Refinanciaciones', 'Referido', 'Jubilado', 'Centric', 'Ingreso', 'Virtual'],
  actividad: ['Empleado Privado', 'Empleado Publico', 'Jubilado', 'Sin ingresos Fijos', 'Pensionado', 'Monotributista', 'Emp. Domestica', 'Retirado', 'Sin datos'],
  dondeNosConocio: ['Gestion Whatsapp', 'Paso por el local', 'Centric', 'Whatsapp (No Ingreso a Suc)', 'Consulta virtual', 'Consulta en sucursal', 'Referido', 'Referido Con consulta', 'Flyers'],
  estado: ['Aprobado', 'Rechazado', 'Falta Documentacion', 'No califica', 'Califica', 'Sueldo bajo'],
  tipoOperacion: ['Apertura', 'Renovacion'],
} as const;
```

(`z` ya está importado al tope del archivo.)

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: tipo GestionDiaria, schema zod y opciones de dropdowns"
```

---

## Task 3: Extraer `PremiumSelect` y `CorporateDatePicker` a componentes compartidos

Hoy viven como componentes privados dentro de `src/app/registros/page.tsx` (líneas ~366–664 y ~666–731 respectivamente). La página nueva los necesita igual — extraerlos evita duplicar ~360 líneas de lógica de dropdown/calendario.

**Files:**
- Create: `src/components/PremiumSelect.tsx`
- Create: `src/components/CorporateDatePicker.tsx`
- Modify: `src/app/registros/page.tsx`

- [ ] **Step 1: Crear `src/components/PremiumSelect.tsx`**

Cortar el bloque completo del componente `PremiumSelect` (`const PremiumSelect = (...) => { ... };`, líneas ~366–664 de `registros/page.tsx`) y pegarlo en el archivo nuevo. Encabezado:

```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';

export const PremiumSelect = ({
  // ...exactamente el mismo cuerpo que hoy tiene en registros/page.tsx...
```

Al final del archivo, exportar también el tipo de props si `registros/page.tsx` lo necesitaba tipado explícito (no lo tenía — se infiere igual).

- [ ] **Step 2: Crear `src/components/CorporateDatePicker.tsx`**

Cortar el bloque `const CorporateDatePicker = memo((...) => {...})` (líneas ~666–731) al archivo nuevo:

```tsx
'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const CorporateDatePicker = memo(({ value, onChange, compact = false, placeholder = 'Seleccionar fecha' }: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}) => {
  // ...mismo cuerpo...
});
CorporateDatePicker.displayName = 'CorporateDatePicker';
```

- [ ] **Step 3: Actualizar `registros/page.tsx`**

Borrar las dos definiciones locales (los bloques cortados en los steps 1 y 2) y agregar el import:

```ts
import { PremiumSelect } from '@/components/PremiumSelect';
import { CorporateDatePicker } from '@/components/CorporateDatePicker';
```

Quitar del import de `lucide-react` en `registros/page.tsx` los íconos que solo usaban esos dos componentes y que queden sin uso (`Search`, `ChevronDown` pueden seguir usándose en otros lados del archivo — verificar con el compilador antes de sacarlos, no a ciegas).

- [ ] **Step 4: Verificar typecheck + lint + smoke**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run lint` → sin errores nuevos.
Smoke: `/registros` sigue abriendo el modal "Nuevo registro" con los mismos selects y el date picker funcionando igual que antes.

- [ ] **Step 5: Commit**

```bash
git add src/components/PremiumSelect.tsx src/components/CorporateDatePicker.tsx src/app/registros/page.tsx
git commit -m "refactor: extraer PremiumSelect y CorporateDatePicker a componentes compartidos"
```

---

## Task 4: `GestionDiariaProvider`

**Files:**
- Create: `src/features/gestion-diaria/GestionDiariaProvider.tsx`

- [ ] **Step 1: Crear el provider (mismo patrón que `RegistrosProvider`, sin paginación por chunks porque el volumen esperado —histórico + 2 analistas— es de pocos miles de filas, muy por debajo del límite de 1000 filas de una sola query; si crece, se agrega paginación después — YAGNI)**

```tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { GestionDiaria, parseRows, gestionDiariaSchema } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface GestionDiariaCtx {
  registros: GestionDiaria[];
  loading: boolean;
  applyChange: (type: ChangeType, registro: GestionDiaria) => void;
  refresh: () => void;
  pushChange: (type: ChangeType, registro: GestionDiaria) => void;
}

const GestionDiariaContext = createContext<GestionDiariaCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const changeSchema = z.object({ type: changeType, registro: gestionDiariaSchema });

const COLS = 'id,analista,tipo_cliente,fecha,nombre,cuil,actividad,donde_nos_conocio,estado,score,tipo_operacion,monto_otorgado,capital_x_venta,interes_x_venta,comentarios,created_at,updated_at';

export function GestionDiariaProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [registros, setRegistros] = useState<GestionDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const myId = ++refreshIdRef.current;
    setLoading(true);
    const { data, error } = await supabase
      .from('gestion_diaria')
      .select(COLS)
      .order('fecha', { ascending: false })
      .limit(5000);
    if (refreshIdRef.current !== myId) return;
    if (error) {
      reportError('refresh:gestion_diaria', error);
      setLoading(false);
      return;
    }
    let dropped = 0;
    const parsed = parseRows<GestionDiaria>(gestionDiariaSchema, data ?? [], (i, err, row) => {
      dropped++;
      const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
      console.warn(`[GestionDiariaProvider] fila inválida [${i}] id=${rowId}:`, err.issues);
    });
    setRegistros(parsed);
    setLoading(false);
    if (dropped > 0) reportError('refresh:gestion_diaria', { message: `${dropped} fila(s) descartada(s) por validación — revisá consola` });
  }, [reportError]);

  useEffect(() => { refresh(); }, [refresh]);

  const applyChange = useCallback((type: ChangeType, reg: GestionDiaria) => {
    setRegistros(prev => {
      if (type === 'DELETE') return prev.filter(r => r.id !== reg.id);
      const idx = prev.findIndex(r => r.id === reg.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = reg; return next; }
      return [reg, ...prev];
    });
  }, []);

  const applyChangeRef = useRef(applyChange);
  useEffect(() => { applyChangeRef.current = applyChange; }, [applyChange]);

  useEffect(() => {
    const channel = supabase
      .channel('gestion-diaria-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gestion_diaria' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const parsed = gestionDiariaSchema.safeParse(payload.new);
          if (parsed.success) applyChangeRef.current(payload.eventType, parsed.data);
        } else if (payload.eventType === 'DELETE') {
          const parsed = gestionDiariaSchema.safeParse(payload.old);
          if (parsed.success) applyChangeRef.current('DELETE', parsed.data);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const channelRef = useRealtimeBroadcast('gestion-diaria-updates', {
    update: (payload) => {
      const data = validateBroadcast('update', changeSchema, payload);
      if (data) applyChange(data.type, data.registro);
    },
  });

  const pushChange = useCallback((type: ChangeType, registro: GestionDiaria) => {
    channelRef.current?.send({ type: 'broadcast', event: 'update', payload: { type, registro } });
  }, [channelRef]);

  const value = useMemo(() => ({ registros, loading, applyChange, refresh, pushChange }), [registros, loading, applyChange, refresh, pushChange]);

  return <GestionDiariaContext.Provider value={value}>{children}</GestionDiariaContext.Provider>;
}

export function useGestionDiaria() {
  const ctx = useContext(GestionDiariaContext);
  if (!ctx) throw new Error('useGestionDiaria must be used within GestionDiariaProvider');
  return ctx;
}
```

- [ ] **Step 2: Montar el provider en `src/app/layout.tsx`**

Ubicar dónde se monta `RegistrosProvider` y envolver con `GestionDiariaProvider` al mismo nivel (mismo orden relativo, como hermano):

```tsx
import { GestionDiariaProvider } from '@/features/gestion-diaria/GestionDiariaProvider';
```

y en el árbol de providers, agregar `<GestionDiariaProvider>{...}</GestionDiariaProvider>` envolviendo lo mismo que ya envuelve `RegistrosProvider` (mismo nivel, no anidado adentro de él — son independientes).

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/gestion-diaria/GestionDiariaProvider.tsx src/app/layout.tsx
git commit -m "feat: GestionDiariaProvider (fetch + realtime de gestion_diaria)"
```

---

## Task 5: Página `/gestion-diaria` — KPIs, filtros, tabla y modal de alta/edición

**Files:**
- Create: `src/app/gestion-diaria/page.tsx`
- Create: `src/app/gestion-diaria/GestionDiariaClient.tsx`

- [ ] **Step 1: `page.tsx` (server, solo lee `?analista=`)**

```tsx
import GestionDiariaClient from './GestionDiariaClient';

type SearchParams = Promise<{ analista?: string }>;

export default async function GestionDiariaPage({ searchParams }: { searchParams: SearchParams }) {
  const { analista } = await searchParams;
  return <GestionDiariaClient analistaInicial={analista ?? ''} />;
}
```

- [ ] **Step 2: `GestionDiariaClient.tsx` — esqueleto, estado y KPIs**

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGestionDiaria } from '@/features/gestion-diaria/GestionDiariaProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { GestionDiaria, GESTION_DIARIA_OPCIONES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PremiumSelect } from '@/components/PremiumSelect';
import { CorporateDatePicker } from '@/components/CorporateDatePicker';
import { Plus, Search } from 'lucide-react';

const initialForm: Partial<GestionDiaria> = {
  tipo_cliente: '', fecha: '', nombre: '', cuil: '', actividad: '',
  donde_nos_conocio: '', estado: '', score: undefined, tipo_operacion: '',
  monto_otorgado: undefined, capital_x_venta: undefined, interes_x_venta: undefined,
  comentarios: '',
};

export default function GestionDiariaClient({ analistaInicial }: { analistaInicial: string }) {
  const { registros, loading, applyChange, pushChange } = useGestionDiaria();
  const { nombres: analistaNombres } = useAnalistas();
  const [analista, setAnalista] = useState(analistaInicial || analistaNombres[0] || '');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoCliente, setTipoCliente] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<GestionDiaria>>(initialForm);
  const [saving, setSaving] = useState(false);

  const filtrados = useMemo(() => {
    return registros.filter(r => {
      if (analista && r.analista !== analista) return false;
      if (fechaDesde && (!r.fecha || r.fecha < fechaDesde)) return false;
      if (fechaHasta && (!r.fecha || r.fecha > fechaHasta)) return false;
      if (tipoCliente && r.tipo_cliente !== tipoCliente) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const matches = r.nombre.toLowerCase().includes(q) || r.cuil.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [registros, analista, fechaDesde, fechaHasta, tipoCliente, busqueda]);

  const kpis = useMemo(() => {
    const montoOtorgado = filtrados.reduce((s, r) => s + (r.monto_otorgado || 0), 0);
    const interesXVenta = filtrados.reduce((s, r) => s + (r.interes_x_venta || 0), 0);
    const aperturas = filtrados.filter(r => r.tipo_operacion === 'Apertura').length;
    const renovaciones = filtrados.filter(r => r.tipo_operacion === 'Renovacion').length;
    const aprobados = filtrados.filter(r => r.estado === 'Aprobado').length;
    const productividad = filtrados.length > 0 ? (aprobados / filtrados.length) * 100 : 0;
    return { montoOtorgado, interesXVenta, aperturas, renovaciones, productividad };
  }, [filtrados]);

  const abrirNuevo = () => { setEditingId(null); setForm({ ...initialForm, fecha: new Date().toISOString().slice(0, 10) }); setModalOpen(true); };
  const abrirEdicion = (r: GestionDiaria) => { setEditingId(r.id); setForm(r); setModalOpen(true); };

  const guardar = async () => {
    if (!form.tipo_cliente || !form.nombre?.trim() || !form.cuil?.trim()) return;
    setSaving(true);
    const payload = { ...form, analista };
    if (editingId) {
      const { data, error } = await supabase.from('gestion_diaria').update(payload).eq('id', editingId).select().single();
      setSaving(false);
      if (error) return;
      applyChange('UPDATE', data as GestionDiaria);
      pushChange('UPDATE', data as GestionDiaria);
    } else {
      const { data, error } = await supabase.from('gestion_diaria').insert(payload).select().single();
      setSaving(false);
      if (error) return;
      applyChange('INSERT', data as GestionDiaria);
      pushChange('INSERT', data as GestionDiaria);
    }
    setModalOpen(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Monto otorgado" value={formatCurrency(kpis.montoOtorgado)} />
        <KpiCard label="(I) x Venta" value={formatCurrency(kpis.interesXVenta)} />
        <KpiCard label="Productividad" value={`${kpis.productividad.toFixed(2)}%`} highlight />
        <KpiCard label="Aperturas" value={String(kpis.aperturas)} />
        <KpiCard label="Renovaciones" value={String(kpis.renovaciones)} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11 }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente o CUIL..." className="form-input" style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <CorporateDatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" compact />
        <CorporateDatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" compact />
        <div style={{ width: 200 }}>
          <PremiumSelect value={tipoCliente} onChange={setTipoCliente} options={[...GESTION_DIARIA_OPCIONES.tipoCliente]} placeholder="Tipo de cliente" isSearchable />
        </div>
        <button onClick={abrirNuevo} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Agregar registro
        </button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Tipo cliente</th><th>Fecha</th><th>Cliente</th><th>CUIL</th>
              <th>Actividad</th><th>Estado</th><th>Score</th><th>Ap/Ren</th>
              <th>Monto otorgado</th><th>(I) x Venta</th><th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(r => (
              <tr key={r.id} onClick={() => abrirEdicion(r)} style={{ cursor: 'pointer' }}>
                <td>{r.tipo_cliente}</td>
                <td>{r.fecha ? formatDate(r.fecha) : ''}</td>
                <td>{r.nombre}</td>
                <td>{r.cuil}</td>
                <td>{r.actividad}</td>
                <td>{r.estado}</td>
                <td>{r.score ?? ''}</td>
                <td>{r.tipo_operacion}</td>
                <td>{formatCurrency(r.monto_otorgado)}</td>
                <td>{r.interes_x_venta != null ? formatCurrency(r.interes_x_venta) : ''}</td>
                <td>{r.comentarios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <GestionDiariaModal
          form={form}
          setForm={setForm}
          onCancel={() => setModalOpen(false)}
          onSave={guardar}
          saving={saving}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ flex: '1 1 160px', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'var(--bg-elev-1)' }}>
      <div style={{ fontSize: 11, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: highlight ? '#ef4444' : '#fff', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function GestionDiariaModal({ form, setForm, onCancel, onSave, saving }: {
  form: Partial<GestionDiaria>;
  setForm: React.Dispatch<React.SetStateAction<Partial<GestionDiaria>>>;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof GestionDiaria>(field: K, value: GestionDiaria[K]) => setForm(prev => ({ ...prev, [field]: value }));
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elev-1)', borderRadius: 16, padding: 28, width: 720, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? 'Editar registro' : 'Agregar registro'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label className="form-label">Tipo de cliente *</label>
            <PremiumSelect value={form.tipo_cliente || ''} onChange={v => set('tipo_cliente', v)} options={[...GESTION_DIARIA_OPCIONES.tipoCliente]} onAddCustom={() => {}} />
          </div>
          <div>
            <label className="form-label">Fecha</label>
            <CorporateDatePicker value={form.fecha || ''} onChange={v => set('fecha', v)} />
          </div>
          <div>
            <label className="form-label">Apellido y nombre *</label>
            <input className="form-input" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
          </div>
          <div>
            <label className="form-label">CUIL *</label>
            <input className="form-input" value={form.cuil || ''} onChange={e => set('cuil', e.target.value.replace(/\D/g, '').slice(0, 11))} />
          </div>
          <div>
            <label className="form-label">Actividad</label>
            <PremiumSelect value={form.actividad || ''} onChange={v => set('actividad', v)} options={[...GESTION_DIARIA_OPCIONES.actividad]} onAddCustom={() => {}} />
          </div>
          <div>
            <label className="form-label">Dónde nos conoció</label>
            <PremiumSelect value={form.donde_nos_conocio || ''} onChange={v => set('donde_nos_conocio', v)} options={[...GESTION_DIARIA_OPCIONES.dondeNosConocio]} onAddCustom={() => {}} />
          </div>
          <div>
            <label className="form-label">Estado *</label>
            <PremiumSelect value={form.estado || ''} onChange={v => set('estado', v)} options={[...GESTION_DIARIA_OPCIONES.estado]} />
          </div>
          <div>
            <label className="form-label">Score</label>
            <input type="number" className="form-input" value={form.score ?? ''} onChange={e => set('score', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="form-label">Apertura/Renovación</label>
            <PremiumSelect value={form.tipo_operacion || ''} onChange={v => set('tipo_operacion', v)} options={[...GESTION_DIARIA_OPCIONES.tipoOperacion]} />
          </div>
          <div>
            <label className="form-label">Capital x venta</label>
            <input type="number" className="form-input" value={form.capital_x_venta ?? ''} onChange={e => set('capital_x_venta', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="form-label">Interés x venta</label>
            <input type="number" className="form-input" value={form.interes_x_venta ?? ''} onChange={e => set('interes_x_venta', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="form-label">Monto otorgado</label>
            <input type="number" className="form-input" value={form.monto_otorgado ?? ''} onChange={e => set('monto_otorgado', e.target.value ? Number(e.target.value) : 0)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Comentarios</label>
            <textarea className="form-input" value={form.comentarios || ''} onChange={e => set('comentarios', e.target.value)} rows={3} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
```

(`onAddCustom={() => {}}` es un placeholder deliberado de UI simple para v1 — abre la puerta a "agregar otro" pero sin modal propio todavía; si se quiere el flujo completo de alta de opción custom, replicar el patrón de `empleadorCustom` en `registros/page.tsx` en una iteración siguiente. No bloquea el uso real del formulario porque las listas ya cubren el 100% de los valores vigentes.)

- [ ] **Step 3: Verificar typecheck + lint**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run lint` → sin errores nuevos.

- [ ] **Step 4: Smoke en `npm run dev`**

Abrir `http://localhost:3000/gestion-diaria?analista=Victoria`: cargar un registro de prueba, confirmar que aparece en la tabla y que los KPIs se actualizan.

- [ ] **Step 5: Commit**

```bash
git add src/app/gestion-diaria
git commit -m "feat: página /gestion-diaria con KPIs, filtros, tabla y modal de alta/edición"
```

---

## Task 6: Sidebar — botón propio por analista

El usuario pidió explícitamente que la función nueva aparezca como **un botón aparte en el sidebar, uno por analista** (no como un filtro dentro de "Registros"). Se replica el mismo patrón visual que ya usa "Reportes" (ícono con flyout listando cada analista).

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Importar ícono + hook**

Agregar `ClipboardList` (o el ícono de lucide que se use) al import de `lucide-react`, y usar el ya importado `useAnalistas`.

- [ ] **Step 2: Nuevo bloque de navegación**

Insertar, después del bloque "2. Reportes" (después del `</div>` que cierra su flyout, antes del divisor de "3. Filtros avanzados"), un bloque nuevo siguiendo exactamente la estructura del de Reportes:

```tsx
<div style={{ width: 60, height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />

{/* 2b. Gestión diaria */}
<div
  onMouseEnter={() => handleMouseEnter('gestion-diaria')}
  onMouseLeave={handleMouseLeave}
  style={{ position: 'relative' }}
>
  <button
    type="button"
    onClick={() => router.push(`/gestion-diaria?analista=${encodeURIComponent(analistaNombres[0] || '')}`)}
    style={{
      width: 60, height: 60, borderRadius: 16,
      background: pathname === '/gestion-diaria' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
      border: pathname === '/gestion-diaria' ? '1px solid #f59e0b' : '1px solid transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: pathname === '/gestion-diaria' ? '#f59e0b' : 'rgba(255, 255, 255, 0.65)',
      cursor: 'pointer', transition: 'all 0.2s ease',
    }}
    onMouseEnter={e => { if (pathname !== '/gestion-diaria') { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; } }}
    onMouseLeave={e => { if (pathname !== '/gestion-diaria') { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)'; e.currentTarget.style.background = 'transparent'; } }}
  >
    <ClipboardList size={32} />
  </button>

  {activeHover === 'gestion-diaria' && (
    <div style={{ ...flyoutStyle, top: 0, minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
        Gestión diaria
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {analistaNombres.map(nombre => {
          const currentAnalistaGD = searchParams?.get('analista') || '';
          const active = pathname === '/gestion-diaria' && currentAnalistaGD === nombre;
          return (
            <button
              key={nombre}
              onClick={() => router.push(`/gestion-diaria?analista=${encodeURIComponent(nombre)}`)}
              style={{
                background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: active ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                color: active ? '#f59e0b' : '#fff', fontSize: 13, textAlign: 'left', padding: '8px 12px',
                borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <UserCheck size={14} /> {nombre}
            </button>
          );
        })}
      </div>
    </div>
  )}
</div>
```

`UserCheck` ya está importado (se usa en el flyout de Reportes). `searchParams` ya está disponible en el componente (viene de `useSearchParams()`, usado más arriba para `currentAnalistaPage`).

- [ ] **Step 3: Verificar typecheck + lint**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run lint` → sin errores nuevos.

- [ ] **Step 4: Smoke**

`npm run dev`: el sidebar muestra el ícono nuevo entre Reportes y Filtros; el flyout lista a Victoria, Magali (y cualquier otro analista activo); cada botón navega a `/gestion-diaria?analista=<nombre>` y el filtro de analista de la página nueva queda pre-seleccionado.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: botón de Gestión diaria en el sidebar con flyout por analista"
```

---

## Task 7: Script de migración del histórico de Victoria

**Files:**
- Create: `scripts/migrar-gestion-diaria.mjs`

- [ ] **Step 1: Crear el script**

Sigue el mismo patrón que `scripts/migrate-csv.mjs` ya existente (misma URL/key de Supabase, mismo estilo de logging). Reutiliza `parseNumberRobust` (formato `$ 500.000,000` ya cubierto, ver spec) reimplementado en JS plano porque el script corre fuera del build de Next (no puede importar `@/lib/...` directamente sin configurar paths — se copia la función, es un script one-off, no una duplicación de una regla de negocio):

```js
/**
 * Migración one-off: CSV histórico de "Gestiones VICTORIA" (Apps Script) → tabla gestion_diaria
 *
 * USO:
 *   node scripts/migrar-gestion-diaria.mjs "Gestiones VICTORIA - Ingreso Diario Ventas.csv" Victoria
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = 'https://cnjqjvqgmclwkuswjzzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuanFqdnFnbWNsd2t1c3dqenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjY5NjEsImV4cCI6MjA5MDA0Mjk2MX0.LI-74p-ctrQN2mNfp2s53WO-xtLFiUd1n3xHqIo0sBg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseMonto(raw) {
  if (raw == null || raw === '') return null;
  let str = String(raw).replace(/[^0-9.,-]/g, '');
  if (!str) return null;
  const ld = str.lastIndexOf('.');
  const lc = str.lastIndexOf(',');
  if (lc > ld) {
    str = str.replace(/\./g, '');
    const c = str.lastIndexOf(',');
    str = str.substring(0, c) + '.' + str.substring(c + 1);
  } else if (ld > lc && ld !== -1) {
    str = str.replace(/,/g, '');
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function parseFechaDMY(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Estado histórico (etiqueta vieja del Apps Script) → estado vigente
const ESTADO_MAP = {
  'no califica (otros motivos)': 'No califica',
  'aprobado': 'Aprobado',
  'rechazado': 'Rechazado',
  'falta documentacion': 'Falta Documentacion',
  'califica': 'Califica',
  'sueldo bajo': 'Sueldo bajo',
};
function normalizarEstado(raw, comentariosRef) {
  if (!raw) return { estado: '', extra: '' };
  const key = raw.trim().toLowerCase();
  const mapped = ESTADO_MAP[key];
  if (mapped) return { estado: mapped, extra: '' };
  // Valor no reconocido (ej. mojibake "Se envía Invitación"): no se pierde,
  // se preserva en comentarios y el estado queda vacío para revisión manual.
  return { estado: '', extra: `[Estado original: ${raw.trim()}] ` };
}

const TIPO_OPERACION_MAP = { 'apertura': 'Apertura', 'renovacion': 'Renovacion', 'renovación': 'Renovacion' };

async function main() {
  const [, , csvFile, analista] = process.argv;
  if (!csvFile || !analista) {
    console.log('USO: node scripts/migrar-gestion-diaria.mjs <archivo.csv> <analista>');
    process.exit(1);
  }

  const content = readFileSync(csvFile, 'latin1'); // el CSV origen tiene bytes fuera de UTF-8 (ver spec)
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
  console.log(`Filas leídas: ${records.length}`);

  const filas = [];
  let saltadas = 0;
  for (const r of records) {
    const cuil = String(r['CUIL'] || '').replace(/\D/g, '').slice(0, 11);
    const nombre = String(r['APELLIDO Y NOMBRE'] || '').trim();
    if (!cuil && !nombre) { saltadas++; continue; }

    const { estado, extra } = normalizarEstado(r['ESTADO'], r['COMENTARIOS']);
    const tipoOpRaw = String(r['APERTURA/RENOVACION'] || '').trim().toLowerCase();

    filas.push({
      analista,
      tipo_cliente: String(r['TIPO DE CLIENTE'] || '').trim(),
      fecha: parseFechaDMY(r['FECHA']),
      nombre,
      cuil,
      actividad: String(r['ACTIVIDAD'] || '').trim(),
      donde_nos_conocio: String(r['Por Donde Nos Conocio'] || '').trim(),
      estado,
      score: r['SCORE'] ? parseInt(r['SCORE'], 10) || null : null,
      tipo_operacion: TIPO_OPERACION_MAP[tipoOpRaw] || '',
      monto_otorgado: parseMonto(r['MONTO OTORGADO']) ?? 0,
      interes_x_venta: parseMonto(r['(I) X VENTA']),
      comentarios: (extra + String(r['COMENTARIOS'] || '').trim()).trim(),
    });
  }
  console.log(`Filas a insertar: ${filas.length} (saltadas: ${saltadas})`);

  const BATCH = 200;
  let insertados = 0, fallos = 0;
  for (let i = 0; i < filas.length; i += BATCH) {
    const batch = filas.slice(i, i + BATCH);
    const { error } = await supabase.from('gestion_diaria').insert(batch);
    if (error) {
      console.log(`Error en batch ${i / BATCH + 1}: ${error.message}`);
      fallos += batch.length;
    } else {
      insertados += batch.length;
      process.stdout.write(`\rInsertados: ${insertados}/${filas.length}`);
    }
  }
  console.log(`\nListo. Insertados: ${insertados}, fallos: ${fallos}.`);
}

main().catch(err => { console.error('Error fatal:', err.message); process.exit(1); });
```

- [ ] **Step 2: Ejecutar la migración**

```bash
node scripts/migrar-gestion-diaria.mjs "Gestiones VICTORIA - Ingreso Diario Ventas.csv" Victoria
```

Expected: `Filas leídas: 1754`, `Insertados: ~1750` (menos las filas sin CUIL ni nombre).

- [ ] **Step 3: Verificar en Supabase**

En el SQL Editor: `select count(*) from gestion_diaria where analista = 'Victoria';` → coincide con "Insertados" del step anterior.
`select estado, count(*) from gestion_diaria group by estado order by 2 desc;` → confirmar que `No califica` concentra la mayoría (viene de la etiqueta vieja) y que el bucket vacío (`estado = ''`) es chico (revisar esas filas a mano si hace falta).

- [ ] **Step 4: Smoke en la UI**

`http://localhost:3000/gestion-diaria?analista=Victoria` → la tabla muestra ~1750 filas, los KPIs de Monto otorgado / Aperturas / Renovaciones dan valores coherentes con el dashboard del Apps Script original (comparar a ojo con la captura del sistema viejo).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrar-gestion-diaria.mjs
git commit -m "feat: script de migración del histórico de Victoria a gestion_diaria"
```

---

## Task 8: Verificación final

- [ ] **Step 1: Typecheck + lint + build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: los tres sin errores.

- [ ] **Step 2: Checklist funcional manual**

1. `/gestion-diaria?analista=Victoria` muestra el histórico migrado y sus KPIs.
2. `/gestion-diaria?analista=Magali` arranca vacío (no se migró su CSV — no se compartió) y permite cargar un registro nuevo desde cero.
3. Cargar un registro nuevo, editarlo, confirmar que persiste tras recargar (F5).
4. El sidebar muestra el botón nuevo con el flyout de analistas y navega correctamente.
5. `/registros` sigue funcionando igual que antes (el refactor de `PremiumSelect`/`CorporateDatePicker` no rompió nada).

- [ ] **Step 3: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: verificación final gestión diaria"
```

---

## Notas / decisiones pendientes de confirmar con el usuario

- **`capital_x_venta` ("(K) X VENTA")**: se asumió K = Capital de la operación (vs. I = Interés). No existe en el CSV histórico, solo en el formulario vigente — si la asunción es incorrecta, es un rename de columna sin impacto en el resto del plan.
- **CSV de Magali**: no fue compartido — su tabla arranca vacía. Si aparece, se migra con el mismo script (`node scripts/migrar-gestion-diaria.mjs archivo.csv Magali`).
- **Pestañas auxiliares** (Listado CETRO, Proy0-Tramo1-29, Gestion VTA, Flyers, Emails): fuera de alcance de este plan a propósito (ver spec).
