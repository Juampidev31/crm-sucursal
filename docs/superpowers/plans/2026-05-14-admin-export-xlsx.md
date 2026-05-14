# Admin Export XLSX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only button in the Sidebar that opens a modal to download a filtered XLSX of all registros (filterable by fecha desde/hasta and empleador).

**Architecture:** Client opens a modal with filters → POSTs to `/api/admin/export-xlsx` with filter params and `X-Session` header → server validates `rol === 'admin'`, queries Supabase, generates XLSX with SheetJS, returns binary file → client downloads it. Auth is client-side localStorage session forwarded as a header, consistent with the rest of the app.

**Tech Stack:** Next.js App Router, SheetJS (`xlsx`), Supabase, TypeScript, React

---

## File Map

| Action | File |
|--------|------|
| Create | `src/components/ExportXlsxModal.tsx` |
| Create | `src/app/api/admin/export-xlsx/route.ts` |
| Modify | `src/components/Sidebar.tsx` |

---

### Task 1: Install SheetJS

- [ ] **Step 1: Install xlsx package**

```bash
npm install xlsx
```

Expected output: `added 1 package` (or similar, no errors)

- [ ] **Step 2: Verify install**

```bash
node -e "require('xlsx'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install xlsx (SheetJS) for admin export"
```

---

### Task 2: Create the API Route

**Files:**
- Create: `src/app/api/admin/export-xlsx/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/admin/export-xlsx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { utils, write } from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function isAdminSession(req: NextRequest): boolean {
  const header = req.headers.get('x-session');
  if (!header) return false;
  try {
    const session = JSON.parse(header);
    return session?.rol === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminSession(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fechaDesde, fechaHasta, empleador } = await req.json() as {
    fechaDesde?: string;
    fechaHasta?: string;
    empleador?: string;
  };

  let query = supabase
    .from('registros')
    .select('nombre,cuil,analista,estado,monto,fecha,puntaje,es_re,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,dependencia,localidad,comentarios')
    .order('fecha', { ascending: false });

  if (fechaDesde) query = query.gte('fecha', fechaDesde);
  if (fechaHasta) query = query.lte('fecha', fechaHasta);
  if (empleador?.trim()) query = query.eq('empleador', empleador.trim());

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ws = utils.json_to_sheet(data ?? []);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Registros');
  const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="registros-${today}.xlsx"`,
    },
  });
}
```

- [ ] **Step 2: Check env vars — make sure `NEXT_PUBLIC_SUPABASE_URL` and at least one of `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in `.env.local`**

```bash
grep -E "SUPABASE" .env.local
```

Expected: at least two lines with the URL and a key.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/export-xlsx/route.ts
git commit -m "feat(admin): POST /api/admin/export-xlsx server-side XLSX generation"
```

---

### Task 3: Create ExportXlsxModal component

**Files:**
- Create: `src/components/ExportXlsxModal.tsx`

- [ ] **Step 1: Create the modal file**

```typescript
// src/components/ExportXlsxModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportXlsxModal({ open, onClose }: Props) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [empleador, setEmpleador] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleDownload() {
    setLoading(true);
    setError('');
    try {
      const session = localStorage.getItem('ventas_pro_session') ?? '';
      const res = await fetch('/api/admin/export-xlsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session': session,
        },
        body: JSON.stringify({ fechaDesde, fechaHasta, empleador }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? 'Error al exportar');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registros-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('Error de red al exportar');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 14, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontSize: 12, color: '#aaa',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1a1a2e', borderRadius: 16, padding: 28, width: 360,
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Exportar XLSX</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <X size={18} />
          </button>
        </div>

        <div>
          <label style={labelStyle}>Fecha desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Fecha hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Empleador (opcional)</label>
          <input
            type="text"
            value={empleador}
            onChange={e => setEmpleador(e.target.value)}
            placeholder="Dejar vacío para todos"
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 0', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#374151' : '#16a34a', color: '#fff',
            fontWeight: 700, fontSize: 14,
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Generando...' : 'Descargar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportXlsxModal.tsx
git commit -m "feat(admin): ExportXlsxModal component con filtros fecha y empleador"
```

---

### Task 4: Add button in Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

The "Exportar CSV" button lives at lines ~286-300. The `isAdmin` check is already imported via `useAuth()` at line 111.

- [ ] **Step 1: Add import for ExportXlsxModal and FileSpreadsheet icon**

Find the existing imports block at the top of `src/components/Sidebar.tsx`. Add:

```typescript
import { ExportXlsxModal } from '@/components/ExportXlsxModal';
```

Also add `FileSpreadsheet` to the existing lucide-react import line (it already imports other icons).

- [ ] **Step 2: Add state for modal in the Sidebar component body**

Find the line `const [showAdminModal, setShowAdminModal] = useState(false);` (~line 114) and add right below it:

```typescript
const [showXlsxModal, setShowXlsxModal] = useState(false);
```

- [ ] **Step 3: Add the button after the CSV button and render the modal**

Find the closing `</div>` of the "Exportar CSV" button block (after line 300). The block ends with:
```tsx
            </div>
          </>
        )}
```

Replace that with:
```tsx
            </div>

            {isAdmin && (
              <div className="sidebar-icon-btn" data-label="Exportar XLSX">
                <button
                  onClick={() => setShowXlsxModal(true)}
                  className="green-hover-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 52, height: 52,
                    borderRadius: 13,
                    background: 'rgba(255,255,255,0.04)', color: '#888',
                    border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                  }}
                >
                  <FileSpreadsheet size={22} strokeWidth={2} />
                </button>
              </div>
            )}
          </>
        )}

        <ExportXlsxModal open={showXlsxModal} onClose={() => setShowXlsxModal(false)} />
```

- [ ] **Step 4: Verify the app compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript or compilation errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(admin): botón Exportar XLSX en Sidebar visible solo para admin"
```

---

## Self-Review

**Spec coverage:**
- ✅ Admin-only: `isAdminSession()` on server + `{isAdmin && ...}` on client
- ✅ Modal separado con sus propios filtros
- ✅ Filtros: fecha desde, fecha hasta, empleador
- ✅ XLSX generado server-side con SheetJS
- ✅ Todas las columnas de Registro incluidas
- ✅ Botón en Sidebar junto al CSV existente
- ✅ Descarga directa al browser

**Placeholder scan:** None found.

**Type consistency:** `fechaDesde`, `fechaHasta`, `empleador` used consistently across modal and route.
