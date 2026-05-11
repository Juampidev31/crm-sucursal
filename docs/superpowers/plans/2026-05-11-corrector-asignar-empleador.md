# Corrector — Asignar Empleador desde Excel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sección colapsable en el tab Corrector para pegar un Excel con CUILs, buscar todos sus registros en DB, y asignarles un Empleador en masa.

**Architecture:** Componente funcional `AsignarEmpleadorSection` definido dentro de `BulkModifyTab.tsx` (arriba del export default). Recibe `registros`, `allEmpleadores` y `mutateRegistros` via props. Sigue el patrón de sección colapsable ya existente en el archivo (mismo estilo visual que Corrector de Localidad). No hay query extra a Supabase para buscar — solo filtra `registros` del provider en memoria.

**Tech Stack:** React, TypeScript, Supabase JS client (`@/lib/supabase`), `parsePastedText` y `normalizeCuil` de `@/lib/verificador-utils`.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/app/ajustes/BulkModifyTab.tsx` | Agregar componente `AsignarEmpleadorSection` + estado de expansión + renderizado al final de la sección corrector |

---

### Task 1: Componente `AsignarEmpleadorSection`

**Files:**
- Modify: `src/app/ajustes/BulkModifyTab.tsx`

El componente va justo encima de `export default function BulkModifyTab`. Necesita importar `parsePastedText` y `normalizeCuil` desde `@/lib/verificador-utils` y el tipo `ParsedRow` del mismo módulo. El import de `supabase` ya existe en la línea 4. `useState` y `useMemo` ya están importados desde React.

- [ ] **Step 1: Agregar import de verificador-utils**

En la línea 13 (después de los imports de lucide), agregar:

```tsx
import { parsePastedText, normalizeCuil, ParsedRow } from '@/lib/verificador-utils';
import { Registro } from '@/types';
```

Verificar que `Registro` no esté ya importado desde `@/types`. Si ya existe el import de `@/types`, solo agregar `Registro` si no está en la lista.

- [ ] **Step 2: Definir el tipo de props y el componente**

Justo antes de `export default function BulkModifyTab`, agregar el componente completo:

```tsx
interface AsignarEmpleadorSectionProps {
  registros: Registro[];
  allEmpleadores: string[];
  mutateRegistros: (fn: (prev: Registro[]) => Registro[]) => void;
}

