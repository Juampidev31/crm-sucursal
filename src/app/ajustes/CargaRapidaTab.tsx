'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, Minus, RotateCcw, Upload, Loader2 } from 'lucide-react';
import { parsePastedText, ParsedRow } from '@/lib/verificador-utils';
import {
  CargaColumnMapping, CargaRole, CargaRapidaResult,
  CARGA_ROLE_OPTIONS, procesarFilas,
} from '@/lib/carga-rapida-utils';

const STATUS_CONFIG = {
  new:    { label: 'Nuevo',       color: '#4ade80', Icon: CheckCircle2 },
  update: { label: 'Actualizar',  color: '#fbbf24', Icon: AlertCircle  },
  skip:   { label: 'Sin cambios', color: '#555',    Icon: Minus        },
};

export default function CargaRapidaTab() {
  const { registros, refresh, pushBulkRefresh } = useRegistros();
  const [rows, setRows]       = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<CargaColumnMapping>({});
  const [processed, setProcessed] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const colCount = useMemo(() => rows.reduce((max, r) => Math.max(max, r.cells.length), 0), [rows]);

  const hasCuil   = Object.values(mapping).includes('cuil');
  const hasNombre = Object.values(mapping).includes('apellido_nombre');
  const canProcess = rows.length > 0 && (hasCuil || hasNombre);

  const results = useMemo<CargaRapidaResult[] | null>(
    () => processed ? procesarFilas(rows, mapping, registros) : null,
    [processed, rows, mapping, registros],
  );

  const summary = useMemo(() => {
    if (!results) return null;
    return {
      new: results.filter(r => r.status === 'new').length,
      update: results.filter(r => r.status === 'update').length,
      skip: results.filter(r => r.status === 'skip').length,
    };
  }, [results]);

  const handlePaste = (text: string) => {
    setRows(parsePastedText(text));
    setMapping({});
    setProcessed(false);
    setSaved(false);
    setError(null);
  };

  const handleReset = () => {
    setRows([]);
    setMapping({});
    setProcessed(false);
    setSaved(false);
    setError(null);
  };

  const handleConfirm = useCallback(async () => {
    if (!results) return;
    setSaving(true);
    setError(null);

    const toInsert = results.filter(r => r.status === 'new').map(r => r.parsedData);
    const toUpdate = results.filter(r => r.status === 'update');

    try {
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('registros').insert(toInsert);
        if (insErr) throw new Error(insErr.message);
      }

      for (const item of toUpdate) {
        if (!item.existingRecord) continue;
        const { error: updErr } = await supabase
          .from('registros')
          .update(item.parsedData)
          .eq('id', item.existingRecord.id);
        if (updErr) throw new Error(updErr.message);
      }

      await refresh(true);
      pushBulkRefresh();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [results, refresh, pushBulkRefresh]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Carga Rápida</h3>
          <p style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
            Pegá datos tabulados, mapeá las columnas y cargá o actualizá registros masivamente.
          </p>
        </div>
        {rows.length > 0 && (
          <button onClick={handleReset} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: '#666', fontSize: 12, cursor: 'pointer',
          }}>
            <RotateCcw size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* Paste area */}
      {rows.length === 0 && (
        <textarea
          placeholder="Pegá aquí los datos copiados de Excel o cualquier tabla (Ctrl+V)..."
          onPaste={e => { e.preventDefault(); handlePaste(e.clipboardData.getData('text')); }}
          onChange={e => { if (e.target.value) handlePaste(e.target.value); }}
          style={{
            width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8,
            color: '#666', fontSize: 13, padding: 16, resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      )}

      {/* Column mapping */}
      {rows.length > 0 && !processed && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
            {rows.length} filas detectadas. Asigná el rol de cada columna:
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {Array.from({ length: colCount }, (_, i) => (
                    <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <select
                        value={mapping[i] ?? 'ignore'}
                        onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as CargaRole }))}
                        style={{
                          background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 4, padding: '4px 6px', fontSize: 11, width: '100%',
                        }}
                      >
                        {CARGA_ROLE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri}>
                    {Array.from({ length: colCount }, (_, ci) => (
                      <td key={ci} style={{ padding: '5px 8px', color: '#555', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.cells[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setProcessed(true)}
              disabled={!canProcess}
              style={{
                padding: '8px 20px', background: canProcess ? 'var(--azul)' : 'rgba(255,255,255,0.05)',
                color: canProcess ? '#fff' : '#444', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 700, cursor: canProcess ? 'pointer' : 'not-allowed',
              }}
            >
              Procesar
            </button>
            {!canProcess && (
              <span style={{ fontSize: 12, color: '#555' }}>Asigná al menos CUIL o Apellido y Nombre</span>
            )}
          </div>
        </div>
      )}

      {/* Preview results */}
      {results && summary && !saved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'new',    label: `${summary.new} nuevos`,          color: '#4ade80' },
              { key: 'update', label: `${summary.update} a actualizar`, color: '#fbbf24' },
              { key: 'skip',   label: `${summary.skip} sin cambios`,    color: '#555'    },
            ].map(s => (
              <div key={s.key} style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`, fontSize: 12, fontWeight: 700, color: s.color }}>
                {s.label}
              </div>
            ))}
          </div>

          {/* Results table */}
          <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 700 }}>Estado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 700 }}>Cliente</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 700 }}>CUIL</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 700 }}>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, i) => {
                  const cfg = STATUS_CONFIG[res.status];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: cfg.color }}>
                          <cfg.Icon size={12} /> {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#ccc' }}>
                        {res.parsedData.nombre ?? res.existingRecord?.nombre ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#555', fontFamily: 'monospace', fontSize: 11 }}>
                        {res.parsedData.cuil ?? res.existingRecord?.cuil ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {res.diffs && res.diffs.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {res.diffs.map((d, j) => (
                              <div key={j} style={{ fontSize: 11, color: '#888' }}>
                                <span style={{ color: '#fbbf24', fontWeight: 700 }}>{d.label}:</span>{' '}
                                <span style={{ color: '#f87171', textDecoration: 'line-through' }}>{d.oldValue || '—'}</span>
                                {' → '}
                                <span style={{ color: '#4ade80' }}>{d.newValue || '—'}</span>
                              </div>
                            ))}
                          </div>
                        ) : res.status === 'new' ? (
                          <span style={{ color: '#555', fontSize: 11 }}>Registro nuevo</span>
                        ) : (
                          <span style={{ color: '#444', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleConfirm}
              disabled={saving || (summary.new === 0 && summary.update === 0)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 20px',
                background: (summary.new > 0 || summary.update > 0) && !saving ? 'var(--azul)' : 'rgba(255,255,255,0.05)',
                color: (summary.new > 0 || summary.update > 0) && !saving ? '#fff' : '#444',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
                cursor: (summary.new > 0 || summary.update > 0) && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Upload size={14} /> Confirmar carga</>}
            </button>
            <button
              onClick={() => setProcessed(false)}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#666', fontSize: 12, cursor: 'pointer' }}
            >
              Volver a mapear
            </button>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
              Error: {error}
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {saved && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
          <CheckCircle2 size={40} color="#4ade80" />
          <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 16 }}>¡Carga completada!</p>
          <button onClick={handleReset} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#ccc', fontSize: 13, cursor: 'pointer' }}>
            Nueva carga
          </button>
        </div>
      )}

    </div>
  );
}
