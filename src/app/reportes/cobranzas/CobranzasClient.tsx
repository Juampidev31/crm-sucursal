'use client';

import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useDeferredMount, ChartShimmer } from '@/components/ChartShimmer';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend,
  BarController, LineController, Filler,
} from 'chart.js';
import type { ChartOptions, ScriptableContext } from 'chart.js';
import { Line, Chart } from 'react-chartjs-2';
import SelectReporte from '@/components/SelectReporte';
import type { CobranzasData, TramoRow, MorosidadRow } from './data';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { parseNumberRobust, parsePct } from '@/lib/csv-utils';
import styles from './Cobranzas.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, Filler);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function cumplColor(pct: number | null): string {
  if (pct === null) return '#64748b';
  if (pct >= 100) return '#34d399';
  return '#f87171';
}

// ── Editable Cell ────────────────────────────────────────────────────────────

function EditCell({
  value, onChange, onBlur, align = 'right', placeholder = '', width = '80px'
}: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; align?: 'left' | 'right' | 'center'; placeholder?: string; width?: string;
}) {
  return (
    <input
      className={styles.editInput}
      value={value === '-' ? '' : value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ '--edit-width': width } as CSSProperties}
      data-align={align}
      onBlur={onBlur}
    />
  );
}

// ── Tramo Table (read/edit) ──────────────────────────────────────────────────

