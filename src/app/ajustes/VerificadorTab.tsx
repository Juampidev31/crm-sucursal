'use client';

import React, { useState, useMemo } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { Search, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
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
}

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
