'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { CheckCircle2, AlertCircle, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  parsePastedText, verificarFilas, formatDateAR, ParsedRow, ColumnMapping, ColumnRole, MatchStatus, VerificadorResult,
} from '@/lib/verificador-utils';

const ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: 'ignore',          label: '— Ignorar —'      },
  { value: 'fecha',           label: 'Fecha'            },
  { value: 'tipo_cliente',    label: 'Tipo de cliente'  },
  { value: 'cuil',            label: 'CUIL'             },
  { value: 'apellido_nombre', label: 'Apellido y nombre'},
  { value: 'edad',            label: 'Edad'             },
  { value: 'monto',           label: 'Monto'            },
  { value: 'cuotas',          label: 'Cuotas'           },
  { value: 'analista',        label: 'Analista'         },
];

const ROLE_LABEL: Record<ColumnRole, string> = {
  fecha:           'Fecha',
  tipo_cliente:    'Tipo de cliente',
  cuil:            'CUIL',
  apellido_nombre: 'Apellido y nombre',
  edad:            'Edad',
  monto:           'Monto',
  cuotas:          'Cuotas',
  analista:        'Analista',
  ignore:          '',
};

// Orden fijo de columnas en resultados
const ROLE_ORDER: ColumnRole[] = [
  'fecha', 'tipo_cliente', 'cuil', 'apellido_nombre', 'edad', 'monto', 'cuotas', 'analista',
];

const STATUS_CONFIG = {
  found:     { label: 'Encontrado',        color: '#4ade80', Icon: CheckCircle2 },
  mismatch:  { label: 'Importe diferente', color: '#fbbf24', Icon: AlertCircle  },
  not_found: { label: 'No encontrado',     color: '#f87171', Icon: XCircle      },
};

