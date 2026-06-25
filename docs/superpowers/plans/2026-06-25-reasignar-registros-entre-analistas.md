# Reasignar registros entre analistas (reparto con cuotas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una tarjeta en el tab Calif. x SCORE para reasignar registros de un analista origen a varios destinos, definiendo cuántos van a cada uno (selección manual con cuotas).

**Architecture:** Todo dentro del componente `BulkModifyTab` (`src/app/ajustes/BulkModifyTab.tsx`). Estado React local + derivados con `useMemo`; guardado en chunks vía `supabase.from('registros').update({ analista }).in('id', slice)` con update optimista (`mutateRegistros` + `pushBulkUpdateIds`), replicando el patrón de `reasignarMasivo`.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase client, estilos inline (convención del archivo).

**Verificación:** El proyecto **no tiene** framework de tests. Cada tarea verifica con `npm run lint` y la tarea final con `npm run build` + prueba manual en `npm run dev`. No se introduce Jest/Vitest (fuera de alcance).

**Spec:** `docs/superpowers/specs/2026-06-25-reasignar-registros-entre-analistas-design.md`

---

## File Structure

- Modify: `src/app/ajustes/BulkModifyTab.tsx`
  - Estado nuevo: junto a los estados del reasignador existente (~línea 1417).
  - Derivados (`useMemo`) y handlers: cerca de `reasignarMasivo` (~línea 2274).
  - JSX (tarjeta nueva): después del bloque "Reasignar Empleador / Dependencia", antes de `<AsignarEmpleadorSection>` (~línea 3166).

Convenciones existentes a reusar (ya presentes en el archivo):
- `const { registros, mutateRegistros, pushBulkUpdateIds } = useRegistros();` (~1374)
- `const { nombres: ANALISTAS } = useAnalistas();` (~1375)
- `ESTADOS` importado de `@/context/FilterContext`; `STATUS_LABEL` mapea estado→label.
- `setToast({ message, type })`, `updating`/`setUpdating`.

---

## Task 1: Estado del reasignador de analistas

**Files:**
- Modify: `src/app/ajustes/BulkModifyTab.tsx` (después de `const [reasignarBusquedaOrigen, ...]`, ~línea 1417)

- [ ] **Step 1: Agregar el estado**

Insertar inmediatamente después de la línea `const [reasignarBusquedaOrigen, setReasignarBusquedaOrigen] = useState('');`:

```tsx
// ── Reasignar registros entre analistas (reparto con cuotas) ──
const [raExpandido, setRaExpandido] = useState(false);
const [raOrigen, setRaOrigen] = useState<string>('');
const [raEstados, setRaEstados] = useState<string[]>([]); // vacío = todos los estados
const [raScoreMin, setRaScoreMin] = useState('');
const [raScoreMax, setRaScoreMax] = useState('');
const [raFechaDesde, setRaFechaDesde] = useState('');
const [raFechaHasta, setRaFechaHasta] = useState('');
const [raDestinos, setRaDestinos] = useState<{ analista: string; cuota: number }[]>([]);
const [raAsignaciones, setRaAsignaciones] = useState<Map<string, string>>(new Map()); // registroId -> analista destino
const [raDestinoActivo, setRaDestinoActivo] = useState<string>('');
const [raNuevoDestino, setRaNuevoDestino] = useState<string>('');
const [raNuevaCuota, setRaNuevaCuota] = useState<string>('');
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores nuevos (puede haber "declared but never used" para los setters hasta que se usen — se resuelven en tareas siguientes; si lint falla por unused, continuar, se limpia al cablear).

- [ ] **Step 3: Commit**

```bash
git add src/app/ajustes/BulkModifyTab.tsx
git commit -m "feat(reasignar-analistas): estado base del reparto con cuotas"
```

---

## Task 2: Derivados (universo, conteos) y handlers de cuotas/asignación

**Files:**
- Modify: `src/app/ajustes/BulkModifyTab.tsx` (después de `reasignarMasivo`/su `useCallback`, ~línea 2274)

- [ ] **Step 1: Agregar derivados y handlers**

Insertar después del `}, [...]);` que cierra `reasignarMasivo` (~línea 2274):

```tsx
// ── Universo y reparto para reasignar entre analistas ──
const raUniverso = useMemo(() => {
  if (!raOrigen) return [] as Registro[];
  const min = raScoreMin ? Number(raScoreMin) : null;
  const max = raScoreMax ? Number(raScoreMax) : null;
  return registros.filter(r => {
    if ((r.analista ?? '') !== raOrigen) return false;
    if (raEstados.length > 0 && !raEstados.includes(r.estado ?? '')) return false;
    if (min !== null && !(typeof r.puntaje === 'number' && r.puntaje >= min)) return false;
    if (max !== null && !(typeof r.puntaje === 'number' && r.puntaje <= max)) return false;
    if (raFechaDesde && (r.fecha ?? '') < raFechaDesde) return false;
    if (raFechaHasta && (r.fecha ?? '') > raFechaHasta) return false;
    return true;
  });
}, [registros, raOrigen, raEstados, raScoreMin, raScoreMax, raFechaDesde, raFechaHasta]);

