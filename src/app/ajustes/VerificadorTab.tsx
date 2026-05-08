'use client';

import React, { useState, useMemo } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { CheckCircle2, AlertCircle, XCircle, RotateCcw } from 'lucide-react';
import {
  parsePastedText, verificarFilas, ParsedRow, ColumnMapping, ColumnRole, VerificadorResult,
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

const FILTER_INPUT_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', marginTop: 5,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4, color: '#ccc', fontSize: 10, padding: '3px 6px', outline: 'none',
};

function ResultsTable({ results, mapping, colCount }: {
  results: VerificadorResult[];
  mapping: ColumnMapping;
  colCount: number;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'found' | 'mismatch' | 'not_found'>('all');
  const [colFilters, setColFilters]     = useState<Record<string, string>>({});

  const found    = results.filter(r => r.status === 'found').length;
  const mismatch = results.filter(r => r.status === 'mismatch').length;
  const notFound = results.filter(r => r.status === 'not_found').length;

  const setCol = (key: string, val: string) =>
    setColFilters(prev => ({ ...prev, [key]: val }));

  const visible = results
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      for (const [key, val] of Object.entries(colFilters)) {
        if (!val) continue;
        const q = val.toLowerCase();
        if (key === 'dbImporte') {
          if (r.dbImporte == null || !`${r.dbImporte}`.includes(q)) return false;
        } else if (key === 'dbFecha') {
          if (!r.dbFecha?.toLowerCase().includes(q)) return false;
        } else if (key === 'dbEstado') {
          if (!r.dbEstado?.toLowerCase().includes(q)) return false;
        } else {
          const ci = Number(key);
          if (!(r.row.cells[ci] ?? '').toLowerCase().includes(q)) return false;
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

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', color: '#555',
    fontWeight: 700, fontSize: 11, letterSpacing: '0.05em',
    whiteSpace: 'nowrap', verticalAlign: 'top',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
        {Object.values(colFilters).some(Boolean) && (
          <button onClick={() => setColFilters({})} style={{
            marginLeft: 'auto', alignSelf: 'center', padding: '6px 12px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: '#666', cursor: 'pointer', fontSize: 11,
          }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <tr>
              {Array.from({ length: colCount }, (_, i) => {
                const role = mapping[i] as ColumnRole | undefined;
                const label = role && role !== 'ignore' ? ROLE_LABEL[role] : `Col ${i + 1}`;
                return (
                  <th key={i} style={thStyle}>
                    {label.toUpperCase()}
                    <input
                      value={colFilters[i] ?? ''}
                      onChange={e => setCol(String(i), e.target.value)}
                      placeholder="Filtrar..."
                      style={FILTER_INPUT_STYLE}
                    />
                  </th>
                );
              })}
              <th style={thStyle}>ESTADO</th>
              <th style={thStyle}>
                MONTO DB
                <input value={colFilters['dbImporte'] ?? ''} onChange={e => setCol('dbImporte', e.target.value)} placeholder="Filtrar..." style={FILTER_INPUT_STYLE} />
              </th>
              <th style={thStyle}>
                FECHA DB
                <input value={colFilters['dbFecha'] ?? ''} onChange={e => setCol('dbFecha', e.target.value)} placeholder="Filtrar..." style={FILTER_INPUT_STYLE} />
              </th>
              <th style={thStyle}>
                ESTADO DB
                <input value={colFilters['dbEstado'] ?? ''} onChange={e => setCol('dbEstado', e.target.value)} placeholder="Filtrar..." style={FILTER_INPUT_STYLE} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((res, idx) => {
              const { color, Icon } = STATUS_CONFIG[res.status];
              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {Array.from({ length: colCount }, (_, ci) => (
                    <td key={ci} style={{ padding: '9px 14px', color: '#aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {res.row.cells[ci] ?? ''}
                    </td>
                  ))}
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
                    {res.dbFecha ?? <span style={{ color: '#444' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#aaa', whiteSpace: 'nowrap' }}>
                    {res.dbEstado ?? <span style={{ color: '#444' }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={colCount + 4} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>
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