export default function VerificadorTab() {
  const { registros, refresh } = useRegistros();
  const [rawText, setRawText] = useState('');
  const [rows, setRows]       = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [verified, setVerified] = useState(false);

  const colCount = useMemo(() => rows.reduce((max, r) => Math.max(max, r.cells.length), 0), [rows]);
  const hasCuil  = Object.values(mapping).includes('cuil');
  const results  = useMemo<VerificadorResult[] | null>(
    () => verified ? verificarFilas(rows, mapping, registros) : null,
    [verified, rows, mapping, registros],
  );

  const handlePaste = (text: string) => {
    setRawText(text);
    setRows(parsePastedText(text));
    setMapping({});
    setVerified(false);
  };

  const handleReset = () => { setRawText(''); setRows([]); setMapping({}); setVerified(false); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Verificador de Excel</h3>
          <p style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
            Pegá celdas copiadas de Excel y cruzalas contra los registros cargados.
          </p>
        </div>
        {(rows.length > 0 || results) && (
          <button onClick={handleReset} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
            color: '#777', cursor: 'pointer', fontSize: 12,
          }}>
            <RotateCcw size={12} /> Nueva consulta
          </button>
        )}
      </div>

      {/* Textarea — always visible unless showing results */}
      {!results && (
        <div>
          <textarea
            value={rawText}
            onChange={e => handlePaste(e.target.value)}
            placeholder="Copiá las celdas desde Excel y pegá aquí..."
            rows={7}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, color: '#e5e5e5',
              fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7,
              padding: '12px 14px', resize: 'vertical', outline: 'none',
            }}
          />
          <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
            Copiá desde Excel incluyendo la columna de CUIL — es el campo requerido para cruzar contra la base.
            Podés incluir también Nombre, Mes e Importe en columnas separadas.
          </p>
          {rows.length > 0 && (
            <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              {rows.length} fila{rows.length !== 1 ? 's' : ''} · {colCount} columna{colCount !== 1 ? 's' : ''} detectadas
            </p>
          )}
        </div>
      )}

      {/* Column mapping */}
      {rows.length > 0 && !results && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Asignar columnas
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {Array.from({ length: colCount }, (_, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', background: 'rgba(255,255,255,0.02)' }}>
                      <select
                        value={mapping[i] ?? 'ignore'}
                        onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as ColumnRole }))}
                        style={{
                          background: '#111', color: '#ccc',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 5, padding: '5px 8px',
                          fontSize: 11, cursor: 'pointer', outline: 'none',
                        }}
                      >
                        {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {Array.from({ length: colCount }, (_, ci) => (
                      <td key={ci} style={{ padding: '8px 12px', color: '#888' }}>
                        {row.cells[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && (
            <p style={{ fontSize: 11, color: '#555', marginTop: 6 }}>... y {rows.length - 8} filas más</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setVerified(true)}
              disabled={!hasCuil}
              style={{
                padding: '9px 24px',
                background: hasCuil ? '#fff' : 'rgba(255,255,255,0.07)',
                color: hasCuil ? '#000' : '#444',
                border: 'none', borderRadius: 7,
                fontWeight: 700, fontSize: 13,
                cursor: hasCuil ? 'pointer' : 'not-allowed',
              }}
            >
              Verificar {rows.length} fila{rows.length !== 1 ? 's' : ''}
            </button>
            {!hasCuil && (
              <span style={{ fontSize: 12, color: '#666' }}>
                Asigná al menos la columna CUIL para continuar
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && <ResultsTable results={results} mapping={mapping} colCount={colCount} onDeleted={() => refresh(true)} />}
    </div>
  );
}


const FILTER_SELECT_STYLE: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4,
  background: '#111', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4, color: '#aaa', fontSize: 11, padding: '5px 7px', outline: 'none',
  cursor: 'pointer', minWidth: 100,
};

function ResultsTable({ results, mapping, colCount, onDeleted }: {
  results: VerificadorResult[];
  mapping: ColumnMapping;
  colCount: number;
  onDeleted: () => void;
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<MatchStatus>>(new Set());
  const [colFilters, setColFilters]             = useState<Record<string, string>>({});
  const [search, setSearch]                     = useState('');
  const [deleting, setDeleting]                 = useState(false);
  const [deleteResult, setDeleteResult]         = useState<{ deleted: number } | null>(null);
  const [deleteError, setDeleteError]           = useState<string | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const toggleStatus = (s: MatchStatus) =>
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const setCol = (key: string, val: string) =>
    setColFilters(prev => ({ ...prev, [key]: val }));

  const hasFilters = selectedStatuses.size > 0 || Object.values(colFilters).some(Boolean) || !!search;
  const clearAll   = () => { setSelectedStatuses(new Set()); setColFilters({}); setSearch(''); };

  // Valores únicos por columna
  const uniqueVals = useMemo(() => {
    const map: Record<string, string[]> = {};
    const addVal = (key: string, v: string) => {
      if (!v) return;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(v)) map[key].push(v);
    };
    results.forEach(r => {
      Object.entries(mapping).forEach(([ci]) => addVal(ci, r.row.cells[Number(ci)] ?? ''));
      addVal('dbImporte', r.dbImporte != null ? `$${r.dbImporte.toLocaleString('es-AR')}` : '');
      addVal('dbFecha',  r.dbFecha  ?? '');
      addVal('dbEstado', r.dbEstado ?? '');
    });
    return map;
  }, [results, mapping]);

  const visible = results
    .filter(r => selectedStatuses.size === 0 || selectedStatuses.has(r.status as MatchStatus))
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.row.cells.some(c => c.toLowerCase().includes(q))
        || (r.dbFecha ?? '').toLowerCase().includes(q)
        || (r.dbEstado ?? '').toLowerCase().includes(q)
        || (r.dbImporte != null && `${r.dbImporte}`.includes(q));
    })
    .filter(r => {
      for (const [key, val] of Object.entries(colFilters)) {
        if (!val) continue;
        if (key === 'dbImporte') {
          const label = r.dbImporte != null ? `$${r.dbImporte.toLocaleString('es-AR')}` : '';
          if (label !== val) return false;
        } else if (key === 'dbFecha') {
          if ((r.dbFecha ?? '') !== val) return false;
        } else if (key === 'dbEstado') {
          if ((r.dbEstado ?? '') !== val) return false;
        } else {
          if ((r.row.cells[Number(key)] ?? '') !== val) return false;
        }
      }
      return true;
    });

  const montoColIndex = useMemo(() =>
    Object.entries(mapping).find(([, r]) => r === 'monto')?.[0], [mapping]);

  const cuilColIndex = useMemo(() =>
    Object.entries(mapping).find(([, r]) => r === 'cuil')?.[0], [mapping]);

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

  const idsToDelete = useMemo(() => {
    if (cuilColIndex === undefined) return [];
    const firstSeen = new Map<string, boolean>();
    const ids: string[] = [];
    results.forEach(r => {
      if (r.status !== 'found' || !r.dbId) return;
      const cuil = (r.row.cells[Number(cuilColIndex)] ?? '').trim();
      if (!duplicateCuils.has(cuil)) return;
      if (!firstSeen.has(cuil)) {
        firstSeen.set(cuil, true);
      } else {
        ids.push(r.dbId);
      }
    });
    return ids;
  }, [results, mapping, duplicateCuils, cuilColIndex]);

  useEffect(() => {
    setSelectedForDeletion(new Set(idsToDelete));
    setConfirming(false);
    setDeleteResult(null);
    setDeleteError(null);
  }, [idsToDelete.join(',')]);

  const toggleSelected = (id: string) =>
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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

  const parseMontoExcel = (raw: string): number => {
    if (!raw) return 0;
    const isArgentine = raw.indexOf(',') > raw.indexOf('.');
    const normalized = isArgentine
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
    return parseFloat(normalized.replace(/[$\s]/g, '')) || 0;
  };

  const totalMonto = visible.reduce((sum, r) => {
    if (r.dbImporte != null) return sum + r.dbImporte;
    if (montoColIndex !== undefined) return sum + parseMontoExcel(r.row.cells[Number(montoColIndex)] ?? '');
    return sum;
  }, 0);

  const STATUS_OPTS: { key: MatchStatus; label: string }[] = [
    { key: 'found',     label: 'Encontrado'        },
    { key: 'mismatch',  label: 'Importe diferente' },
    { key: 'not_found', label: 'No encontrado'     },
  ];

  // Columnas activas en orden fijo
  const orderedCols: { role: ColumnRole; colIndex: number }[] = ROLE_ORDER
    .map(role => {
      const entry = Object.entries(mapping).find(([, r]) => r === role);
      return entry ? { role, colIndex: Number(entry[0]) } : null;
    })
    .filter((x): x is { role: ColumnRole; colIndex: number } => x !== null);

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', color: '#555',
    fontWeight: 700, fontSize: 11, letterSpacing: '0.05em',
    whiteSpace: 'nowrap', verticalAlign: 'top', minWidth: 120,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

      {deleteError && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 8,
          fontSize: 12, color: '#f87171', fontWeight: 600,
        }}>
          Error al eliminar: {deleteError}
        </div>
      )}

      {/* Active filters bar */}
      {hasFilters && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 14px', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
        }}>
          <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>Filtros activos:</span>
          {Array.from(selectedStatuses).map(s => (
            <span key={s} onClick={() => toggleStatus(s)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.08)', color: STATUS_CONFIG[s].color,
              border: `1px solid ${STATUS_CONFIG[s].color}44`, cursor: 'pointer',
            }}>
              {STATUS_CONFIG[s].label} ×
            </span>
          ))}
          {Object.entries(colFilters).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} onClick={() => setCol(k, '')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', color: '#ccc',
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
            }}>
              {v} ×
            </span>
          ))}
          {search && (
            <span onClick={() => setSearch('')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', color: '#ccc',
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
            }}>
              "{search}" ×
            </span>
          )}
          <button onClick={clearAll} style={{
            marginLeft: 'auto', padding: '3px 10px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
            color: '#555', cursor: 'pointer', fontSize: 11,
          }}>Limpiar todo</button>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar en todos los campos..."
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, color: '#e5e5e5', fontSize: 13, padding: '9px 14px', outline: 'none',
        }}
      />

      {/* Estado toggle pills */}
      <div>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Estado (seleccioná los que querés filtrar)
          {selectedStatuses.size > 0 && <span style={{ color: '#4ade80', marginLeft: 8 }}>· {selectedStatuses.size} seleccionado{selectedStatuses.size > 1 ? 's' : ''}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_OPTS.map(({ key, label }) => {
            const active = selectedStatuses.has(key);
            const count = results.filter(r => r.status === key).length;
            return (
              <button key={key} onClick={() => toggleStatus(key)} style={{
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: active ? '#fff' : 'transparent',
                color: active ? '#000' : '#666',
                border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.12)',
              }}>
                {label} <span style={{ fontWeight: 400, opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: '#666' }}>
          Mostrando <span style={{ color: '#fff', fontWeight: 700 }}>{visible.length}</span> de {results.length} filas
        </span>
        <span style={{ fontSize: 12, color: '#666' }}>
          Total monto: <span style={{ color: '#fff', fontWeight: 700 }}>${totalMonto.toLocaleString('es-AR')}</span>
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'auto' }}>
          <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <tr>
              {orderedCols.map(({ role, colIndex }) => (
                <th key={role} style={thStyle}>
                  {ROLE_LABEL[role].toUpperCase()}
                  <FilterSelect
                    filterKey={String(colIndex)}
                    value={colFilters[colIndex] ?? ''}
                    options={uniqueVals[colIndex] ?? []}
                    onChange={setCol}
                    formatOption={role === 'fecha' ? formatDateAR : undefined}
                  />
                </th>
              ))}
              <th style={thStyle}>ESTADO</th>
              <th style={thStyle}>
                MONTO DB
                <FilterSelect filterKey="dbImporte" value={colFilters['dbImporte'] ?? ''} options={uniqueVals['dbImporte'] ?? []} onChange={setCol} />
              </th>
              <th style={thStyle}>
                FECHA DB
                <FilterSelect filterKey="dbFecha" value={colFilters['dbFecha'] ?? ''} options={uniqueVals['dbFecha'] ?? []} onChange={setCol} formatOption={formatDateAR} />
              </th>
              <th style={thStyle}>
                ESTADO DB
                <FilterSelect filterKey="dbEstado" value={colFilters['dbEstado'] ?? ''} options={uniqueVals['dbEstado'] ?? []} onChange={setCol} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((res, idx) => {
              const { color, Icon } = STATUS_CONFIG[res.status];
              return (
                <tr key={idx} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: (() => {
                    if (res.status !== 'found' || cuilColIndex === undefined) return undefined;
                    const cuil = (res.row.cells[Number(cuilColIndex)] ?? '').trim();
                    return duplicateCuils.has(cuil) ? 'rgba(248,113,113,0.07)' : undefined;
                  })(),
                }}>
                  {orderedCols.map(({ role, colIndex }) => {
                    const raw = res.row.cells[colIndex] ?? '';
                    const display = role === 'fecha' ? formatDateAR(raw) : raw;
                    return (
                      <td key={role} style={{ padding: '9px 14px', color: '#aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {display}
                      </td>
                    );
                  })}
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color, fontWeight: 600 }}>
                      <Icon size={12} />
                      {STATUS_CONFIG[res.status].label}
                    </span>
                    {res.diffDetail && <span style={{ color: '#666', fontSize: 11, marginLeft: 8 }}>{res.diffDetail}</span>}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#aaa', whiteSpace: 'nowrap' }}>
                    {res.dbImporte != null ? `$${res.dbImporte.toLocaleString('es-AR')}` : <span style={{ color: '#444' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#aaa', whiteSpace: 'nowrap' }}>
                    {res.dbFecha ? formatDateAR(res.dbFecha) : <span style={{ color: '#444' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#aaa', whiteSpace: 'nowrap' }}>
                    {res.dbEstado ?? <span style={{ color: '#444' }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={orderedCols.length + 4} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>
                  No hay resultados con los filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({ filterKey, value, options, onChange, formatOption }: {
  filterKey: string;
  value: string;
  options: string[];
  onChange: (key: string, val: string) => void;
  formatOption?: (v: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={e => onChange(filterKey, e.target.value)}
      style={FILTER_SELECT_STYLE}
    >
      <option value="">Todos</option>
      {options.sort().map(o => (
        <option key={o} value={o}>{formatOption ? formatOption(o) : o}</option>
      ))}
    </select>
  );
}
