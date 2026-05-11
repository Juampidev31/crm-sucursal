# Verificador Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar tab "Verificador" en Ajustes (solo admins) que permite pegar texto copiado de Excel, mapear columnas, y cruzar contra registros en DB para ver cuáles están cargados.

**Architecture:** `VerificadorTab.tsx` es un componente self-contained que consume `useRegistros()`. El parser de texto pegado y la lógica de matching viven en `src/lib/verificador-utils.ts`. `page.tsx` solo agrega la entrada en la lista de tabs y renderiza el componente.

**Tech Stack:** React, TypeScript, `useRegistros` hook existente, sin nuevas dependencias.

---

### Task 1: Utilidades de parsing y matching

**Files:**
- Create: `src/lib/verificador-utils.ts`

- [ ] **Step 1: Crear el archivo con tipos y parser de texto tabulado**

```typescript
// src/lib/verificador-utils.ts

export type ColumnRole = 'cuil' | 'nombre' | 'mes' | 'importe' | 'ignore';

export interface ParsedRow {
  cells: string[];
}

export interface ColumnMapping {
  [colIndex: number]: ColumnRole;
}

export type MatchStatus = 'found' | 'mismatch' | 'not_found';

export interface VerificadorResult {
  row: ParsedRow;
  status: MatchStatus;
  dbImporte?: number;
  dbFecha?: string;
  dbEstado?: string;
  diffDetail?: string;
}

/** Parsea texto copiado de Excel (separado por \t y \n). Máx 500 filas. */
export function parsePastedText(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim() !== '')
    .slice(0, 500)
    .map(line => ({ cells: line.split('\t') }));
}
```

- [ ] **Step 2: Agregar función de normalización de CUIL y parsing de mes**

```typescript
/** Normaliza CUIL eliminando guiones y espacios */
export function normalizeCuil(raw: string): string {
  return raw.replace(/[-\s]/g, '').trim();
}

const MESES_ES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

/**
 * Extrae YYYY-MM de varios formatos:
 * "01/2025", "enero 2025", "15/01/2025", "2025-01-15"
 * Devuelve null si no puede parsear.
 */
export function extractYearMonth(raw: string): string | null {
  const s = raw.trim().toLowerCase();

  // "01/2025"
  const m1 = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[2]}-${m1[1].padStart(2, '0')}`;

  // "15/01/2025"
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}`;

  // "2025-01-15"
  const m3 = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (m3) return `${m3[1]}-${m3[2]}`;

  // "enero 2025"
  for (const [nombre, num] of Object.entries(MESES_ES)) {
    if (s.includes(nombre)) {
      const yearMatch = s.match(/\d{4}/);
      if (yearMatch) return `${yearMatch[0]}-${num}`;
    }
  }

  return null;
}
```

- [ ] **Step 3: Agregar función principal de matching**

```typescript
import { Registro } from '@/types';

/**
 * Cruza filas parseadas contra registros de DB.
 * Si no hay columna de mes mapeada, busca cualquier registro del CUIL.
 */
export function verificarFilas(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  dbRecords: Registro[],
): VerificadorResult[] {
  const dbByCuil = new Map<string, Registro[]>();
  dbRecords.forEach(r => {
    const key = normalizeCuil(r.cuil);
    const list = dbByCuil.get(key) ?? [];
    list.push(r);
    dbByCuil.set(key, list);
  });

  const cuilCol = Object.entries(mapping).find(([, role]) => role === 'cuil')?.[0];
  const mesCol = Object.entries(mapping).find(([, role]) => role === 'mes')?.[0];
  const importeCol = Object.entries(mapping).find(([, role]) => role === 'importe')?.[0];

  return rows.map(row => {
    if (cuilCol === undefined) return { row, status: 'not_found' as MatchStatus };

    const rawCuil = row.cells[Number(cuilCol)] ?? '';
    const cuil = normalizeCuil(rawCuil);
    const candidates = dbByCuil.get(cuil) ?? [];

    if (candidates.length === 0) return { row, status: 'not_found' };

    // Filtrar por mes si hay columna de mes
    let pool = candidates;
    if (mesCol !== undefined) {
      const rawMes = row.cells[Number(mesCol)] ?? '';
      const ym = extractYearMonth(rawMes);
      if (ym) {
        pool = candidates.filter(r => r.fecha?.substring(0, 7) === ym);
      }
    }

    if (pool.length === 0) return { row, status: 'not_found' };

    // Comparar importe si hay columna de importe
    if (importeCol !== undefined) {
      const rawImporte = row.cells[Number(importeCol)] ?? '';
      const csvImporte = parseFloat(rawImporte.replace(/[.,\s$]/g, match =>
        match === ',' ? (rawImporte.indexOf(',') > rawImporte.indexOf('.') ? '.' : '') : ''
      ));

      if (!isNaN(csvImporte)) {
        const exact = pool.find(r => Math.abs(r.monto - csvImporte) <= 1);
        if (exact) {
          return { row, status: 'found', dbImporte: exact.monto, dbFecha: exact.fecha ?? undefined, dbEstado: exact.estado };
        }
        // Mismo mes/CUIL pero importe diferente
        const first = pool[0];
        return {
          row, status: 'mismatch',
          dbImporte: first.monto,
          dbFecha: first.fecha ?? undefined,
          dbEstado: first.estado,
          diffDetail: `Excel $${csvImporte.toLocaleString('es-AR')} — DB $${first.monto.toLocaleString('es-AR')}`,
        };
      }
    }

    // Sin importe o no parseable → encontrado si hay candidato
    const first = pool[0];
    return { row, status: 'found', dbImporte: first.monto, dbFecha: first.fecha ?? undefined, dbEstado: first.estado };
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/verificador-utils.ts
git commit -m "feat: agregar utilidades de parsing y matching para verificador excel"
```

