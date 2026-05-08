'use client';

import React, { useState, useMemo } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { CheckCircle2, AlertCircle, XCircle, RotateCcw } from 'lucide-react';
import {
  parsePastedText, verificarFilas, formatDateAR, ParsedRow, ColumnMapping, ColumnRole, VerificadorResult,
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
  const { registros } = useRegistros();
  const [rawText, setRawText] = useState('');
  const [rows, setRows]       = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [results, setResults] = useState<VerificadorResult[] | null>(null);

  const colCount = useMemo(() => rows.reduce((max, r) => Math.max(max, r.cells.length), 0), [rows]);
  const hasCuil  = Object.values(mapping).includes('cuil');

  const handlePaste = (text: string) => {
    setRawText(text);
    setRows(parsePastedText(text));
    setMapping({});
    setResults(null);
  };

  const handleReset = () => { setRawText(''); setRows([]); setMapping({}); setResults(null); };

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
              onClick={() => setResults(verificarFilas(rows, mapping, registros))}
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
      {results && <ResultsTable results={results} mapping={mapping} colCount={colCount} />}
    </div>
  );
}


const FILTER_SELECT_STYLE: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4,
  background: '#111', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4, color: '#aaa', fontSize: 11, padding: '5px 7px', outline: 'none',
  cursor: 'pointer', minWidth: 100,
};

function ResultsTable({ results, mapping, colCount }: {
  results: VerificadorResult[];
  mapping: ColumnMapping;
  colCount: number;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'found' | 'mismatch' | 'not_found'>('all');
  const [colFilters, setColFilters]     = useState<Record<string, string>>({});
  const [search, setSearch]             = useState('');

  const found    = results.filter(r => r.status === 'found').length;
  const mismatch = results.filter(r => r.status === 'mismatch').length;
  const notFound = results.filter(r => r.status === 'not_found').length;

  const setCol = (key: string, val: string) =>
    setColFilters(prev => ({ ...prev, [key]: val }));


  // Valores únicos por columna (para los selects de filtro)
  const uniqueVals = useMemo(() => {
    const map: Record<string, string[]> = {};
    const addVal = (key: string, v: string) => {
      if (!v) return;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(v)) map[key].push(v);
    };
    results.forEach(r => {
      Object.entries(mapping).forEach(([ci]) => {
        addVal(ci, r.row.cells[Number(ci)] ?? '');
      });
      addVal('dbImporte', r.dbImporte != null ? `$${r.dbImporte.toLocaleString('es-AR')}` : '');
      addVal('dbFecha',   r.dbFecha   ?? '');
      addVal('dbEstado',  r.dbEstado  ?? '');
    });
    return map;
  }, [results, mapping]);

  const visible = results
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
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

  const STATUS_FILTERS = [
    { key: 'all'       as const, label: 'Todos',           value: results.length, color: '#fff'    },
    { key: 'found'     as const, label: 'Encontrados',     value: found,          color: '#4ade80' },
    { key: 'mismatch'  as const, label: 'Importe dif.',    value: mismatch,       color: '#fbbf24' },
    { key: 'not_found' as const, label: 'No encontrados',  value: notFound,       color: '#f87171' },
  ];

  // Columnas activas en orden fijo (solo las que el usuario asignó)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar en todos los campos..."
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: '#e5e5e5', fontSize: 13, padding: '9px 14px', outline: 'none',
        }}
      />

      {/* Status filter buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.key;
          return (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', cursor: 'pointer',
              background: active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: 9,
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: f.color, lineHeight: 1 }}>{f.value}</span>
              <span style={{ fontSize: 12, color: active ? '#ccc' : '#666', fontWeight: 600 }}>{f.label}</span>
            </button>
          );
        })}
        {(Object.values(colFilters).some(Boolean) || search) && (
          <button onClick={() => { setColFilters({}); setSearch(''); }} style={{
            marginLeft: 'auto', padding: '6px 12px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: '#666', cursor: 'pointer', fontSize: 11,
          }}>
            Limpiar filtros
          </button>
        )}
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
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
