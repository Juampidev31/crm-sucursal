# Verificador — Selección y Confirmación de Duplicados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el botón de eliminar-todo-automático por un flujo con checkboxes por fila duplicada y confirmación de dos pasos antes de ejecutar el delete.

**Architecture:** Todo el cambio está en `ResultsTable` dentro de `src/app/ajustes/VerificadorTab.tsx`. Se agrega estado `selectedForDeletion: Set<string>` (dbIds pre-cargados con los extras), columna de checkbox en filas duplicadas, y el banner pasa a tener dos estados: "Eliminar N" → "⚠ Confirmar / Cancelar".

**Tech Stack:** React, TypeScript, Supabase JS client.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/app/ajustes/VerificadorTab.tsx` | Agregar estado `selectedForDeletion`, `confirming`; columna checkbox; banner con confirmación |

---

### Task 1: Estado `selectedForDeletion` + sync con `idsToDelete`

**Files:**
- Modify: `src/app/ajustes/VerificadorTab.tsx`

El componente `ResultsTable` actualmente tiene `idsToDelete` (useMemo, array de dbIds extras). Necesitamos un estado mutable que el usuario pueda editar.

- [ ] **Step 1: Agregar estado `selectedForDeletion` y `confirming`**

Dentro de `ResultsTable`, después de la línea `const [deleteError, setDeleteError] = useState<string | null>(null);`, agregar:

```tsx
const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
const [confirming, setConfirming] = useState(false);
```

- [ ] **Step 2: Sincronizar `selectedForDeletion` con `idsToDelete`**

Agregar un `useEffect` justo después del state anterior. Cada vez que `idsToDelete` cambia (nueva verificación), pre-cargar todos los extras como seleccionados:

```tsx
useEffect(() => {
  setSelectedForDeletion(new Set(idsToDelete));
  setConfirming(false);
  setDeleteResult(null);
  setDeleteError(null);
}, [idsToDelete.join(',')]);
```

> Nota: `idsToDelete.join(',')` como dependencia evita re-renders infinitos por referencia de array.

- [ ] **Step 3: Agregar helper para toggle de checkbox**

```tsx
const toggleSelected = (id: string) =>
  setSelectedForDeletion(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
```

- [ ] **Step 4: Actualizar `handleDeleteDuplicates` para usar `selectedForDeletion`**

Reemplazar la función existente:

```tsx
const handleDeleteDuplicates = async () => {
  const ids = Array.from(selectedForDeletion);
  if (ids.length === 0) return;
  setDeleting(true);
  setDeleteError(null);
  console.log('[Verificador] eliminando ids:', ids);
  const { error } = await supabase
    .from('registros')
    .delete()
    .in('id', ids);
  console.log('[Verificador] resultado delete:', { error });
  setDeleting(false);
  setConfirming(false);
  if (!error) {
    setDeleteResult({ deleted: ids.length });
    onDeleted();
  } else {
    setDeleteError(error.message);
  }
};
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas"
git add src/app/ajustes/VerificadorTab.tsx
git commit -m "feat: estado selectedForDeletion con sync y confirmación"
```

---

### Task 2: Columna checkbox en filas duplicadas

**Files:**
- Modify: `src/app/ajustes/VerificadorTab.tsx`

Agregar una columna extra al inicio de la tabla que solo aparece cuando hay duplicados (`duplicateCount > 0`). En las filas duplicadas muestra un checkbox; en las no-duplicadas muestra una celda vacía.

- [ ] **Step 1: Agregar `<th>` de checkbox en el thead**

En el `<thead>`, la fila de encabezados empieza con los `orderedCols`. Agregar un `<th>` vacío al inicio, condicionado a `duplicateCount > 0`:

```tsx
<tr>
  {duplicateCount > 0 && (
    <th style={{ ...thStyle, width: 36, minWidth: 36 }} />
  )}
  {orderedCols.map(({ role, colIndex }) => (
    // ... existing th content
  ))}
  <th style={thStyle}>ESTADO</th>
  <th style={thStyle}>MONTO DB ...</th>
  <th style={thStyle}>FECHA DB ...</th>
  <th style={thStyle}>ESTADO DB ...</th>
</tr>
```

- [ ] **Step 2: Agregar celda checkbox en cada `<tr>` del tbody**

En el `<tbody>`, dentro del `.map((res, idx) => ...)`, agregar una celda al inicio del `<tr>`. La celda tiene checkbox solo si la fila es duplicada y tiene `dbId`. La función para determinar si es duplicada es:

```tsx
const isDup = res.status === 'found' && cuilColIndex !== undefined &&
  duplicateCuils.has((res.row.cells[Number(cuilColIndex)] ?? '').trim());
```

Celda a agregar como primer `<td>` de cada fila:

```tsx
{duplicateCount > 0 && (
  <td style={{ padding: '9px 14px', textAlign: 'center', width: 36 }}>
    {isDup && res.dbId && (
      <input
        type="checkbox"
        checked={selectedForDeletion.has(res.dbId)}
        onChange={() => toggleSelected(res.dbId!)}
        style={{ cursor: 'pointer', accentColor: '#f87171', width: 14, height: 14 }}
      />
    )}
  </td>
)}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas"
git add src/app/ajustes/VerificadorTab.tsx
git commit -m "feat: columna checkbox en filas duplicadas del Verificador"
```

---

### Task 3: Banner con confirmación de dos pasos

**Files:**
- Modify: `src/app/ajustes/VerificadorTab.tsx`

Reemplazar el banner actual (que tiene un solo botón de eliminar) por un banner con dos estados:
- **Estado normal:** muestra conteo de seleccionados + botón "Eliminar N seleccionados"
- **Estado confirming:** muestra advertencia + botón "⚠ Confirmar" (rojo) + botón "Cancelar"

- [ ] **Step 1: Reemplazar el banner existente**

Buscar el bloque `{duplicateCount > 0 && !deleteResult && (` y reemplazarlo completo por:

```tsx
{duplicateCount > 0 && !deleteResult && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '10px 16px',
    background: confirming ? 'rgba(248,113,113,0.13)' : 'rgba(248,113,113,0.08)',
    border: `1px solid ${confirming ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.25)'}`,
    borderRadius: 8,
    transition: 'all 0.15s',
  }}>
    <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
      {duplicateCount} CUIL{duplicateCount > 1 ? 's' : ''} duplicado{duplicateCount > 1 ? 's' : ''} —{' '}
      {selectedForDeletion.size} seleccionado{selectedForDeletion.size !== 1 ? 's' : ''} para eliminar
    </span>

    {!confirming ? (
      <button
        onClick={() => { if (selectedForDeletion.size > 0) setConfirming(true); }}
        disabled={selectedForDeletion.size === 0}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px',
          background: selectedForDeletion.size === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(248,113,113,0.15)',
          border: `1px solid ${selectedForDeletion.size === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(248,113,113,0.3)'}`,
          borderRadius: 6,
          cursor: selectedForDeletion.size === 0 ? 'not-allowed' : 'pointer',
          color: selectedForDeletion.size === 0 ? '#555' : '#f87171',
          fontSize: 12, fontWeight: 700,
        }}
      >
        <Trash2 size={12} />
        Eliminar {selectedForDeletion.size} seleccionado{selectedForDeletion.size !== 1 ? 's' : ''}
      </button>
    ) : (
      <>
        <button
          onClick={handleDeleteDuplicates}
          disabled={deleting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: deleting ? 'rgba(255,255,255,0.05)' : 'rgba(248,113,113,0.3)',
            border: '1px solid rgba(248,113,113,0.5)',
            borderRadius: 6,
            cursor: deleting ? 'not-allowed' : 'pointer',
            color: '#fff', fontSize: 12, fontWeight: 700,
          }}
        >
          <Trash2 size={12} />
          {deleting ? 'Eliminando...' : `⚠ Confirmar eliminación`}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, cursor: 'pointer',
            color: '#666', fontSize: 12, fontWeight: 600,
          }}
        >
          Cancelar
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas" && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas"
git add src/app/ajustes/VerificadorTab.tsx
git commit -m "feat: banner con confirmación de dos pasos para eliminar duplicados"
```