const raTotalDisponible = raUniverso.length;

const raAsignadosPorDestino = useMemo(() => {
  const acc: Record<string, number> = {};
  for (const dest of raAsignaciones.values()) acc[dest] = (acc[dest] ?? 0) + 1;
  return acc;
}, [raAsignaciones]);

const raTotalCuotas = useMemo(
  () => raDestinos.reduce((s, d) => s + (d.cuota || 0), 0),
  [raDestinos],
);

// Limpiar asignaciones cuando cambia el universo (origen/filtros)
useEffect(() => {
  setRaAsignaciones(new Map());
}, [raOrigen, raEstados, raScoreMin, raScoreMax, raFechaDesde, raFechaHasta]);

const raAgregarDestino = useCallback(() => {
  const nombre = raNuevoDestino.trim();
  const cuota = Number(raNuevaCuota);
  if (!nombre) { setToast({ message: 'Elegí un analista destino', type: 'error' }); return; }
  if (nombre === raOrigen) { setToast({ message: 'El destino no puede ser el origen', type: 'error' }); return; }
  if (raDestinos.some(d => d.analista === nombre)) { setToast({ message: 'Ese destino ya está agregado', type: 'error' }); return; }
  if (!Number.isFinite(cuota) || cuota <= 0) { setToast({ message: 'Cuota inválida', type: 'error' }); return; }
  if (raTotalCuotas + cuota > raTotalDisponible) { setToast({ message: `La suma de cuotas (${raTotalCuotas + cuota}) supera los ${raTotalDisponible} disponibles`, type: 'error' }); return; }
  setRaDestinos(prev => [...prev, { analista: nombre, cuota }]);
  setRaDestinoActivo(prev => prev || nombre);
  setRaNuevoDestino('');
  setRaNuevaCuota('');
}, [raNuevoDestino, raNuevaCuota, raOrigen, raDestinos, raTotalCuotas, raTotalDisponible]);

const raQuitarDestino = useCallback((analista: string) => {
  setRaDestinos(prev => prev.filter(d => d.analista !== analista));
  setRaAsignaciones(prev => {
    const next = new Map(prev);
    for (const [id, dest] of next) if (dest === analista) next.delete(id);
    return next;
  });
  setRaDestinoActivo(prev => (prev === analista ? '' : prev));
}, []);

const raToggleFila = useCallback((id: string) => {
  if (!raDestinoActivo) { setToast({ message: 'Elegí primero un destino activo', type: 'error' }); return; }
  setRaAsignaciones(prev => {
    const next = new Map(prev);
    const actual = next.get(id);
    if (actual === raDestinoActivo) { next.delete(id); return next; }
    // Respetar la cuota del destino activo
    const cuota = raDestinos.find(d => d.analista === raDestinoActivo)?.cuota ?? 0;
    const yaAsignados = Array.from(next.values()).filter(v => v === raDestinoActivo).length;
    if (actual === undefined && yaAsignados >= cuota) {
      setToast({ message: `${raDestinoActivo} ya llegó a su cuota (${cuota})`, type: 'error' });
      return next;
    }
    next.set(id, raDestinoActivo);
    return next;
  });
}, [raDestinoActivo, raDestinos]);