function TramoTable({
  titulo, rows, color, editing, onRowChange
}: {
  titulo: string; rows: TramoRow[]; color: string; editing: boolean;
  onRowChange: (idx: number, field: keyof TramoRow, value: string) => void;
}) {
  return (
    <div className={`${styles.panel} ${styles.tramoPanel}`}>
      <div className={`${styles.panelHeader} ${styles.tramoHeader}`}>
        <div className={styles.tramoAccent} style={{ '--status-color': color } as CSSProperties} />
        <span className={styles.panelTitle}>{titulo}</span>
      </div>
      <table className={styles.tramoTable}>
        <thead>
          <tr>
            {['Mes', 'Objetivo', 'Recupero', 'Cumpl.'].map(h => (
              <th key={h} className={h === 'Mes' ? styles.alignLeft : styles.alignRight}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const c = cumplColor(r.pct);
            return (
              <tr
                key={i}
                className={styles.dataRow}
              >
                <td className={styles.monthCell}>
                  {editing ? r.mes || MESES[i] || `Mes ${i + 1}` : r.mes}
                </td>
                <td className={styles.numericCell}>
                  {editing ? (
                    <EditCell value={r.objetivo} onChange={v => onRowChange(i, 'objetivo', v)} placeholder="0" />
                  ) : (
                    <span className={styles.secondaryValue}>{r.objetivo}</span>
                  )}
                </td>
                <td className={styles.numericCell}>
                  {editing ? (
                    <EditCell value={r.recupero} onChange={v => onRowChange(i, 'recupero', v)} placeholder="0" />
                  ) : (
                    <span className={styles.primaryValue}>{r.recupero}</span>
                  )}
                </td>
                <td className={styles.numericCell}>
                  {editing ? (
                    <span className={styles.statusBadge}>
                      <span className={styles.statusDot} style={{ '--status-color': c } as CSSProperties}>●</span>
                      {r.cumplimiento !== '-' ? r.cumplimiento : '0%'}
                    </span>
                  ) : (
                    r.pct !== null ? (
                      <span className={styles.statusBadge}>
                        <span className={styles.statusDot} style={{ '--status-color': c } as CSSProperties}>●</span>
                        {r.cumplimiento}
                      </span>
                    ) : <span className={styles.secondaryValue}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Chart Options ────────────────────────────────────────────────────────────

const chartOpts = (yLabel: string) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#667085', font: { size: 10, weight: 600 }, usePointStyle: true, padding: 16 } },
    tooltip: { backgroundColor: '#172033', titleColor: '#fff', bodyColor: '#d0d5dd', borderColor: '#344054', borderWidth: 1 },
  },
  scales: {
    x: { ticks: { color: '#667085', font: { size: 10, weight: 600 } }, grid: { color: '#edf1f5' }, border: { display: false } },
    y: { ticks: { color: '#667085', font: { size: 10, weight: 600 }, callback: (v: number | string) => `${v}${yLabel}` }, grid: { color: '#edf1f5' }, border: { display: false } },
  },
});

// ── Main Component ───────────────────────────────────────────────────────────

interface Props { data: CobranzasData; year: string; years: string[]; }

export default function CobranzasClient({ data: initialData, year, years }: Props) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const onYearChange = (y: string) => router.push(`/reportes/cobranzas?year=${y}`);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Deep-clone data for editing
  const [data, setData] = useState<CobranzasData>(initialData);
  const chartsLoaded = useDeferredMount();

  // Ensure 12 rows always exist for editing
  const ensureRows = useCallback((rows: TramoRow[]): TramoRow[] => {
    const result = [...rows];
    while (result.length < 12) {
      result.push({ mes: MESES[result.length] || '', objetivo: '-', recupero: '-', cumplimiento: '-', pct: null });
    }
    return result;
  }, []);

  const ensureMorosidadRows = useCallback((rows: MorosidadRow[]): MorosidadRow[] => {
    const result = [...rows];
    while (result.length < 12) {
      result.push({ mes: MESES[result.length] || '', current: '-', currentPct: null, anterior: '-', anteriorPct: null, mediaEmp: '-', mediaPct: null });
    }
    return result;
  }, []);

  const startEditing = () => {
    setData(prev => ({
      ...prev,
      tramo90: ensureRows(prev.tramo90),
      tramo120: ensureRows(prev.tramo120),
      refin: ensureRows(prev.refin),
      morosidad: ensureMorosidadRows(prev.morosidad),
    }));
    setEditing(true);
  };

  const cancelEditing = () => {
    setData(initialData);
    setEditing(false);
  };

  const updateTramo = useCallback((
    tramo: 'tramo90' | 'tramo120' | 'refin',
    idx: number,
    field: keyof TramoRow,
    value: string
  ) => {
    setData(prev => {
      const rows = [...prev[tramo]];
      rows[idx] = { ...rows[idx], [field]: value };
      
      if (field === 'objetivo' || field === 'recupero') {
        const objStr = rows[idx].objetivo;
        const recStr = rows[idx].recupero;
        if (objStr && recStr && objStr !== '-' && recStr !== '-') {
          const obj = parseNumberRobust(objStr);
          const rec = parseNumberRobust(recStr);
          if (!isNaN(obj) && !isNaN(rec) && obj !== 0) {
            const pct = (rec / obj) * 100;
            rows[idx].cumplimiento = pct.toFixed(1).replace('.', ',') + '%';
            rows[idx].pct = pct;
          } else {
            rows[idx].cumplimiento = '-';
            rows[idx].pct = null;
          }
        }
      }

      if (field === 'cumplimiento') {
        rows[idx].pct = parsePct(value);
      }
      return { ...prev, [tramo]: rows };
    });
  }, []);

  const updateMorosidad = useCallback((idx: number, field: string, value: string) => {
    setData(prev => {
      const rows = [...prev.morosidad];
      const row = { ...rows[idx] };
      if (field === 'current') { row.current = value; row.currentPct = parsePct(value); }
      else if (field === 'anterior') { row.anterior = value; row.anteriorPct = parsePct(value); }
      else if (field === 'mediaEmp') { row.mediaEmp = value; row.mediaPct = parsePct(value); }
      rows[idx] = row;
      return { ...prev, morosidad: rows };
    });
  }, []);

  const formatMorosidadPct = useCallback((idx: number, field: 'current' | 'anterior' | 'mediaEmp') => {
    setData(prev => {
      const rows = [...prev.morosidad];
      const row = { ...rows[idx] };
      const val = row[field];
      if (val && val !== '-' && !val.includes('%')) {
        const num = parseNumberRobust(val);
        if (!isNaN(num)) {
          const formatted = num.toFixed(2).replace('.', ',') + '%';
          row[field] = formatted;
          if (field === 'current') row.currentPct = num;
          if (field === 'anterior') row.anteriorPct = num;
          if (field === 'mediaEmp') row.mediaPct = num;
        }
      }
      rows[idx] = row;
      return { ...prev, morosidad: rows };
    });
  }, []);

  const updateMorosidadMeta = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveData = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cobranzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, data }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setToast({ msg: 'Datos guardados correctamente', type: 'success' });
      setEditing(false);
      // Refresh to get server-rendered data
      router.refresh();
    } catch {
      setToast({ msg: 'Error al guardar los datos', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  // ── Chart Data ─────────────────────────────────────────────────────────────

  const meses = data.tramo90.map(r => r.mes);
  const cumplData = {
    labels: meses,
    datasets: [
      { type: 'bar' as const, label: 'Tramo 90-119', data: data.tramo90.map(r => r.pct), backgroundColor: 'rgba(96,165,250,0.8)', borderRadius: 4 },
      { type: 'bar' as const, label: 'Tramo 120-209', data: data.tramo120.map(r => r.pct), backgroundColor: 'rgba(167,139,250,0.8)', borderRadius: 4 },
      { type: 'bar' as const, label: 'Refinanciaciones', data: data.refin.map(r => r.pct), backgroundColor: 'rgba(251,191,36,0.8)', borderRadius: 4 },
      {
        type: 'line' as const,
        label: 'Meta 100%',
        data: Array(meses.length).fill(100),
        borderColor: '#f87171',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const moresMeses = data.morosidad.map(r => r.mes);
  const moresData = {
    labels: moresMeses,
    datasets: [
      { label: data.anioCurrent || 'Actual', data: data.morosidad.map(r => r.currentPct), borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.05)', tension: 0.3, pointRadius: 3, fill: true },
      { label: data.anioAnterior || 'Anterior', data: data.morosidad.map(r => r.anteriorPct), borderColor: '#9a9aa3', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderDash: [4, 4] },
      { label: 'Media Emp.', data: data.morosidad.map(r => r.mediaPct), borderColor: '#fbbf24', backgroundColor: 'transparent', tension: 0, pointRadius: 0, borderDash: [6, 3] },
    ],
  };

  const variationData = {
    labels: moresMeses,
    datasets: [
      {
        label: `Dif. vs ${data.anioAnterior}`,
        data: data.morosidad.map(r => (r.currentPct !== null && r.anteriorPct !== null) ? Number((r.currentPct - r.anteriorPct).toFixed(2)) : 0),
        backgroundColor: (context: ScriptableContext<'bar'>) => Number(context.raw) > 0 ? 'rgba(248, 113, 113, 0.7)' : 'rgba(52, 211, 153, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Dif. vs Media Emp.',
        data: data.morosidad.map(r => (r.currentPct !== null && r.mediaPct !== null) ? Number((r.currentPct - r.mediaPct).toFixed(2)) : 0),
        backgroundColor: (context: ScriptableContext<'bar'>) => Number(context.raw) > 0 ? 'rgba(248, 113, 113, 0.3)' : 'rgba(52, 211, 153, 0.3)',
        borderColor: (context: ScriptableContext<'bar'>) => Number(context.raw) > 0 ? '#f87171' : '#34d399',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`dashboard-container ${styles.reportPage}`}>
      {/* Toast */}
      {toast && (
        <div className={styles.toastViewport}>
          <div className={`${styles.toast}${toast.type === 'success' ? ` ${styles.isSuccess}` : ` ${styles.isError}`}`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.reportHeader}>
        <div>
          <span className={styles.eyebrow}>Inteligencia de recupero</span>
          <h1 className={styles.title}>Reporte de Cobranzas</h1>
          <p className={styles.subtitle}>Evolución mensual de recupero, cumplimiento por tramo y comportamiento de la morosidad.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.editActions}>
          {editing ? (
            <>
              <button
                onClick={saveData}
                disabled={saving}
                className={styles.saveButton}
              >
                {saving ? <Loader2 size={14} className={styles.spinner} /> : <Save size={14} />}
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className={styles.cancelButton}
              >
                <X size={14} /> CANCELAR
              </button>
            </>
          ) : isAdmin ? (
            <button
              onClick={startEditing}
              className={styles.editButton}
            >
              <Edit2 size={14} /> EDITAR DATOS
            </button>
          ) : null}
          </div>
        <SelectReporte
          icon="calendar"
          value={year}
          onChange={(v) => onYearChange(String(v))}
          options={years.map(y => ({ label: `AÑO ${y}`, value: y }))}
          width="140px"
          variant="light"
        />
        </div>
      </div>

      {/* Editing banner */}
      {editing && (
        <div className={styles.editingBanner}>
          <Edit2 size={14} />
          Modo edición — Modificá los valores directamente en las tablas y hacé clic en GUARDAR.
        </div>
      )}

      {/* Tramo Tables */}
      <div className={styles.sectionLabel}>Cumplimiento por tramo</div>
      <div className={styles.tramoGrid}>
        <TramoTable
          titulo="Tramo 90-119"
          rows={data.tramo90}
          color="#60a5fa"
          editing={editing}
          onRowChange={(idx, field, value) => updateTramo('tramo90', idx, field, value)}
        />
        <TramoTable
          titulo="Tramo 120-209"
          rows={data.tramo120}
          color="#a78bfa"
          editing={editing}
          onRowChange={(idx, field, value) => updateTramo('tramo120', idx, field, value)}
        />
        <TramoTable
          titulo="Refinanciaciones"
          rows={data.refin}
          color="#fbbf24"
          editing={editing}
          onRowChange={(idx, field, value) => updateTramo('refin', idx, field, value)}
        />
      </div>

      {/* Charts */}
      <div className={styles.sectionLabel}>Evolución y comparativas</div>
      <div className={styles.chartGrid}>
        <div className={`data-card ${styles.panel} ${styles.chartPanel}`}>
          <h3 className={styles.chartTitle}>Cumplimiento por Tramo</h3>
          <div className={styles.chartCanvas}>
            {chartsLoaded ? (
              <Chart<'bar' | 'line', (number | null)[], string>
                type="bar"
                data={cumplData}
                options={chartOpts('%') as unknown as ChartOptions<'bar' | 'line'>}
              />
            ) : (
              <ChartShimmer />
            )}
          </div>
        </div>

        <div className={`data-card ${styles.panel} ${styles.chartPanel}`}>
          <h3 className={styles.chartTitle}>Morosidad Anual</h3>
          <div className={styles.chartCanvas}>
            {chartsLoaded ? (
              <Line data={moresData} options={chartOpts('%') as unknown as ChartOptions<'line'>} />
            ) : (
              <ChartShimmer />
            )}
          </div>
        </div>

        <div className={`data-card ${styles.panel} ${styles.chartPanel}`}>
          <h3 className={styles.chartTitle}>Variación Morosidad (+/-)</h3>
          <div className={styles.chartCanvas}>
            {chartsLoaded ? (
              <Chart type="bar" data={variationData} options={{ ...chartOpts(' p.p.'), maintainAspectRatio: false } as unknown as ChartOptions<'bar'>} />
            ) : (
              <ChartShimmer />
            )}
          </div>
        </div>
      </div>

      {/* Morosidad Detail Table */}
      <div className={styles.sectionLabel}>Detalle mensual</div>
      <div className={styles.detailGrid}>
        <div className={`${styles.panel} ${styles.detailPanel}`}>
          <div className={`${styles.panelHeader} ${styles.detailHeader}`}>
            <span className={styles.panelTitle}>Detalle Morosidad</span>
            {editing && (
              <div className={styles.yearFields}>
                <div className={styles.yearField}>
                  <span>Año actual:</span>
                  <input
                    value={data.anioCurrent}
                    onChange={e => updateMorosidadMeta('anioCurrent', e.target.value)}
                    className={styles.yearInput}
                  />
                </div>
                <div className={styles.yearField}>
                  <span>Año anterior:</span>
                  <input
                    value={data.anioAnterior}
                    onChange={e => updateMorosidadMeta('anioAnterior', e.target.value)}
                    className={styles.yearInput}
                  />
                </div>
              </div>
            )}
          </div>
          <table className={styles.detailTable}>
            <thead>
              <tr>
                {['Mes', data.anioCurrent || 'Actual', data.anioAnterior || 'Anterior', 'Media Emp.'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.morosidad.length > 0 ? data.morosidad : ensureMorosidadRows([])).map((r, i) => {
                const c = r.currentPct !== null ? (r.currentPct < (r.mediaPct ?? 99) ? '#34d399' : '#f87171') : '#64748b';
                return (
                  <tr
                    key={i}
                    className={styles.dataRow}
                  >
                    <td className={styles.detailMonthCell}>
                      {r.mes || MESES[i]}
                    </td>
                    <td className={styles.detailValueCell}>
                      {editing ? (
                        <EditCell value={r.current} onChange={v => updateMorosidad(i, 'current', v)} onBlur={() => formatMorosidadPct(i, 'current')} placeholder="0%" width="70px" />
                      ) : (
                        r.currentPct !== null ? (
                          <span className={`${styles.statusBadge} ${styles.largeBadge}`}>
                            <span className={styles.statusDot} style={{ '--status-color': c } as CSSProperties}>●</span>
                            {r.current}
                          </span>
                        ) : <span className={styles.secondaryValue}>—</span>
                      )}
                    </td>
                    <td className={styles.detailValueCell}>
                      {editing ? (
                        <EditCell value={r.anterior} onChange={v => updateMorosidad(i, 'anterior', v)} onBlur={() => formatMorosidadPct(i, 'anterior')} placeholder="0%" width="70px" />
                      ) : (
                        <span className={styles.secondaryValue}>{r.anteriorPct !== null ? r.anterior : '—'}</span>
                      )}
                    </td>
                    <td className={styles.detailValueCell}>
                      {editing ? (
                        <EditCell value={r.mediaEmp} onChange={v => updateMorosidad(i, 'mediaEmp', v)} onBlur={() => formatMorosidadPct(i, 'mediaEmp')} placeholder="0%" width="70px" />
                      ) : (
                        <span className={styles.secondaryValue}>{r.mediaPct !== null ? r.mediaEmp : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