---

### Task 2: Componente VerificadorTab

**Files:**
- Create: `src/app/ajustes/VerificadorTab.tsx`

- [ ] **Step 1: Crear estructura base con textarea y estado**

```typescript
'use client';

import React, { useState, useMemo } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { Search, CheckCircle2, AlertCircle, XCircle, ChevronDown } from 'lucide-react';
import {
  parsePastedText, verificarFilas, ParsedRow, ColumnMapping, ColumnRole, VerificadorResult,
} from '@/lib/verificador-utils';

const ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: 'ignore', label: '— Ignorar —' },
  { value: 'cuil', label: 'CUIL' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'mes', label: 'Mes' },
  { value: 'importe', label: 'Importe' },
];

export default function VerificadorTab() {
  const { registros } = useRegistros();
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [results, setResults] = useState<VerificadorResult[] | null>(null);

  const colCount = useMemo(() => Math.max(0, ...rows.map(r => r.cells.length)), [rows]);

  const handlePaste = (text: string) => {
    setRawText(text);
    const parsed = parsePastedText(text);
    setRows(parsed);
    setMapping({});
    setResults(null);
  };

  const handleVerificar = () => {
    setResults(verificarFilas(rows, mapping, registros));
  };

  const hasCuilMapped = Object.values(mapping).includes('cuil');

  // render below
}
```

- [ ] **Step 2: Agregar render del textarea y preview de columnas**

Reemplazar el comentario `// render below` con:

```typescript
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Verificador</h3>
        <p style={{ fontSize: 13, color: 'var(--gris)' }}>
          Pegá datos copiados de Excel. Asigná las columnas y presioná Verificar.
        </p>
      </div>

      {/* Textarea */}
      <textarea
        value={rawText}
        onChange={e => handlePaste(e.target.value)}
        placeholder="Pegá aquí el contenido copiado de Excel..."
        rows={6}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: '#fff', fontFamily: 'monospace', fontSize: 12, padding: 12,
          resize: 'vertical', outline: 'none',
        }}
      />

      {/* Preview + mapeo de columnas */}
      {rows.length > 0 && !results && (
        <div style={{ overflowX: 'auto' }}>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            {rows.length} fila(s) detectada(s). Asigná cada columna:
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {Array.from({ length: colCount }, (_, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <select
                      value={mapping[i] ?? 'ignore'}
                      onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as ColumnRole }))}
                      style={{ background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px 8px', fontSize: 11 }}
                    >
                      {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {Array.from({ length: colCount }, (_, ci) => (
                    <td key={ci} style={{ padding: '6px 12px', color: '#aaa' }}>
                      {row.cells[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>... y {rows.length - 10} filas más</p>
          )}

          <button
            onClick={handleVerificar}
            disabled={!hasCuilMapped}
            style={{
              marginTop: 16, padding: '10px 28px', background: hasCuilMapped ? '#fff' : 'rgba(255,255,255,0.1)',
              color: hasCuilMapped ? '#000' : '#555', border: 'none', borderRadius: 6,
              fontWeight: 700, fontSize: 13, cursor: hasCuilMapped ? 'pointer' : 'not-allowed',
            }}
          >
            Verificar
          </button>
          {!hasCuilMapped && (
            <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>Asigná al menos la columna CUIL para verificar.</p>
          )}
        </div>
      )}

      {/* Resultados */}
      {results && (
        <ResultsTable results={results} mapping={mapping} colCount={colCount} onReset={() => { setResults(null); }} />
      )}
    </div>
  );
```