function AsignarEmpleadorSection({ registros, allEmpleadores, mutateRegistros }: AsignarEmpleadorSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [cuilCol, setCuilCol] = useState<number | null>(null);
  const [nombreCol, setNombreCol] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const [empleadorInput, setEmpleadorInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{ updated: number } | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const previewRows = rows.slice(0, 5);
  const colCount = rows[0]?.cells.length ?? 0;

  const matchedRows = useMemo(() => {
    if (!searched || cuilCol === null || rows.length === 0) return [];
    return rows
      .map(r => {
        const cuil = normalizeCuil(r.cells[cuilCol] ?? '');
        const nombre = nombreCol !== null ? (r.cells[nombreCol] ?? '') : '';
        const found = registros.filter(reg => normalizeCuil(reg.cuil) === cuil);
        return { cuil, nombre, registros: found };
      })
      .filter(r => r.cuil !== '');
  }, [searched, rows, cuilCol, nombreCol, registros]);

  const allMatchedIds = useMemo(
    () => matchedRows.flatMap(r => r.registros.map(reg => reg.id)),
    [matchedRows]
  );

  const totalClientes = matchedRows.length;
  const totalRegistros = allMatchedIds.length;

  const handleParse = () => {
    const parsed = parsePastedText(pastedText);
    setRows(parsed);
    setCuilCol(null);
    setNombreCol(null);
    setSearched(false);
    setAssignResult(null);
    setAssignError(null);
  };

  const handleSearch = () => {
    setSearched(true);
    setAssignResult(null);
    setAssignError(null);
    setConfirming(false);
  };

  const handleAssign = async () => {
    if (!empleadorInput.trim() || allMatchedIds.length === 0) return;
    setAssigning(true);
    setAssignError(null);
    const { error } = await supabase
      .from('registros')
      .update({ empleador: empleadorInput.trim() })
      .in('id', allMatchedIds);
    setAssigning(false);
    setConfirming(false);
    if (!error) {
      setAssignResult({ updated: allMatchedIds.length });
      const emp = empleadorInput.trim();
      mutateRegistros(prev =>
        prev.map(r => allMatchedIds.includes(r.id) ? { ...r, empleador: emp } : r)
      );
    } else {
      setAssignError(error.message);
    }
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700,
    color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px',
    textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '9px 12px', fontSize: 12, color: '#ccc',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <div style={{
      marginBottom: '28px', padding: '20px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px',
    }}>
      {/* Header colapsable */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 16 : 0, cursor: 'pointer' }}
      >
        <Users size={18} color="#555" />
        <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          Asignar Empleador desde Excel
          {expanded ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
        </h4>
      </div>

      {expanded && (
        <>
          {/* Paso 1: Pegar Excel */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
              Pegar celdas de Excel (CUIL + Apellido/Nombre)
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Pegá acá las celdas copiadas de Excel..."
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
            />
            <button
              onClick={handleParse}
              disabled={!pastedText.trim()}
              style={{
                marginTop: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                background: pastedText.trim() ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${pastedText.trim() ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6, cursor: pastedText.trim() ? 'pointer' : 'not-allowed',
                color: pastedText.trim() ? '#a5b4fc' : '#444',
              }}
            >
              Parsear
            </button>
          </div>

          {/* Preview + asignación de columnas */}
          {rows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>
                {rows.length} fila{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''}. Asigná las columnas:
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>
                    Columna CUIL *
                  </label>
                  <select
                    className="form-input"
                    value={cuilCol ?? ''}
                    onChange={e => { setCuilCol(e.target.value === '' ? null : Number(e.target.value)); setSearched(false); }}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">— seleccionar —</option>
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>Col {i + 1}: {previewRows[0]?.cells[i] ?? ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>
                    Columna Apellido/Nombre (opcional)
                  </label>
                  <select
                    className="form-input"
                    value={nombreCol ?? ''}
                    onChange={e => { setNombreCol(e.target.value === '' ? null : Number(e.target.value)); setSearched(false); }}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">— ninguna —</option>
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>Col {i + 1}: {previewRows[0]?.cells[i] ?? ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview primeras 5 filas */}
              <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {Array.from({ length: colCount }, (_, i) => (
                        <th key={i} style={thStyle}>
                          Col {i + 1}
                          {i === cuilCol ? ' (CUIL)' : ''}
                          {i === nombreCol ? ' (Nombre)' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.cells.map((cell, ci) => (
                          <td key={ci} style={{
                            ...tdStyle,
                            background: ci === cuilCol ? 'rgba(99,102,241,0.06)' : ci === nombreCol ? 'rgba(74,222,128,0.04)' : undefined,
                          }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSearch}
                disabled={cuilCol === null}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 700,
                  background: cuilCol !== null ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${cuilCol !== null ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 6, cursor: cuilCol !== null ? 'pointer' : 'not-allowed',
                  color: cuilCol !== null ? '#a5b4fc' : '#444',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Search size={12} />
                Buscar en registros
              </button>
            </div>
          )}

          {/* Paso 2: Resultados */}
          {searched && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>
                {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''} en total de {totalClientes} cliente{totalClientes !== 1 ? 's' : ''}
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#111' }}>
                    <tr>
                      <th style={thStyle}>CUIL</th>
                      <th style={thStyle}>Apellido y Nombre</th>
                      <th style={thStyle}>Registros</th>
                      <th style={thStyle}>Empleador actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedRows.map((mr, i) => (
                      <tr key={i} style={{ opacity: mr.registros.length === 0 ? 0.4 : 1 }}>
                        <td style={tdStyle}>{mr.cuil}</td>
                        <td style={tdStyle}>{mr.nombre || '—'}</td>
                        <td style={{ ...tdStyle, color: mr.registros.length === 0 ? '#555' : '#ccc' }}>
                          {mr.registros.length === 0 ? 'Sin registros' : mr.registros.length}
                        </td>
                        <td style={tdStyle}>
                          {mr.registros.length === 0
                            ? '—'
                            : [...new Set(mr.registros.map(r => r.empleador).filter(Boolean))].join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paso 3: Asignar empleador */}
          {searched && totalRegistros > 0 && !assignResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 9, color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 6 }}>
                  Empleador a asignar
                </label>
                <input
                  className="form-input"
                  list="empleadores-datalist"
                  placeholder="Ej: MUNICIPALIDAD DE PARANÁ"
                  value={empleadorInput}
                  onChange={e => { setEmpleadorInput(e.target.value); setConfirming(false); }}
                  style={{ width: '100%', fontSize: 12 }}
                />
                <datalist id="empleadores-datalist">
                  {allEmpleadores.map(e => <option key={e} value={e} />)}
                </datalist>
              </div>

              {!confirming ? (
                <button
                  onClick={() => { if (empleadorInput.trim()) setConfirming(true); }}
                  disabled={!empleadorInput.trim()}
                  style={{
                    alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12, fontWeight: 700,
                    background: empleadorInput.trim() ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${empleadorInput.trim() ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 6, cursor: empleadorInput.trim() ? 'pointer' : 'not-allowed',
                    color: empleadorInput.trim() ? '#a5b4fc' : '#444',
                  }}
                >
                  Asignar a todos ({totalRegistros} registro{totalRegistros !== 1 ? 's' : ''})
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                    ⚠ Se actualizarán {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 700,
                      background: assigning ? 'rgba(255,255,255,0.05)' : 'rgba(248,113,113,0.2)',
                      border: '1px solid rgba(248,113,113,0.4)',
                      borderRadius: 6, cursor: assigning ? 'not-allowed' : 'pointer',
                      color: '#fff',
                    }}
                  >
                    {assigning ? 'Guardando...' : '⚠ Confirmar'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={assigning}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, cursor: 'pointer', color: '#666',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {assignError && (
                <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>
                  Error: {assignError}
                </div>
              )}
            </div>
          )}

          {assignResult && (
            <div style={{
              padding: '10px 16px', background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8,
              fontSize: 12, color: '#4ade80', fontWeight: 600,
            }}>
              ✓ {assignResult.updated} registro{assignResult.updated !== 1 ? 's' : ''} actualizados con empleador &quot;{empleadorInput}&quot;.
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Agregar estado de expansión y renderizado en BulkModifyTab**

Dentro de `BulkModifyTab`, después de la línea `const [correctorLocalidadExpandido, setCorrectorLocalidadExpandido] = useState(false);` (línea ~219), agregar:

```tsx
const [asignarEmpleadorExpandido, setAsignarEmpleadorExpandido] = useState(false);
```

**Nota:** El estado `asignarEmpleadorExpandido` no se usa directamente en el JSX porque el componente `AsignarEmpleadorSection` maneja su propio estado interno de expansión. Solo es necesario si querés controlar desde afuera. Por lo tanto, **no agregues ese estado** — el componente ya tiene `expanded` internamente. Saltea este paso.

- [ ] **Step 4: Renderizar `AsignarEmpleadorSection` al final del bloque corrector**

Buscar el bloque que termina el corrector de Localidad (aproximadamente línea 1400). Agregar justo después del cierre del bloque `{(mode === 'all' || mode === 'corrector') && ...}` del corrector de Localidad, como bloque separado:

```tsx
{(mode === 'all' || mode === 'corrector') && (
  <AsignarEmpleadorSection
    registros={registros}
    allEmpleadores={allEmpleadores}
    mutateRegistros={mutateRegistros}
  />
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas" && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores. Si hay error de tipo en `mutateRegistros`, revisar la firma — en `RegistrosProvider` la función acepta `(fn: (prev: Registro[]) => Registro[]) => void`. Ajustar el tipo de props si difiere.

- [ ] **Step 6: Commit**

```bash
cd "c:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas"
git add src/app/ajustes/BulkModifyTab.tsx
git commit -m "feat: AsignarEmpleadorSection en Corrector — buscar por CUIL y asignar empleador en masa"
```
