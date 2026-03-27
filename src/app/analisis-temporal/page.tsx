'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, displayAnalista } from '@/lib/utils';
import CustomSelect from '@/components/CustomSelect';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Tooltip, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Filler);

// ── Module-level constants ────────────────────────────────────────────────────

const numFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PERIODOS = [
  { label: 'Últimos 7 días',  value: 7  },
  { label: 'Últimos 15 días', value: 15 },
  { label: 'Últimos 30 días', value: 30 },
  { label: 'Últimos 60 días', value: 60 },
  { label: 'Últimos 90 días', value: 90 },
];

const METRICAS = [
  { value: 'ventas',      label: 'Ventas ($)'        },
  { value: 'operaciones', label: 'Operaciones (N)'   },
  { value: 'ticket',      label: 'Ticket Promedio ($)'},
];

const SECTION_STYLE: React.CSSProperties = {
  background: '#000',
  border: '1px solid var(--border-color)',
  borderRadius: 6,
  padding: 20,
  marginBottom: 16,
};

const DIVIDER: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  marginTop: 16,
  paddingTop: 16,
  borderTop: '1px solid rgba(255,255,255,0.04)',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reg { analista: string; estado: string; monto: number; fecha: string | null; }

// ── Pure helpers (no closure needed) ─────────────────────────────────────────

function heatColor(val: number, max: number): string {
  if (val === 0) return 'rgba(255,255,255,0.03)';
  const t = Math.min(val / max, 1);
  return `rgba(255, 255, 255, ${(0.1 + t * 0.4).toFixed(2)})`;
}

function toLocalDate(fecha: string): Date {
  return new Date(fecha.length === 10 ? `${fecha}T00:00:00` : fecha);
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionHeader = React.memo(function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>{sub}</div>}
    </div>
  );
});