- [ ] **Step 3: Agregar componente ResultsTable al final del archivo**

```typescript
function ResultsTable({
  results, mapping, colCount, onReset,
}: {
  results: VerificadorResult[];
  mapping: ColumnMapping;
  colCount: number;
  onReset: () => void;
}) {
  const found = results.filter(r => r.status === 'found').length;
  const mismatch = results.filter(r => r.status === 'mismatch').length;
  const notFound = results.filter(r => r.status === 'not_found').length;

  const STATUS_CONFIG = {
    found:     { label: 'Encontrado',        color: '#4ade80', Icon: CheckCircle2 },
    mismatch:  { label: 'Importe diferente', color: '#fbbf24', Icon: AlertCircle },
    not_found: { label: 'No encontrado',     color: '#f87171', Icon: XCircle },
  };

  return (
    <div>
      {/* Resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Encontrados', value: found, color: '#4ade80' },
          { label: 'Importe diferente', value: mismatch, color: '#fbbf24' },
          { label: 'No encontrados', value: notFound, color: '#f87171' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
        <button onClick={onReset} style={{ marginLeft: 'auto', alignSelf: 'center', padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#888', cursor: 'pointer', fontSize: 12 }}>
          Nueva consulta
        </button>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <tr>
              {Array.from({ length: colCount }, (_, i) => {
                const role = mapping[i];
                const roleLabel = role && role !== 'ignore' ? ` (${role})` : '';
                return <th key={i} style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Col {i + 1}{roleLabel}</th>;
              })}
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Estado</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>DB — Importe</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>DB — Fecha</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>DB — Estado</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, idx) => {
              const { label, color, Icon } = STATUS_CONFIG[res.status];
              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {Array.from({ length: colCount }, (_, ci) => (
                    <td key={ci} style={{ padding: '8px 12px', color: '#ccc' }}>{res.row.cells[ci] ?? ''}</td>
                  ))}
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
                      <Icon size={13} />
                      {label}
                      {res.diffDetail && <span style={{ color: '#888', fontSize: 11 }}>— {res.diffDetail}</span>}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#aaa' }}>{res.dbImporte != null ? `$${res.dbImporte.toLocaleString('es-AR')}` : '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#aaa' }}>{res.dbFecha ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#aaa' }}>{res.dbEstado ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/ajustes/VerificadorTab.tsx
git commit -m "feat: agregar componente VerificadorTab con mapeo de columnas y resultados"
```

---

### Task 3: Registrar tab en Ajustes

**Files:**
- Modify: `src/app/ajustes/page.tsx`

- [ ] **Step 1: Agregar 'verificador' al tipo ActiveTab (línea 30)**

Cambiar:
```typescript
type ActiveTab = 'alertas' | 'dias' | 'historico' | 'objetivos' | 'duplicados' | 'auditoria' | 'resumen-mensual' | 'modificacion-masiva' | 'calif-score' | 'avisos';
```
Por:
```typescript
type ActiveTab = 'alertas' | 'dias' | 'historico' | 'objetivos' | 'duplicados' | 'auditoria' | 'resumen-mensual' | 'modificacion-masiva' | 'calif-score' | 'avisos' | 'verificador';
```

- [ ] **Step 2: Agregar import del componente y del ícono**

Al inicio del archivo, agregar el import del componente (junto a los demás imports de tabs):
```typescript
import VerificadorTab from './VerificadorTab';
```

El ícono `Search` ya está importado desde lucide-react (línea 17).

- [ ] **Step 3: Agregar entrada en la lista de tabs (dentro del bloque `isAdmin`, línea ~547)**

En el array de tabs, dentro del bloque `...(isAdmin ? [...] : [])`, agregar al final:
```typescript
{ id: 'verificador', label: 'Verificador', icon: Search },
```

Quedará:
```typescript
...(isAdmin ? [
  { id: 'modificacion-masiva', label: 'Corrector', icon: ShieldCheck },
  { id: 'calif-score', label: 'Calif. x SCORE', icon: Users },
  { id: 'avisos', label: 'Avisos', icon: Bell },
  { id: 'verificador', label: 'Verificador', icon: Search },
] : []),
```

- [ ] **Step 4: Agregar render del tab (después de la línea ~1549 donde está avisos)**

Agregar:
```typescript
{activeTab === 'verificador' && isAdmin && (
  <VerificadorTab />
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/ajustes/page.tsx
git commit -m "feat: registrar tab Verificador en módulo Ajustes (solo admins)"
```
