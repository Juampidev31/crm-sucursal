'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { CheckCircle2, AlertCircle, XCircle, RotateCcw, Trash2, FileSearch } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { supabase } from '@/lib/supabase';
import {
  parsePastedText, verificarFilas, formatDateAR, ParsedRow, ColumnMapping, ColumnRole, MatchStatus, VerificadorResult,
} from '@/lib/verificador-utils';
import styles from './VerificadorTab.module.css';

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
  found:     { label: 'Encontrado',        color: '#00ff88', Icon: CheckCircle2 },
  mismatch:  { label: 'Importe diferente', color: '#fbbf24', Icon: AlertCircle  },
  not_found: { label: 'No encontrado',     color: '#ff3366', Icon: XCircle      },
};

const STATUS_OPTS = (Object.keys(STATUS_CONFIG) as MatchStatus[])
  .map(key => ({ key, label: STATUS_CONFIG[key].label }));

const parseMontoExcel = (raw: string): number => {
  if (!raw) return 0;
  const isArgentine = raw.indexOf(',') > raw.indexOf('.');
  const normalized = isArgentine
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,/g, '');
  return parseFloat(normalized.replace(/[$\s]/g, '')) || 0;
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
    <div className={styles.root}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon}><FileSearch size={20} /></div>
          <div>
            <h3 className={styles.title}>Verificador de Excel</h3>
            <p className={styles.subtitle}>
              Pegá celdas copiadas de Excel y cruzalas contra los registros cargados.
            </p>
          </div>
        </div>
        {(rows.length > 0 || results) && (
          <button onClick={handleReset} className={styles.resetButton}>
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
            rows={rows.length === 0 ? 18 : 8}
            className={styles.pasteArea}
          />
          <p className={styles.helperText}>
            Copiá desde Excel incluyendo la columna de CUIL — es el campo requerido para cruzar contra la base.
            Podés incluir también Nombre, Mes e Importe en columnas separadas.
          </p>
          {rows.length > 0 && (
            <p className={styles.detectedCount}>
              {rows.length} fila{rows.length !== 1 ? 's' : ''} · {colCount} columna{colCount !== 1 ? 's' : ''} detectadas
            </p>
          )}
        </div>
      )}

      {/* Column mapping */}
      {rows.length > 0 && !results && (
        <div>
          <p className={styles.mappingLabel}>
            Asignar columnas
          </p>
          <div className={styles.tableViewport}>
            <table className={styles.mappingTable}>
              <thead>
                <tr className={styles.mappingHeadRow}>
                  {Array.from({ length: colCount }, (_, i) => (
                    <th key={i} className={styles.mappingHeadCell}>
                      <select
                        value={mapping[i] ?? 'ignore'}
                        onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value as ColumnRole }))}
                        className={styles.mappingSelect}
                      >
                        {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, ri) => (
                  <tr key={ri} className={styles.mappingBodyRow}>
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

          <div className={styles.verifyActions}>
            <button
              onClick={() => setVerified(true)}
              disabled={!hasCuil}
              className={styles.verifyButton}
            >
              Verificar {rows.length} fila{rows.length !== 1 ? 's' : ''}
            </button>
            {!hasCuil && (
              <span className={styles.verifyHint}>
                Asigná al menos la columna CUIL para continuar
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && <ResultsTable results={results} mapping={mapping} onDeleted={() => refresh(true)} />}
    </div>
  );
}


function ResultsTable({ results, mapping, onDeleted }: {
  results: VerificadorResult[];
  mapping: ColumnMapping;
  onDeleted: () => void;
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<MatchStatus>>(new Set());
  const [colFilters, setColFilters]             = useState<Record<string, string>>({});
  const [search, setSearch]                     = useState('');
  const [deleting, setDeleting]                 = useState(false);
  const [deleteResult, setDeleteResult]         = useState<{ deleted: number } | null>(null);
  const [deleteError, setDeleteError]           = useState<string | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());

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
    .filter((_, i) => !hiddenIndices.has(i))
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
  }, [results, cuilColIndex]);

  const duplicateCount = duplicateCuils.size;

  // extraIndices: índices de filas que son extras (no la primera ocurrencia de cada CUIL duplicado)
  const extraIndices = useMemo(() => {
    if (cuilColIndex === undefined) return new Set<number>();
    const firstSeen = new Map<string, boolean>();
    const extras = new Set<number>();
    results.forEach((r, idx) => {
      if (r.status !== 'found' || !r.dbId) return;
      const cuil = (r.row.cells[Number(cuilColIndex)] ?? '').trim();
      if (!duplicateCuils.has(cuil)) return;
      if (!firstSeen.has(cuil)) {
        firstSeen.set(cuil, true);
      } else {
        extras.add(idx);
      }
    });
    return extras;
  }, [results, duplicateCuils, cuilColIndex]);

  useEffect(() => {
    setSelectedForDeletion(new Set(extraIndices));
    setConfirming(false);
    setDeleteResult(null);
    setDeleteError(null);
  }, [Array.from(extraIndices).join(',')]);

  const toggleSelected = (idx: number) =>
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const handleDeleteDuplicates = async () => {
    const ids = Array.from(selectedForDeletion)
      .map(idx => results[idx]?.dbId)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from('registros')
      .delete()
      .in('id', ids);
    setDeleting(false);
    setConfirming(false);
    if (!error) {
      setHiddenIndices(prev => new Set([...prev, ...selectedForDeletion]));
      setDeleteResult({ deleted: ids.length });
      onDeleted();
    } else {
      setDeleteError(error.message);
    }
  };

  const totalMonto = visible.reduce((sum, r) => {
    if (montoColIndex !== undefined) return sum + parseMontoExcel(r.row.cells[Number(montoColIndex)] ?? '');
    if (r.dbImporte != null) return sum + r.dbImporte;
    return sum;
  }, 0);

  // Columnas activas en orden fijo
  const orderedCols: { role: ColumnRole; colIndex: number }[] = ROLE_ORDER
    .map(role => {
      const entry = Object.entries(mapping).find(([, r]) => r === role);
      return entry ? { role, colIndex: Number(entry[0]) } : null;
    })
    .filter((x): x is { role: ColumnRole; colIndex: number } => x !== null);

  return (
    <div className={styles.results}>

      {(selectedForDeletion.size > 0 || duplicateCount > 0) && !deleteResult && (
        <div className={`${styles.duplicateBanner} ${confirming ? styles.isConfirming : ''}`}>
          <span className={styles.duplicateSummary}>
            {duplicateCount} CUIL{duplicateCount > 1 ? 's' : ''} duplicado{duplicateCount > 1 ? 's' : ''} —{' '}
            {selectedForDeletion.size} seleccionado{selectedForDeletion.size !== 1 ? 's' : ''} para eliminar
          </span>

          {!confirming ? (
            <button
              onClick={() => { if (selectedForDeletion.size > 0) setConfirming(true); }}
              disabled={selectedForDeletion.size === 0}
              className={styles.deleteSelectionButton}
            >
              <Trash2 size={12} />
              Eliminar {selectedForDeletion.size} seleccionado{selectedForDeletion.size !== 1 ? 's' : ''}
            </button>
          ) : (
            <>
              <button
                onClick={handleDeleteDuplicates}
                disabled={deleting}
                className={styles.confirmDeleteButton}
              >
                <Trash2 size={12} />
                {deleting ? 'Eliminando...' : '⚠ Confirmar eliminación'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className={styles.cancelButton}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      {deleteResult && (
        <div className={styles.successBanner}>
          ✓ {deleteResult.deleted} registro{deleteResult.deleted > 1 ? 's' : ''} eliminado{deleteResult.deleted > 1 ? 's' : ''} correctamente.
        </div>
      )}

      {deleteError && (
        <div className={styles.errorBanner}>
          Error al eliminar: {deleteError}
        </div>
      )}

      {/* Active filters bar */}
      {hasFilters && (
        <div className={styles.activeFilters}>
          <span className={styles.activeFiltersLabel}>Filtros activos:</span>
          {Array.from(selectedStatuses).map(s => (
            <span
              key={s}
              onClick={() => toggleStatus(s)}
              className={styles.statusFilterChip}
              style={{ '--status-color': STATUS_CONFIG[s].color } as React.CSSProperties}
            >
              {STATUS_CONFIG[s].label} ×
            </span>
          ))}
          {Object.entries(colFilters).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} onClick={() => setCol(k, '')} className={styles.filterChip}>
              {v} ×
            </span>
          ))}
          {search && (
            <span onClick={() => setSearch('')} className={styles.filterChip}>
              "{search}" ×
            </span>
          )}
          <button onClick={clearAll} className={styles.clearFilters}>Limpiar todo</button>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar en todos los campos..."
        className={styles.searchInput}
      />

      {/* Estado toggle pills */}
      <div>
        <div className={styles.statusHeading}>
          Estado (seleccioná los que querés filtrar)
          {selectedStatuses.size > 0 && <span className={styles.selectedCount}>· {selectedStatuses.size} seleccionado{selectedStatuses.size > 1 ? 's' : ''}</span>}
        </div>
        <div className={styles.statusOptions}>
          {STATUS_OPTS.map(({ key, label }) => {
            const active = selectedStatuses.has(key);
            const count = results.filter((r, i) => r.status === key && !hiddenIndices.has(i)).length;
            return (
              <button key={key} onClick={() => toggleStatus(key)} className={`${styles.statusButton} ${active ? styles.isActive : ''}`}>
                {label} <span className={styles.statusTotal}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div className={styles.summary}>
        <span className={styles.summaryText}>
          Mostrando <span className={styles.summaryValue}>{visible.length}</span> de {results.length - hiddenIndices.size} filas
        </span>
        <span className={styles.summaryText}>
          Total monto: <span className={styles.summaryValue}>${totalMonto.toLocaleString('es-AR')}</span>
        </span>
      </div>

      {/* Table */}
      <div className={styles.tableViewport}>
        <table className={styles.resultsTable}>
          <thead className={styles.resultsHead}>
            <tr>
              <th className={`${styles.resultsHeadCell} ${styles.selectionHead}`} />
              {orderedCols.map(({ role, colIndex }) => (
                <th key={role} className={styles.resultsHeadCell}>
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
              <th className={styles.resultsHeadCell}>ESTADO</th>
              <th className={styles.resultsHeadCell}>
                MONTO DB
                <FilterSelect filterKey="dbImporte" value={colFilters['dbImporte'] ?? ''} options={uniqueVals['dbImporte'] ?? []} onChange={setCol} />
              </th>
              <th className={styles.resultsHeadCell}>
                FECHA DB
                <FilterSelect filterKey="dbFecha" value={colFilters['dbFecha'] ?? ''} options={uniqueVals['dbFecha'] ?? []} onChange={setCol} formatOption={formatDateAR} />
              </th>
              <th className={styles.resultsHeadCell}>
                ESTADO DB
                <FilterSelect filterKey="dbEstado" value={colFilters['dbEstado'] ?? ''} options={uniqueVals['dbEstado'] ?? []} onChange={setCol} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((res, idx) => {
              const resultIdx = results.indexOf(res);
              const { color, Icon } = STATUS_CONFIG[res.status];
              const isDuplicate = (() => {
                if (res.status !== 'found' || cuilColIndex === undefined) return undefined;
                const cuil = (res.row.cells[Number(cuilColIndex)] ?? '').trim();
                return duplicateCuils.has(cuil);
              })();
              return (
                <tr
                  key={idx}
                  className={`${styles.resultRow} ${isDuplicate ? styles.isDuplicate : ''}`}
                >
                  <td className={styles.selectionCell}>
                    {res.dbId && (
                      <input
                        type="checkbox"
                        checked={selectedForDeletion.has(resultIdx)}
                        onChange={() => toggleSelected(resultIdx)}
                        className={styles.selectionCheckbox}
                      />
                    )}
                  </td>
                  {orderedCols.map(({ role, colIndex }) => {
                    const raw = res.row.cells[colIndex] ?? '';
                    const display = role === 'fecha' ? formatDateAR(raw) : raw;
                    return (
                      <td key={role} className={styles.dataCell}>
                        {display}
                      </td>
                    );
                  })}
                  <td className={styles.statusCell}>
                    <span className={styles.statusLabel} style={{ '--status-color': color } as React.CSSProperties}>
                      <Icon size={12} />
                      {STATUS_CONFIG[res.status].label}
                    </span>
                    {res.diffDetail && <span className={styles.diffDetail}>{res.diffDetail}</span>}
                  </td>
                  <td className={styles.databaseCell}>
                    {res.dbImporte != null ? `$${res.dbImporte.toLocaleString('es-AR')}` : <span className={styles.emptyValue}>—</span>}
                  </td>
                  <td className={styles.databaseCell}>
                    {res.dbFecha ? formatDateAR(res.dbFecha) : <span className={styles.emptyValue}>—</span>}
                  </td>
                  <td className={styles.databaseCell}>
                    {res.dbEstado ?? <span className={styles.emptyValue}>—</span>}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={orderedCols.length + 4} className={styles.emptyResults}>
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
    <CustomSelect
      value={value}
      onChange={val => onChange(filterKey, String(val))}
      options={[{ label: 'Todos', value: '' }, ...[...options].sort().map(o => ({ label: formatOption ? formatOption(o) : o, value: o }))]}
      width="150px"
    />
  );
}
