'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, RotateCcw, Upload, Loader2 } from 'lucide-react';
import { parsePastedText, ParsedRow } from '@/lib/verificador-utils';
import {
  CargaColumnMapping, CargaRole, CargaRapidaResult,
  CARGA_ROLE_OPTIONS, procesarFilas,
} from '@/lib/carga-rapida-utils';
import styles from './CargaRapidaTab.module.css';

const STATUS_CONFIG = {
  new:  { label: 'Nuevo',     color: '#00ff88', Icon: CheckCircle2 },
  skip: { label: 'Ya existe', color: '#fbbf24', Icon: AlertCircle  },
};

export default function CargaRapidaTab() {
  const { registros, refresh, pushBulkRefresh } = useRegistros();
  const [rawText, setRawText] = useState('');
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
      skip: results.filter(r => r.status === 'skip').length,
    };
  }, [results]);

  const handlePaste = (text: string) => {
    setRawText(text);
    setRows(parsePastedText(text));
    setMapping({});
    setProcessed(false);
    setSaved(false);
    setError(null);
  };

  const handleReset = () => {
    setRawText('');
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

    const mappedRoles = new Set(Object.values(mapping));
    const toInsert = results.filter(r => r.status === 'new').map(r => {
      const row: any = { ...r.parsedData };
      if (!mappedRoles.has('estado')) row.estado = null;
      if (!mappedRoles.has('monto')) row.monto = null;
      if (!mappedRoles.has('puntaje')) row.puntaje = null;
      if (!mappedRoles.has('es_re')) row.es_re = null;
      return row;
    });

    try {
      const BATCH = 500;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const chunk = toInsert.slice(i, i + BATCH);
        const { error: insErr } = await supabase.from('registros').insert(chunk);
        if (insErr) throw new Error(`Insert falló en filas ${i + 1}-${i + chunk.length}: ${insErr.message}`);
      }

      await refresh(true);
      pushBulkRefresh();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [results, mapping, refresh, pushBulkRefresh]);

  return (
    <div className={styles.root}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon}><Upload size={20} /></div>
          <div>
            <h3 className={styles.title}>Carga Rápida</h3>
            <p className={styles.subtitle}>
              Pegá datos tabulados, mapeá las columnas y cargá o actualizá registros masivamente.
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <button onClick={handleReset} className={styles.clearButton}>
            <RotateCcw size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* Paste area */}
      {!processed && (
        <textarea
          value={rawText}
          placeholder="Pegá aquí los datos copiados de Excel o cualquier tabla (Ctrl+V)..."
          onPaste={e => { e.preventDefault(); handlePaste(e.clipboardData.getData('text')); }}
          onChange={e => handlePaste(e.target.value)}
          rows={rows.length === 0 ? 18 : 8}
          className={`${styles.pasteArea} ${rawText ? styles.hasContent : ''}`}
        />
      )}

      {/* Column mapping */}
      {rows.length > 0 && !processed && (
        <div className={styles.mappingPanel}>
          <p className={styles.mappingDescription}>
            {rows.length} filas detectadas. Asigná el rol de cada columna:
          </p>
          <div className={styles.tableViewport}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {Array.from({ length: colCount }, (_, i) => (
                    <th key={i} className={styles.mappingHeadCell}>
                      <select
                        value={mapping[i] ?? 'ignore'}
                        onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as CargaRole }))}
                        className={styles.mappingSelect}
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
                {rows.slice(0, 8).map((row, ri) => (
                  <tr key={ri}>
                    {Array.from({ length: colCount }, (_, ci) => (
                      <td key={ci} className={styles.mappingCell}>
                        {row.cells[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && (
            <p className={styles.moreRows}>... y {rows.length - 8} filas más</p>
          )}
          <div className={styles.processActions}>
            <button
              onClick={() => setProcessed(true)}
              disabled={!canProcess}
              className={styles.processButton}
            >
              Procesar
            </button>
            {!canProcess && (
              <span className={styles.processHint}>Asigná al menos CUIL o Apellido y Nombre</span>
            )}
          </div>
        </div>
      )}

      {/* Preview results */}
      {results && summary && !saved && (
        <div className={styles.results}>

          {/* Summary bar */}
          <div className={styles.summary}>
            {[
              { key: 'new',  label: `${summary.new} nuevos`,            color: '#00ff88' },
              { key: 'skip', label: `${summary.skip} ya existen (se omiten)`, color: '#fbbf24' },
            ].map(s => (
              <div key={s.key} className={styles.summaryBadge} style={{ '--status-color': s.color } as React.CSSProperties}>
                {s.label}
              </div>
            ))}
          </div>

          {/* Results table */}
          <div className={`${styles.tableViewport} ${styles.resultsViewport}`}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.resultsHeadRow}>
                  <th className={styles.resultsHeadCell}>Estado</th>
                  <th className={styles.resultsHeadCell}>Cliente</th>
                  <th className={styles.resultsHeadCell}>CUIL</th>
                  <th className={styles.resultsHeadCell}>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, i) => {
                  const cfg = STATUS_CONFIG[res.status];
                  return (
                    <tr key={i} className={styles.resultRow}>
                      <td className={styles.resultCell}>
                        <span className={styles.statusLabel} style={{ '--status-color': cfg.color } as React.CSSProperties}>
                          <cfg.Icon size={12} /> {cfg.label}
                        </span>
                      </td>
                      <td className={`${styles.resultCell} ${styles.clientCell}`}>
                        {res.parsedData.nombre ?? res.existingRecord?.nombre ?? '—'}
                      </td>
                      <td className={`${styles.resultCell} ${styles.cuilCell}`}>
                        {res.parsedData.cuil ?? res.existingRecord?.cuil ?? '—'}
                      </td>
                      <td className={styles.resultCell}>
                        {res.status === 'new' ? (
                          <span className={styles.newLabel}>Registro nuevo</span>
                        ) : (
                          <span className={styles.emptyValue}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className={styles.resultActions}>
            <button
              onClick={handleConfirm}
              disabled={saving || summary.new === 0}
              className={styles.confirmButton}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Upload size={14} /> Confirmar carga</>}
            </button>
            <button
              onClick={() => setProcessed(false)}
              className={styles.remapButton}
            >
              Volver a mapear
            </button>
          </div>

          {error && (
            <div className={styles.error}>
              Error: {error}
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {saved && (
        <div className={styles.success}>
          <CheckCircle2 size={40} color="#00ff88" />
          <p className={styles.successText}>¡Carga completada!</p>
          <button onClick={handleReset} className={styles.newLoadButton}>
            Nueva carga
          </button>
        </div>
      )}

    </div>
  );
}
