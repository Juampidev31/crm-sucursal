# Verificador — Eliminar Duplicados por CUIL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la tabla de resultados del Verificador, detectar filas `found` con CUIL repetido, resaltarlas en rojo, y ofrecer un botón que elimine de Supabase los registros duplicados del mes verificado (conservando la primera ocurrencia de cada CUIL).

**Architecture:** Se agrega `dbId` a `VerificadorResult` en `verificador-utils.ts` para exponer el `id` del registro matcheado. En `VerificadorTab.tsx` (componente `ResultsTable`) se computa el conjunto de CUILs duplicados entre filas `found`, se resaltan en rojo y se muestra un botón de eliminación que llama a Supabase con los IDs extra.

**Tech Stack:** TypeScript, React, Supabase JS client (`@/lib/supabase`), Lucide icons.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/verificador-utils.ts` | Agregar `dbId?: string` a `VerificadorResult`; retornarlo en `verificarFilas` |
| `src/app/ajustes/VerificadorTab.tsx` | Detectar duplicados por CUIL, resaltar en rojo, botón eliminar |

---

### Task 1: Exponer `dbId` en `VerificadorResult`

**Files:**
- Modify: `src/lib/verificador-utils.ts`

- [ ] **Step 1: Agregar `dbId` a la interfaz `VerificadorResult`**

En `src/lib/verificador-utils.ts`, modificar la interfaz:

```ts
export interface VerificadorResult {
  row: ParsedRow;
  status: MatchStatus;
  dbId?: string;        // ← nuevo
  dbImporte?: number;
  dbFecha?: string;
  dbEstado?: string;
  diffDetail?: string;
}
```

- [ ] **Step 2: Retornar `dbId` en todos los return de `verificarFilas`**

Cada `return { row, status: 'found', ... }` ya usa `exact` o `first`. Agregar `dbId: exact.id` / `dbId: first.id` según el caso. El tipo `Registro` ya tiene `id: string`.

Reemplazar los tres returns relevantes dentro de `verificarFilas`:

```ts
// Return "found" con importe exacto (usa `exact`)
return {
  row, status: 'found',
  dbId: exact.id,
  dbImporte: exact.monto,
  dbFecha: exact.fecha ?? undefined,
  dbEstado: exact.estado,
};

// Return "mismatch" (usa `first`)
return {
  row, status: 'mismatch',
  dbId: first.id,
  dbImporte: first.monto,
  dbFecha: first.fecha ?? undefined,
  dbEstado: first.estado,
  diffDetail: `Excel $${csvImporte.toLocaleString('es-AR')} — DB $${first.monto.toLocaleString('es-AR')}`,
};

// Return "found" sin importe (usa `first`)
return {
  row, status: 'found',
  dbId: first.id,
  dbImporte: first.monto,
  dbFecha: first.fecha ?? undefined,
  dbEstado: first.estado,
};
```

- [ ] **Step 3: Verificar tipos con TypeScript**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas"
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/verificador-utils.ts
git commit -m "feat: exponer dbId en VerificadorResult"
```

---

### Task 2: Detectar duplicados y resaltar en rojo

**Files:**
- Modify: `src/app/ajustes/VerificadorTab.tsx` (componente `ResultsTable`)

- [ ] **Step 1: Calcular el set de CUILs duplicados**

En `ResultsTable`, agregar un `useMemo` que detecta CUILs que aparecen más de una vez entre los resultados `found`. La columna CUIL se obtiene del `mapping`.

Agregar justo después de la definición de `montoColIndex`:

```tsx
const cuilColIndex = useMemo(() =>
  Object.entries(mapping).find(([, r]) => r === 'cuil')?.[0], [mapping]);

// Set de CUILs que aparecen más de una vez en found
const duplicateCuils = useMemo(() => {
  if (cuilColIndex === undefined) return new Set<string>();
  const seen = new Map<string, number>();
  results.forEach(r => {
    if (r.status !== 'found') return;
    const cuil = (r.row.cells[Number(cuilColIndex)] ?? '').trim();
    if (!cuil) return;
    seen.set(cuil, (seen.get(cuil) ?? 0) + 1);
  });
  const dups = new Set<string>();
  seen.forEach((count, cuil) => { if (count > 1) dups.add(cuil); });
  return dups;
}, [results, mapping, cuilColIndex]);

const duplicateCount = duplicateCuils.size;
```

- [ ] **Step 2: Resaltar filas duplicadas en rojo**

En el `<tbody>`, la fila `<tr>` actualmente tiene:
```tsx
<tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
```

