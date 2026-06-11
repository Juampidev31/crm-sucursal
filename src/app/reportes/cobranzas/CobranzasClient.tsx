'use client';

import { useState, useCallback } from 'react';
import { useDeferredMount, ChartShimmer } from '@/components/ChartShimmer';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend,
  BarController, LineController,
} from 'chart.js';
import { Line, Chart } from 'react-chartjs-2';
import SelectReporte from '@/components/SelectReporte';
import type { CobranzasData, TramoRow, MorosidadRow } from './data';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { parseNumberRobust, parsePct } from '@/lib/csv-utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController);

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
      value={value === '-' ? '' : value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width,
        padding: '5px 8px',
        fontSize: '12px',
        fontWeight: 600,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px',
        color: '#fff',
        textAlign: align,
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s',
      }}
      onFocus={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        if (onBlur) onBlur();
      }}
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
    <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', flex: 1, minWidth: '280px', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '3px', height: '14px', background: color, borderRadius: '4px' }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#9a9aa3', letterSpacing: '1px', textTransform: 'uppercase' }}>{titulo}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.005)' }}>
            {['Mes', 'Objetivo', 'Recupero', 'Cumpl.'].map(h => (
              <th key={h} style={{ padding: '12px 14px', textAlign: h === 'Mes' ? 'left' : 'right', color: '#9a9aa3', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const c = cumplColor(r.pct);
            return (
              <tr
                key={i}
                className="hover-row"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.1s ease',
                  cursor: 'default',
                }}
              >
                <td style={{ padding: '10px 14px', color: '#eaeaea', fontWeight: 700 }}>
                  {editing ? r.mes || MESES[i] || `Mes ${i + 1}` : r.mes}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {editing ? (
                    <EditCell value={r.objetivo} onChange={v => onRowChange(i, 'objetivo', v)} placeholder="0" />
                  ) : (
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{r.objetivo}</span>
                  )}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {editing ? (
                    <EditCell value={r.recupero} onChange={v => onRowChange(i, 'recupero', v)} placeholder="0" />
                  ) : (
                    <span style={{ color: '#eaeaea', fontWeight: 700 }}>{r.recupero}</span>
                  )}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {editing ? (
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: c }}>●</span>
                      {r.cumplimiento !== '-' ? r.cumplimiento : '0%'}
                    </span>
                  ) : (
                    r.pct !== null ? (
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: '11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: c }}>●</span>
                        {r.cumplimiento}
                      </span>
                    ) : <span style={{ color: '#64748b' }}>—</span>
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
    legend: { labels: { color: '#9a9aa3', font: { size: 10, weight: 600 }, usePointStyle: true, padding: 16 } },
    tooltip: { backgroundColor: '#0c0c0c', titleColor: '#fff', bodyColor: '#9a9aa3', borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 },
  },
  scales: {
    x: { ticks: { color: '#9a9aa3', font: { size: 10, weight: 600 } }, grid: { color: 'rgba(255,255,255,0.02)' }, border: { display: false } },
    y: { ticks: { color: '#9a9aa3', font: { size: 10, weight: 600 }, callback: (v: number | string) => `${v}${yLabel}` }, grid: { color: 'rgba(255,255,255,0.025)' }, border: { display: false } },
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
      let val = row[field];
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
        backgroundColor: (context: any) => context.raw > 0 ? 'rgba(248, 113, 113, 0.7)' : 'rgba(52, 211, 153, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Dif. vs Media Emp.',
        data: data.morosidad.map(r => (r.currentPct !== null && r.mediaPct !== null) ? Number((r.currentPct - r.mediaPct).toFixed(2)) : 0),
        backgroundColor: (context: any) => context.raw > 0 ? 'rgba(248, 113, 113, 0.3)' : 'rgba(52, 211, 153, 0.3)',
        borderColor: (context: any) => context.raw > 0 ? '#f87171' : '#34d399',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : '#f87171',
          }}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {editing ? (
            <>
              <button
                onClick={saveData}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 20px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)', color: '#050505', border: 'none',
                  fontWeight: 800, fontSize: '12px', cursor: saving ? 'wait' : 'pointer',
                  letterSpacing: '0.5px', opacity: saving ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                  transition: 'all 0.2s',
                }}
              >
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '10px',
                  background: 'transparent', color: '#9a9aa3', border: '1px solid rgba(255,255,255,0.06)',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <X size={14} /> CANCELAR
              </button>
            </>
          ) : isAdmin ? (
            <button
              onClick={startEditing}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)', color: '#9a9aa3',
                border: '1px solid rgba(255,255,255,0.06)',
                fontWeight: 800, fontSize: '12px', cursor: 'pointer',
                transition: 'all 0.2s', letterSpacing: '0.3px',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#9a9aa3'; }}
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
        />
      </div>

      {/* Editing banner */}
      {editing && (
        <div style={{
          background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)',
          borderRadius: '12px', padding: '14px 20px', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '12px', color: '#34d399', fontWeight: 700,
        }}>
          <Edit2 size={14} />
          Modo edición — Modificá los valores directamente en las tablas y hacé clic en GUARDAR.
        </div>
      )}

      {/* Tramo Tables */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="data-card" style={{ flex: 1, minWidth: '320px', marginBottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#9a9aa3', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Cumplimiento por Tramo</h3>
          <div style={{ height: '260px' }}>
            {chartsLoaded ? (
              <Chart type="bar" data={cumplData} options={chartOpts('%') as any} />
            ) : (
              <ChartShimmer />
            )}
          </div>
        </div>

        <div className="data-card" style={{ flex: 1, minWidth: '320px', marginBottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#9a9aa3', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Morosidad Anual</h3>
          <div style={{ height: '260px' }}>
            {chartsLoaded ? (
              <Line data={moresData} options={chartOpts('%') as any} />
            ) : (
              <ChartShimmer />
            )}
          </div>
        </div>

        <div className="data-card" style={{ flex: 1, minWidth: '320px', marginBottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#9a9aa3', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Variación Morosidad (+/-)</h3>
          <div style={{ height: '260px' }}>
            {chartsLoaded ? (
              <Chart type="bar" data={variationData} options={{ ...chartOpts(' p.p.'), maintainAspectRatio: false } as any} />
            ) : (
              <ChartShimmer />
            )}
          </div>
        </div>
      </div>

      {/* Morosidad Detail Table */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#9a9aa3', letterSpacing: '1px', textTransform: 'uppercase' }}>Detalle Morosidad</span>
            {editing && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Año actual:</span>
                  <input
                    value={data.anioCurrent}
                    onChange={e => updateMorosidadMeta('anioCurrent', e.target.value)}
                    style={{
                      width: '60px', padding: '3px 6px', fontSize: '11px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '4px', color: '#fff', textAlign: 'center', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Año anterior:</span>
                  <input
                    value={data.anioAnterior}
                    onChange={e => updateMorosidadMeta('anioAnterior', e.target.value)}
                    style={{
                      width: '60px', padding: '3px 6px', fontSize: '11px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '4px', color: '#fff', textAlign: 'center', outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.005)' }}>
                {['Mes', data.anioCurrent || 'Actual', data.anioAnterior || 'Anterior', 'Media Emp.'].map(h => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'center', color: '#9a9aa3', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.morosidad.length > 0 ? data.morosidad : ensureMorosidadRows([])).map((r, i) => {
                const c = r.currentPct !== null ? (r.currentPct < (r.mediaPct ?? 99) ? '#34d399' : '#f87171') : '#64748b';
                return (
                  <tr
                    key={i}
                    className="hover-row"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.1s ease',
                      cursor: 'default',
                    }}
                  >
                    <td style={{ padding: '12px 14px', color: '#eaeaea', fontWeight: 700, textAlign: 'center' }}>
                      {r.mes || MESES[i]}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {editing ? (
                        <EditCell value={r.current} onChange={v => updateMorosidad(i, 'current', v)} onBlur={() => formatMorosidadPct(i, 'current')} placeholder="0%" width="70px" />
                      ) : (
                        r.currentPct !== null ? (
                          <span style={{ color: '#fff', fontWeight: 800, fontSize: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 9px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: c }}>●</span>
                            {r.current}
                          </span>
                        ) : <span style={{ color: '#64748b' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {editing ? (
                        <EditCell value={r.anterior} onChange={v => updateMorosidad(i, 'anterior', v)} onBlur={() => formatMorosidadPct(i, 'anterior')} placeholder="0%" width="70px" />
                      ) : (
                        <span style={{ color: '#9a9aa3', fontWeight: 600 }}>{r.anteriorPct !== null ? r.anterior : '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {editing ? (
                        <EditCell value={r.mediaEmp} onChange={v => updateMorosidad(i, 'mediaEmp', v)} onBlur={() => formatMorosidadPct(i, 'mediaEmp')} placeholder="0%" width="70px" />
                      ) : (
                        <span style={{ color: '#9a9aa3', fontWeight: 600 }}>{r.mediaPct !== null ? r.mediaEmp : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