const StatCell = React.memo(function StatCell({
  label, value, color = '#fff',
}: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalisisTemporalPage() {
  const [registros,   setRegistros]   = useState<Reg[]>([]);
  const [analistas,   setAnalistas]   = useState<string[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [periodo,     setPeriodo]     = useState(30);
  const [analistaFil, setAnalistaFil] = useState('todos');
  const [metrica,     setMetrica]     = useState('ventas');

  useEffect(() => {
    supabase
      .from('registros')
      .select('analista, estado, monto, fecha')
      .then(({ data }) => {
        const regs = (data ?? []) as Reg[];
        setRegistros(regs);
        setAnalistas([...new Set(regs.map(r => r.analista).filter(Boolean) as string[])]);
        setLoading(false);
      });
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const ventasFiltradas = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodo);
    cutoff.setHours(0, 0, 0, 0);

    return registros.filter(r => {
      if (!r.fecha) return false;
      const estado = (r.estado ?? '').toLowerCase();
      if (estado !== 'venta' && !estado.includes('aprobado cc')) return false;
      if (toLocalDate(r.fecha) < cutoff) return false;
      if (analistaFil !== 'todos' && r.analista !== analistaFil) return false;
      return true;
    });
  }, [registros, periodo, analistaFil]);

  // Aggregation function — stable reference per metrica change
  const calcVal = useCallback((regs: Reg[]): number => {
    if (metrica === 'operaciones') return regs.length;
    const total = regs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    return metrica === 'ticket' && regs.length > 0 ? total / regs.length : total;
  }, [metrica]);

  // O(n + periodo) groupBy — avoids O(n × periodo) filter-per-day
  const tendenciaData = useMemo(() => {
    const now = new Date();

    const byDate = new Map<string, Reg[]>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }

    const labels: string[] = [];
    const daily: number[] = [];
    for (let i = periodo - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      daily.push(calcVal(byDate.get(key) ?? []));
    }

    if (metrica === 'ventas') {
      let acc = 0;
      return { labels, values: daily.map(v => (acc += v)), daily };
    }
    return { labels, values: daily, daily };
  }, [ventasFiltradas, periodo, metrica, calcVal]);

  const summary = useMemo(() => {
    const total = calcVal(ventasFiltradas);
    return {
      total,
      avg:    periodo > 0 ? total / periodo : 0,
      maxDay: tendenciaData.daily.length ? Math.max(...tendenciaData.daily) : 0,
    };
  }, [ventasFiltradas, tendenciaData.daily, periodo, calcVal]);

  const mapaActividad = useMemo(() => {
    const now    = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - periodo);

    const dailyMap = new Map<string, number>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const add = metrica === 'operaciones' ? 1 : Number(r.monto) || 0;
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + add);
    }

    // Align cursor to Monday
    const cur = new Date(cutoff);
    const dow  = cur.getDay();
    cur.setDate(cur.getDate() + (dow === 0 ? -6 : 1 - dow));

    const weeks: { valor: number; key: string }[][] = [];
    while (cur <= now) {
      const week: typeof weeks[0] = [];
      for (let d = 0; d < 7; d++) {
        const key = toDateKey(cur);
        week.push({ valor: dailyMap.get(key) ?? 0, key });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }

    return { weeks, maxVal: Math.max(...dailyMap.values(), 1) };
  }, [ventasFiltradas, periodo, metrica]);

  const weeklyStats = useMemo(() => {
    const totals = mapaActividad.weeks
      .map((w, i) => ({ label: `Sem ${i + 1}`, total: w.reduce((s, d) => s + d.valor, 0) }))
      .filter(w => w.total > 0);

    if (!totals.length) return { totals, avg: 0, best: { label: '—', total: 0 }, worst: { label: '—', total: 0 } };

    const avg = totals.reduce((s, w) => s + w.total, 0) / totals.length;
    return {
      totals,
      avg,
      best:  totals.reduce((a, b) => b.total > a.total ? b : a),
      worst: totals.reduce((a, b) => b.total < a.total ? b : a),
    };
  }, [mapaActividad]);

  const dowStats = useMemo(() => {
    const sums = Array<number>(7).fill(0);
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      let dow = toLocalDate(r.fecha).getDay();
      dow = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
      sums[dow] += metrica === 'operaciones' ? 1 : Number(r.monto) || 0;
    }
    const max = Math.max(...sums, 0);
    return { sums, max, activeDay: DIAS_SEMANA[sums.indexOf(max)] ?? '—' };
  }, [ventasFiltradas, metrica]);

  // ── Chart configs ─────────────────────────────────────────────────────────

  const fmtTip = useCallback(
    (ctx: { parsed: { y: number | null } }) => {
      const y = ctx.parsed.y ?? 0;
      return metrica === 'operaciones' ? ` ${y}` : ` ${formatCurrency(y)}`;
    },
    [metrica],
  );

  const fmtAxis = useCallback(
    (v: string | number) =>
      metrica === 'operaciones' ? v : `$${numFmt.format(Number(v) / 1_000_000)}M`,
    [metrica],
  );

  const sharedPlugins = useMemo(() => ({
    legend: { display: false },
    tooltip: { callbacks: { label: fmtTip } },
  }), [fmtTip]);

  const tendenciaChart = useMemo(() => ({
    labels: tendenciaData.labels,
    datasets: [{
      data: tendenciaData.values,
      borderColor: '#fff',
      backgroundColor: 'rgba(255,255,255,0.05)',
      fill: true, tension: 0.4,
      pointRadius: 3, pointBackgroundColor: '#fff', borderWidth: 2,
    }],
  }), [tendenciaData]);

  const tendenciaOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: sharedPlugins,
    scales: {
      x: { ticks: { color: '#444', maxTicksLimit: 12, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#444', font: { size: 11 }, callback: fmtAxis }, grid: { color: 'rgba(255,255,255,0.03)' } },
    },
  }), [sharedPlugins, fmtAxis]);

  const semanasChart = useMemo(() => ({
    labels: weeklyStats.totals.map(s => s.label),
    datasets: [{
      data:            weeklyStats.totals.map(s => s.total),
      backgroundColor: weeklyStats.totals.map(s => s.total >= weeklyStats.avg ? '#fff' : '#f87171'),
      borderRadius: 6,
    }],
  }), [weeklyStats]);

  const dowChart = useMemo(() => ({
    labels: DIAS_SEMANA,
    datasets: [{
      data:            dowStats.sums,
      backgroundColor: dowStats.sums.map(v => v >= dowStats.max * 0.9 ? '#fff' : 'rgba(255,255,255,0.1)'),
      borderRadius: 6,
    }],
  }), [dowStats]);

  const barOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: sharedPlugins,
    scales: {
      x: { ticks: { color: '#444', font: { size: 12 } }, grid: { display: false } },
      y: { ticks: { color: '#444', font: { size: 11 }, callback: fmtAxis }, grid: { color: 'rgba(255,255,255,0.03)' } },
    },
  }), [sharedPlugins, fmtAxis]);

  const semanasBarOpts = useMemo(() => ({
    ...barOpts,
    scales: { ...barOpts.scales, y: { display: false } },
  }), [barOpts]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const fmt = useCallback(
    (v: number) => metrica === 'operaciones' ? String(v) : formatCurrency(v),
    [metrica],
  );

  const fmtK = useCallback(
    (v: number) => metrica === 'operaciones' ? String(v) : `$${numFmt.format(v / 1_000)}K`,
    [metrica],
  );

  const analistaOpts = useMemo(() => [
    { label: 'Todos', value: 'todos' },
    ...analistas.map(a => ({ label: displayAnalista(a), value: a })),
  ], [analistas]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">

      {/* Filters */}
      <div style={{
        background: '#000', border: '1px solid var(--border-color)',
        borderRadius: 6, padding: '16px 20px',
        display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.5)' }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Análisis Temporal</span>
        </div>

        {[
          { label: 'PERÍODO',  node: <CustomSelect options={PERIODOS}    value={periodo}     onChange={setPeriodo}     /> },
          { label: 'ANALISTA', node: <CustomSelect options={analistaOpts} value={analistaFil} onChange={setAnalistaFil} /> },
          { label: 'MÉTRICA',  node: <CustomSelect options={METRICAS}    value={metrica}     onChange={setMetrica}     /> },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{f.label}</div>
            {f.node}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <>
          {/* Row 1: Tendencia + Mapa */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Tendencia */}
            <div style={SECTION_STYLE}>
              <SectionHeader title="Tendencia de Ventas" sub={`Acumulado por día — últimos ${periodo} días`} />
              <div style={{ height: 240 }}>
                <Line data={tendenciaChart} options={tendenciaOpts} />
              </div>
              <div style={DIVIDER}>
                <StatCell label="TENDENCIA"  value={fmt(summary.total)}  color="#fff" />
                <StatCell label="PROMEDIO"   value={metrica === 'operaciones' ? summary.avg.toFixed(1) : formatCurrency(summary.avg)} />
                <StatCell label="MÁXIMO DÍA" value={fmt(summary.maxDay)} />
              </div>
            </div>

            {/* Mapa de actividad */}
            <div style={SECTION_STYLE}>
              <SectionHeader title="Mapa de Actividad" sub={`Ventas por día — últimos ${periodo} días`} />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }} />
                      {DIAS_SEMANA.map(d => (
                        <th key={d} style={{ textAlign: 'center', fontSize: 10, color: '#555', fontWeight: 600, padding: '0 2px 6px' }}>{d}</th>
                      ))}
                      <th style={{ fontSize: 10, color: '#555', fontWeight: 600, textAlign: 'right', paddingLeft: 8, paddingBottom: 6 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapaActividad.weeks.map((week, wi) => {
                      const weekTotal = week.reduce((s, d) => s + d.valor, 0);
                      return (
                        <tr key={wi}>
                          <td style={{ fontSize: 10, color: '#444', fontWeight: 600, paddingRight: 6, textAlign: 'right' }}>S{wi + 1}</td>
                          {week.map((day, di) => (
                            <td
                              key={di}
                              title={`${day.key}: ${fmt(day.valor)}`}
                              style={{
                                background:  heatColor(day.valor, mapaActividad.maxVal),
                                borderRadius: 4, height: 32,
                                textAlign: 'center', fontSize: 10,
                                color:      day.valor > 0 ? '#fff' : '#333',
                                fontWeight: day.valor > 0 ? 600 : 400,
                                border:     day.key === todayKey ? '1px solid rgba(247,228,121,0.6)' : 'none',
                                padding: '0 4px', cursor: 'default', minWidth: 44,
                              }}
                            >
                              {day.valor > 0 ? fmtK(day.valor) : ''}
                            </td>
                          ))}
                          <td style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'right', paddingLeft: 8 }}>
                            {fmtK(weekTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td />
                      {DIAS_SEMANA.map((_, di) => {
                        const colTotal = mapaActividad.weeks.reduce((s, w) => s + (w[di]?.valor ?? 0), 0);
                        return (
                          <td key={di} style={{ fontSize: 10, color: '#555', fontWeight: 700, textAlign: 'center', paddingTop: 6 }}>
                            {colTotal > 0 ? fmtK(colTotal) : ''}
                          </td>
                        );
                      })}
                      <td style={{ fontSize: 11, color: '#fff', fontWeight: 800, textAlign: 'right', paddingLeft: 8, paddingTop: 6 }}>
                        {metrica === 'operaciones' ? ventasFiltradas.length : `$${numFmt.format(summary.total / 1_000)}K`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ ...DIVIDER, marginTop: 14, paddingTop: 14 }}>
                <StatCell label="DÍA MÁS ACTIVO" value={dowStats.activeDay} />
                <StatCell label="SEMANA PICO"     value={weeklyStats.best.label} />
                <StatCell label="TOTAL"           value={fmt(summary.total)} color="#fff" />
              </div>
            </div>
          </div>

          {/* Estacionalidad */}
          <div style={SECTION_STYLE}>
            <SectionHeader title="Estacionalidad" sub="Distribución por semana" />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(weeklyStats.totals.length, 4)}, 1fr) 1fr`, gap: 12, alignItems: 'end' }}>
              {weeklyStats.totals.slice(0, 4).map(s => {
                const pct = weeklyStats.avg > 0 ? ((s.total - weeklyStats.avg) / weeklyStats.avg) * 100 : 0;
                return (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{fmt(s.total)}</div>
                    <div style={{ fontSize: 11, color: pct >= 0 ? '#fff' : '#f87171', marginTop: 4, fontWeight: 600 }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs promedio
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{s.label}</div>
                  </div>
                );
              })}
              <div>
                {weeklyStats.totals.length > 0 && (
                  <div style={{ height: 80 }}>
                    <Bar data={semanasChart} options={semanasBarOpts} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>MEJOR SEM</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{weeklyStats.worst.label}</div>
                  </div>
                  {weeklyStats.avg > 0 && weeklyStats.best.total > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>VARIACIÓN</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {weeklyStats.worst.total > 0
                          ? `${((weeklyStats.best.total / weeklyStats.worst.total - 1) * 100).toFixed(1)}%`
                          : '—'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Por día de semana */}
          <div style={SECTION_STYLE}>
            <SectionHeader title="Por Día de Semana" sub="Rendimiento en $" />
            <div style={{ height: 180 }}>
              <Bar data={dowChart} options={barOpts} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