const raTildarPrimerosN = useCallback(() => {
  if (!raDestinoActivo) { setToast({ message: 'Elegí primero un destino activo', type: 'error' }); return; }
  const cuota = raDestinos.find(d => d.analista === raDestinoActivo)?.cuota ?? 0;
  setRaAsignaciones(prev => {
    const next = new Map(prev);
    let asignados = Array.from(next.values()).filter(v => v === raDestinoActivo).length;
    for (const r of raUniverso) {
      if (asignados >= cuota) break;
      if (!next.has(r.id)) { next.set(r.id, raDestinoActivo); asignados++; }
    }
    return next;
  });
}, [raDestinoActivo, raDestinos, raUniverso]);
```

- [ ] **Step 2: Verificar imports de `useEffect`/`useMemo`/`useCallback`**

`useEffect`, `useMemo` y `useCallback` ya se importan en el archivo (los usa `reasignarMasivo` y otros). No agregar imports duplicados.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores (los setters de Task 1 ahora se usan).

- [ ] **Step 4: Commit**

```bash
git add src/app/ajustes/BulkModifyTab.tsx
git commit -m "feat(reasignar-analistas): universo derivado + cuotas + asignacion manual"
```

---

## Task 3: Handler de guardado (reasignar masivo por analista)

**Files:**
- Modify: `src/app/ajustes/BulkModifyTab.tsx` (después de los handlers de Task 2)

- [ ] **Step 1: Agregar `raGuardar`**

Insertar después de `raTildarPrimerosN`:

```tsx
const raGuardar = useCallback(async () => {
  if (raAsignaciones.size === 0) { setToast({ message: 'No hay registros asignados', type: 'error' }); return; }
  // Agrupar ids por destino
  const grupos: Record<string, string[]> = {};
  for (const [id, dest] of raAsignaciones) (grupos[dest] ??= []).push(id);

  setUpdating(true);
  const CHUNK = 500;
  let actualizados = 0;
  let errores = 0;
  for (const [analista, ids] of Object.entries(grupos)) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await supabase.from('registros').update({ analista }).in('id', slice);
      if (error) { errores += slice.length; continue; }
      actualizados += slice.length;
      const sliceSet = new Set(slice);
      mutateRegistros(prev => prev.map(r => (sliceSet.has(r.id) ? { ...r, analista } : r)));
      pushBulkUpdateIds(slice, { analista });
    }
  }
  setUpdating(false);

  if (errores > 0) {
    setToast({ message: `Reasignados ${actualizados}, ${errores} con error`, type: 'error' });
    return;
  }
  setToast({ message: `${actualizados} registro(s) reasignados`, type: 'success' });
  // Reset
  setRaOrigen('');
  setRaEstados([]);
  setRaScoreMin(''); setRaScoreMax('');
  setRaFechaDesde(''); setRaFechaHasta('');
  setRaDestinos([]);
  setRaAsignaciones(new Map());
  setRaDestinoActivo('');
}, [raAsignaciones, mutateRegistros, pushBulkUpdateIds]);
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/ajustes/BulkModifyTab.tsx
git commit -m "feat(reasignar-analistas): guardado masivo en chunks con update optimista"
```

---

## Task 4: UI — tarjeta colapsable con los 4 pasos

**Files:**
- Modify: `src/app/ajustes/BulkModifyTab.tsx` (insertar después del cierre del bloque "Reasignar Empleador / Dependencia", justo antes de `{(mode === 'all' || mode === 'excel') && (` que renderiza `<AsignarEmpleadorSection>`, ~línea 3167)

- [ ] **Step 1: Insertar la tarjeta JSX**

Pegar este bloque entre `)}` (cierre del reasignador de empleador, ~línea 3166) y el comentario/JSX de `AsignarEmpleadorSection`:

```tsx
{/* ── REASIGNAR REGISTROS ENTRE ANALISTAS ──────────────────────────── */}
{(mode === 'all' || mode === 'corrector') && (
  <div style={{
    marginBottom: '28px', padding: '20px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  }}>
    <div
      onClick={() => setRaExpandido(!raExpandido)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: raExpandido ? 16 : 0, cursor: 'pointer' }}
    >
      <Users size={18} color="#555" />
      <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
        Reasignar Registros entre Analistas
        {raExpandido ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
      </h4>
    </div>

    {raExpandido && (
      <>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: 16, lineHeight: 1.5 }}>
          Elegí un analista origen, acotá por estado/score/fecha (opcional), definí cuántos registros van a cada analista destino y tildalos.
        </div>

        {/* PASO 1: Origen */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#777', fontWeight: 700, marginBottom: 6 }}>1) Analista origen</div>
          <select
            value={raOrigen}
            onChange={e => setRaOrigen(e.target.value)}
            className="form-input"
            style={{ width: '100%', maxWidth: 320 }}
          >
            <option value="">— Elegir analista —</option>
            {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* PASO 2: Filtros opcionales */}
        {raOrigen && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#777', fontWeight: 700, marginBottom: 6 }}>2) Acotar (opcional)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {ESTADOS.map(e => {
                const sel = raEstados.includes(e);
                return (
                  <button
                    key={e}
                    onClick={() => setRaEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])}
                    style={{
                      background: sel ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${sel ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      color: sel ? '#00d4ff' : '#666',
                      borderRadius: 4, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {STATUS_LABEL[e] ?? e}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input className="form-input" type="number" placeholder="Score min" value={raScoreMin} onChange={e => setRaScoreMin(e.target.value)} style={{ width: 110 }} />
              <input className="form-input" type="number" placeholder="Score max" value={raScoreMax} onChange={e => setRaScoreMax(e.target.value)} style={{ width: 110 }} />
              <input className="form-input" type="date" value={raFechaDesde} onChange={e => setRaFechaDesde(e.target.value)} style={{ width: 150 }} />
              <input className="form-input" type="date" value={raFechaHasta} onChange={e => setRaFechaHasta(e.target.value)} style={{ width: 150 }} />
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              <strong style={{ color: '#fff' }}>{raTotalDisponible}</strong> registro(s) disponibles
            </div>
          </div>
        )}

        {/* PASO 3: Cuotas por destino */}
        {raOrigen && raTotalDisponible > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#777', fontWeight: 700, marginBottom: 6 }}>
              3) Cuotas por destino ({raTotalCuotas}/{raTotalDisponible})
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select value={raNuevoDestino} onChange={e => setRaNuevoDestino(e.target.value)} className="form-input" style={{ flex: 1, maxWidth: 220 }}>
                <option value="">— Analista destino —</option>
                {ANALISTAS.filter(a => a !== raOrigen && !raDestinos.some(d => d.analista === a)).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input className="form-input" type="number" placeholder="Cantidad" value={raNuevaCuota} onChange={e => setRaNuevaCuota(e.target.value)} style={{ width: 110 }} />
              <button onClick={raAgregarDestino} className="form-input" style={{ cursor: 'pointer', fontWeight: 700, color: '#00d4ff' }}>+ Agregar</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {raDestinos.map(d => {
                const hechos = raAsignadosPorDestino[d.analista] ?? 0;
                const completo = hechos >= d.cuota;
                const activo = raDestinoActivo === d.analista;
                return (
                  <div
                    key={d.analista}
                    onClick={() => setRaDestinoActivo(d.analista)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      background: activo ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${completo ? 'rgba(74,222,128,0.5)' : activo ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 6, padding: '6px 10px',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: completo ? '#4ade80' : '#ddd' }}>{d.analista}</span>
                    <span style={{ fontSize: 11, color: completo ? '#4ade80' : '#888' }}>{hechos}/{d.cuota}</span>
                    <button onClick={(ev) => { ev.stopPropagation(); raQuitarDestino(d.analista); }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 4: Tildar registros */}
        {raDestinos.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#777', fontWeight: 700 }}>
                4) Tildar para {raDestinoActivo || '— elegí un destino —'}
              </div>
              <button onClick={raTildarPrimerosN} disabled={!raDestinoActivo} className="form-input" style={{ cursor: raDestinoActivo ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 700, color: raDestinoActivo ? '#00d4ff' : '#555' }}>
                Tildar primeros N
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
              {raUniverso.map(r => {
                const dest = raAsignaciones.get(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => raToggleFila(r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                      background: dest ? 'rgba(96,165,250,0.08)' : 'transparent',
                    }}
                  >
                    <input type="checkbox" readOnly checked={!!dest} />
                    <span style={{ flex: 1, fontSize: 12, color: '#ddd' }}>{r.nombre ?? r.cuil ?? r.id}</span>
                    <span style={{ fontSize: 11, color: '#777' }}>{STATUS_LABEL[r.estado ?? ''] ?? r.estado}</span>
                    {dest && <span style={{ fontSize: 11, fontWeight: 700, color: '#00d4ff' }}>→ {dest}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Acción */}
        {raDestinos.length > 0 && (
          <button
            onClick={raGuardar}
            disabled={updating || raAsignaciones.size === 0}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: (updating || raAsignaciones.size === 0) ? '#222' : '#fff',
              color: (updating || raAsignaciones.size === 0) ? '#555' : '#000',
              fontWeight: 800, fontSize: 12, letterSpacing: '0.5px',
              cursor: (updating || raAsignaciones.size === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {updating ? 'REASIGNANDO...' : `REASIGNAR ${raAsignaciones.size} REGISTRO(S)`}
          </button>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Verificar que `Users` esté importado de lucide-react**

`Users` ya se usa en este archivo (icono del tab "Calif. x SCORE" en `page.tsx`), pero confirmá el import en `BulkModifyTab.tsx`. Si no está, agregalo al import existente de `lucide-react`. `ChevronUp`/`ChevronDown`/`Filter` ya están importados (los usa el reasignador de empleador). `STATUS_LABEL` ya está definido en el archivo.

Run: `npm run lint`
Expected: sin errores (si falta `Users`, lint/build lo marcará como no definido → agregarlo).

- [ ] **Step 3: Commit**

```bash
git add src/app/ajustes/BulkModifyTab.tsx
git commit -m "feat(reasignar-analistas): UI de tarjeta con reparto por cuotas"
```

---

## Task 5: Verificación final (build + manual)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript ni de lint.

- [ ] **Step 2: Prueba manual**

Run: `npm run dev` → abrir Ajustes → Reportes → **Calif. x SCORE** (como admin).
Verificar:
1. La tarjeta "Reasignar Registros entre Analistas" aparece y expande.
2. Elegir un origen muestra el conteo de disponibles.
3. Seleccionar varios estados acota el universo y el conteo cambia.
4. Agregar destinos con cuotas; la suma no puede superar el disponible.
5. Elegir destino activo, tildar filas y usar "Tildar primeros N"; el contador por destino avanza y se pone verde al completar.
6. Reasignar guarda y los registros cambian de analista (verificar en la grilla/Resumen).

- [ ] **Step 3: Commit (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(reasignar-analistas): ajustes tras verificacion"
```

---

## Notas de campos del tipo `Registro`

El plan asume estos campos (ya usados en el archivo): `id`, `analista`, `estado`, `puntaje`, `fecha`, `nombre`, `cuil`. Si algún nombre difiere, ajustar en `raUniverso` y en el render del PASO 4. Verificar contra `src/types/index.ts` antes de implementar.
```