Reemplazar por:
```tsx
<tr key={idx} style={{
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  background: (() => {
    if (res.status !== 'found' || cuilColIndex === undefined) return undefined;
    const cuil = (res.row.cells[Number(cuilColIndex)] ?? '').trim();
    return duplicateCuils.has(cuil) ? 'rgba(248,113,113,0.07)' : undefined;
  })(),
}}>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/ajustes/VerificadorTab.tsx
git commit -m "feat: resaltar filas found con CUIL duplicado en rojo"
```

---

### Task 3: Botón "Eliminar duplicados"

**Files:**
- Modify: `src/app/ajustes/VerificadorTab.tsx` (componente `ResultsTable`)

- [ ] **Step 1: Agregar imports necesarios**

En las primeras líneas de `VerificadorTab.tsx`, agregar `Trash2` a los imports de lucide (ya está importado) y agregar import de supabase:

```tsx
import { supabase } from '@/lib/supabase';
```

Verificar que `Trash2` ya está en el import de lucide — si no, agregarlo:
```tsx
import { CheckCircle2, AlertCircle, XCircle, RotateCcw, Trash2 } from 'lucide-react';
```

- [ ] **Step 2: Agregar estado de eliminación**

Dentro del componente `ResultsTable`, agregar dos estados:

```tsx
const [deleting, setDeleting]     = useState(false);
const [deleteResult, setDeleteResult] = useState<{ deleted: number } | null>(null);
```

- [ ] **Step 3: Calcular los IDs a eliminar**

Agregar un `useMemo` que, para cada CUIL duplicado, reúne todos los `dbId` de los `found` con ese CUIL excepto el primero:

```tsx
const idsToDelete = useMemo(() => {
  if (cuilColIndex === undefined) return [];
  const firstSeen = new Map<string, boolean>();
  const ids: string[] = [];
  results.forEach(r => {
    if (r.status !== 'found' || !r.dbId) return;
    const cuil = (r.row.cells[Number(cuilColIndex)] ?? '').trim();
    if (!duplicateCuils.has(cuil)) return;
    if (!firstSeen.has(cuil)) {
      firstSeen.set(cuil, true); // conservar el primero
    } else {
      ids.push(r.dbId);
    }
  });
  return ids;
}, [results, mapping, duplicateCuils, cuilColIndex]);
```

- [ ] **Step 4: Implementar la función de eliminación**

```tsx
const handleDeleteDuplicates = async () => {
  if (idsToDelete.length === 0) return;
  setDeleting(true);
  const { error } = await supabase
    .from('registros')
    .delete()
    .in('id', idsToDelete);
  setDeleting(false);
  if (!error) setDeleteResult({ deleted: idsToDelete.length });
};
```

- [ ] **Step 5: Renderizar el banner del botón**

Agregar el banner justo antes del `{/* Active filters bar */}` (primera línea del return de `ResultsTable`):

```tsx
{duplicateCount > 0 && !deleteResult && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 16px',
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 8,
  }}>
    <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
      {duplicateCount} CUIL{duplicateCount > 1 ? 's' : ''} duplicado{duplicateCount > 1 ? 's' : ''} detectado{duplicateCount > 1 ? 's' : ''} ({idsToDelete.length} registro{idsToDelete.length > 1 ? 's' : ''} extra)
    </span>
    <button
      onClick={handleDeleteDuplicates}
      disabled={deleting}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px',
        background: deleting ? 'rgba(255,255,255,0.05)' : 'rgba(248,113,113,0.15)',
        border: '1px solid rgba(248,113,113,0.3)',
        borderRadius: 6, cursor: deleting ? 'not-allowed' : 'pointer',
        color: '#f87171', fontSize: 12, fontWeight: 700,
      }}
    >
      <Trash2 size={12} />
      {deleting ? 'Eliminando...' : `Eliminar ${idsToDelete.length} duplicado${idsToDelete.length > 1 ? 's' : ''}`}
    </button>
  </div>
)}

{deleteResult && (
  <div style={{
    padding: '10px 16px',
    background: 'rgba(74,222,128,0.08)',
    border: '1px solid rgba(74,222,128,0.2)',
    borderRadius: 8,
    fontSize: 12, color: '#4ade80', fontWeight: 600,
  }}>
    ✓ {deleteResult.deleted} registro{deleteResult.deleted > 1 ? 's' : ''} eliminado{deleteResult.deleted > 1 ? 's' : ''} correctamente.
  </div>
)}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/ajustes/VerificadorTab.tsx
git commit -m "feat: botón eliminar duplicados por CUIL en Verificador"
```
