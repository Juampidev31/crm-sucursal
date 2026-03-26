'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, displayAnalista } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const numFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface Reg { analista: string; estado: string; monto: number; fecha: string | null; }

const PERIODOS = [
  { label: 'Últimos 7 días', dias: 7 },
  { label: 'Últimos 15 días', dias: 15 },
  { label: 'Últimos 30 días', dias: 30 },
  { label: 'Últimos 60 días', dias: 60 },
  { label: 'Últimos 90 días', dias: 90 },
];

const METRICAS = [
  { key: 'ventas', label: 'Ventas ($)' },
  { key: 'operaciones', label: 'Operaciones (N)' },
  { key: 'ticket', label: 'Ticket Promedio ($)' },
];

export default function AnalisisTemporalPage() {
  const [registros, setRegistros] = useState<Reg[]>([]);
  const [analistas, setAnalistas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(30);
  const [analistaFil, setAnalistaFil] = useState('todos');
  const [metrica, setMetrica] = useState('ventas');

  useEffect(() => {
    supabase.from('registros').select('analista, estado, monto, fecha').then(({ data }) => {
      const regs = (data || []) as Reg[];
      setRegistros(regs);
      const set = new Set(regs.map(r => r.analista).filter(Boolean));
      setAnalistas(Array.from(set) as string[]);
      setLoading(false);
    });
  }, []);

  // Filter: only ventas (estado venta or aprobado cc) within the period
  const ventasFiltradas = useMemo(() => {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - periodo);
    desde.setHours(0, 0, 0, 0);

    return registros.filter(r => {
      if (!r.fecha) return false;
      // Agregar T00:00:00 para que JS lo trate como hora local y no UTC
      const f = new Date(r.fecha.length === 10 ? r.fecha + 'T00:00:00' : r.fecha);
      const esVenta = (r.estado || '').toLowerCase() === 'venta' || (r.estado || '').toLowerCase().includes('aprobado cc');
      if (!esVenta) return false;
      if (f < desde) return false;
      if (analistaFil !== 'todos' && r.analista !== analistaFil) return false;
      return true;
    });
  }, [registros, periodo, analistaFil]);

  // Get value based on metrica
  const getVal = useCallback((regs: Reg[]) => {
    if (metrica === 'operaciones') return regs.length;
    const total = regs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    if (metrica === 'ticket') return regs.length > 0 ? total / regs.length : 0;
    return total;
  }, [metrica]);

  // Tendencia: daily values for period
  const tendenciaData = useMemo(() => {
    const hoy = new Date();
    const dias: string[] = [];
    const valores: number[] = [];

    for (let i = periodo - 1; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dias.push(`${d.getDate()}/${d.getMonth() + 1}`);
      const regsDay = ventasFiltradas.filter(r => r.fecha?.slice(0, 10) === key);
      valores.push(getVal(regsDay));
    }

    // Cumulative for ventas/ticket, non-cumulative for ops
    if (metrica === 'ventas') {
      let acum = 0;
      const acumulados = valores.map(v => { acum += v; return acum; });
      return { dias, valores: acumulados };
    }
    return { dias, valores };
  }, [ventasFiltradas, periodo, getVal, metrica]);

  const totalPeriodo = getVal(ventasFiltradas);
  const promedioDiario = periodo > 0 ? totalPeriodo / periodo : 0;
  const maxDia = tendenciaData.valores.length > 0 ? Math.max(...tendenciaData.valores) : 0;

  // Mapa de actividad: calendar heatmap
  const mapaActividad = useMemo(() => {
    const hoy = new Date();
    // Find start of week containing (hoy - periodo)
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - periodo);

    // Build daily map
    const dailyMap = new Map<string, number>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) || 0) + (metrica === 'operaciones' ? 1 : Number(r.monto) || 0));
    }

    // Build weeks grid
    const semanas: { fecha: Date; valor: number; label: string }[][] = [];
    const cur = new Date(desde);
    // Align to Monday
    const dow = cur.getDay();
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    cur.setDate(cur.getDate() + offsetToMon);

    while (cur <= hoy) {
      const semana: { fecha: Date; valor: number; label: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const dia = new Date(cur);
        const key = dia.toISOString().slice(0, 10);
        semana.push({ fecha: dia, valor: dailyMap.get(key) || 0, label: key });
        cur.setDate(cur.getDate() + 1);
      }
      semanas.push(semana);
    }

    const maxVal = Math.max(...Array.from(dailyMap.values()), 1);
    return { semanas, maxVal };
  }, [ventasFiltradas, periodo, metrica]);

  // Semana totales (for estacionalidad)
  const semanaTotales = useMemo(() => {
    return mapaActividad.semanas.map((sem, i) => {
      const total = sem.reduce((s, d) => s + d.valor, 0);
      return { label: `Sem ${i + 1}`, total };
    }).filter(s => s.total > 0);
  }, [mapaActividad]);

  const promedioSemanal = semanaTotales.length > 0
    ? semanaTotales.reduce((s, w) => s + w.total, 0) / semanaTotales.length : 0;

  const mejorSem = semanaTotales.reduce((best, s) => s.total > best.total ? s : best, semanaTotales[0] || { label: '—', total: 0 });
  const peorSem = semanaTotales.reduce((best, s) => s.total < best.total ? s : best, semanaTotales[0] || { label: '—', total: 0 });

  // Por día de semana
  const porDiaSemana = useMemo(() => {
    const sumas = Array(7).fill(0);
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      // getDay: 0=sun,1=mon,...6=sat → reorder to mon=0
      let dow = new Date(r.fecha.length === 10 ? r.fecha + 'T00:00:00' : r.fecha).getDay();
      dow = dow === 0 ? 6 : dow - 1;
      sumas[dow] += metrica === 'operaciones' ? 1 : Number(r.monto) || 0;
    }
    return sumas;
  }, [ventasFiltradas, metrica]);

  const diaActivo = DIAS_SEMANA[porDiaSemana.indexOf(Math.max(...porDiaSemana))] || '—';

  // Charts
  const tendenciaChart = {
    labels: tendenciaData.dias,
    datasets: [{
      data: tendenciaData.valores,
      borderColor: '#4ade80',
      backgroundColor: 'rgba(74,222,128,0.1)',
      fill: true, tension: 0.4,
      pointRadius: 3, pointBackgroundColor: '#fff',
      borderWidth: 2,
    }],
  };

  const tendenciaOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => metrica === 'ventas' || metrica === 'ticket' ? ` ${formatCurrency(ctx.parsed.y)}` : ` ${ctx.parsed.y}` } } },
    scales: {
      x: { ticks: { color: '#444', maxTicksLimit: 12, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#444', callback: (v: string | number) => metrica === 'operaciones' ? v : `$${numFmt.format(Number(v) / 1000000)}M` }, grid: { color: 'rgba(255,255,255,0.03)' } },
    },
  };

  const semanasChart = {
    labels: semanaTotales.map(s => s.label),
    datasets: [{
      data: semanaTotales.map(s => s.total),
      backgroundColor: semanaTotales.map(s => s.total >= promedioSemanal ? '#4ade80' : '#f87171'),
      borderRadius: 6,
    }],
  };

  const diasSemanaChart = {
    labels: DIAS_SEMANA,
    datasets: [{
      data: porDiaSemana,
      backgroundColor: porDiaSemana.map(v => v >= Math.max(...porDiaSemana) * 0.9 ? '#4ade80' : 'rgba(74,222,128,0.4)'),
      borderRadius: 6,
    }],
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => metrica === 'ventas' || metrica === 'ticket' ? ` ${formatCurrency(ctx.parsed.y)}` : ` ${ctx.parsed.y}` } } },
    scales: {
      x: { ticks: { color: '#444', font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: '#444', callback: (v: string | number) => metrica === 'operaciones' ? v : `$${numFmt.format(Number(v) / 1000000)}M` }, grid: { color: 'rgba(255,255,255,0.03)' } },
    },
  };

  const selectStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#fff', fontSize: '13px',
    padding: '8px 36px 8px 12px', outline: 'none',
    fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
    WebkitAppearance: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    minWidth: '160px',
  };

  const sectionStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', padding: '20px', marginBottom: '16px',
  };

  const sectionTitle = (text: string, sub?: string) => (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: '#4ade80' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{text}</span>
      </div>
      {sub && <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', marginLeft: '11px' }}>{sub}</div>}
    </div>
  );

  // Heatmap cell color
  const heatColor = (val: number, max: number) => {
    if (val === 0) return 'rgba(255,255,255,0.03)';
    const intensity = Math.min(val / max, 1);
    const g = Math.round(80 + intensity * 142);
    return `rgba(0, ${g}, 60, ${0.3 + intensity * 0.7})`;
  };

  return (
    <div className="dashboard-container">
      {/* Filtros */}
      <div style={{
        background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '16px 20px',
        display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: '#4ade80' }} />
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Análisis Temporal</span>
        </div>
        {[
          { label: 'PERÍODO', node: (
            <select style={selectStyle} value={periodo} onChange={e => setPeriodo(Number(e.target.value))}>
              {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
            </select>
          )},
          { label: 'ANALISTA', node: (
            <select style={selectStyle} value={analistaFil} onChange={e => setAnalistaFil(e.target.value)}>
              <option value="todos">Todos</option>
              {analistas.map(a => <option key={a} value={a}>{displayAnalista(a)}</option>)}
            </select>
          )},
          { label: 'MÉTRICA', node: (
            <select style={selectStyle} value={metrica} onChange={e => setMetrica(e.target.value)}>
              {METRICAS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          )},
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{f.label}</div>
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
          {/* Tendencia de ventas + Mapa de actividad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Tendencia */}
            <div style={sectionStyle}>
              {sectionTitle('Tendencia de Ventas', `Acumulado por día — últimos ${periodo} días`)}
              <div style={{ height: '240px' }}>
                <Line data={tendenciaChart} options={tendenciaOptions} />
              </div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TENDENCIA</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#4ade80', marginTop: '2px' }}>
                    {metrica === 'operaciones' ? totalPeriodo : formatCurrency(totalPeriodo)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROMEDIO</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                    {metrica === 'operaciones' ? promedioDiario.toFixed(1) : formatCurrency(promedioDiario)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>MÁXIMO</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                    {metrica === 'operaciones' ? maxDia : formatCurrency(maxDia)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mapa de actividad */}
            <div style={sectionStyle}>
              {sectionTitle('Mapa de Actividad', `Ventas por día — últimos ${periodo} días`)}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }} />
                      {DIAS_SEMANA.map(d => (
                        <th key={d} style={{ textAlign: 'center', fontSize: '10px', color: '#555', fontWeight: 600, padding: '0 2px 6px' }}>{d}</th>
                      ))}
                      <th style={{ fontSize: '10px', color: '#555', fontWeight: 600, textAlign: 'right', paddingLeft: '8px', paddingBottom: '6px' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapaActividad.semanas.map((semana, si) => {
                      const semTotal = semana.reduce((s, d) => s + d.valor, 0);
                      return (
                        <tr key={si}>
                          <td style={{ fontSize: '10px', color: '#444', fontWeight: 600, paddingRight: '6px', textAlign: 'right' }}>S{si + 1}</td>
                          {semana.map((dia, di) => {
                            const hoy = new Date().toISOString().slice(0, 10);
                            const isHoy = dia.label === hoy;
                            return (
                              <td key={di} title={`${dia.label}: ${metrica === 'operaciones' ? dia.valor : formatCurrency(dia.valor)}`}
                                style={{
                                  background: heatColor(dia.valor, mapaActividad.maxVal),
                                  borderRadius: '4px', height: '32px',
                                  textAlign: 'center', fontSize: '10px',
                                  color: dia.valor > 0 ? '#fff' : '#333',
                                  fontWeight: dia.valor > 0 ? 600 : 400,
                                  border: isHoy ? '1px solid rgba(247,228,121,0.6)' : 'none',
                                  padding: '0 4px',
                                  cursor: 'default',
                                  minWidth: '44px',
                                }}>
                                {dia.valor > 0 ? (metrica === 'operaciones' ? dia.valor : `$${numFmt.format(dia.valor / 1000)}K`) : ''}
                              </td>
                            );
                          })}
                          <td style={{ fontSize: '11px', color: '#fff', fontWeight: 700, textAlign: 'right', paddingLeft: '8px' }}>
                            {metrica === 'operaciones' ? semTotal : `$${numFmt.format(semTotal / 1000)}K`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td />
                      {DIAS_SEMANA.map((_, di) => {
                        const colTotal = mapaActividad.semanas.reduce((s, sem) => s + (sem[di]?.valor || 0), 0);
                        return (
                          <td key={di} style={{ fontSize: '10px', color: '#555', fontWeight: 700, textAlign: 'center', paddingTop: '6px' }}>
                            {colTotal > 0 ? (metrica === 'operaciones' ? colTotal : `$${numFmt.format(colTotal / 1000)}K`) : ''}
                          </td>
                        );
                      })}
                      <td style={{ fontSize: '11px', color: '#4ade80', fontWeight: 800, textAlign: 'right', paddingLeft: '8px', paddingTop: '6px' }}>
                        {metrica === 'operaciones' ? ventasFiltradas.length : `$${numFmt.format(totalPeriodo / 1000)}K`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>DÍA MÁS ACTIVO</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{diaActivo}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>SEMANA PICO</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{mejorSem.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#4ade80', marginTop: '2px' }}>
                    {metrica === 'operaciones' ? ventasFiltradas.length : formatCurrency(totalPeriodo)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Estacionalidad */}
          <div style={sectionStyle}>
            {sectionTitle('Estacionalidad', 'Distribución por semana')}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(semanaTotales.length, 4)}, 1fr) 1fr`, gap: '12px', alignItems: 'end' }}>
              {semanaTotales.slice(0, 4).map(s => {
                const pctVsAvg = promedioSemanal > 0 ? ((s.total - promedioSemanal) / promedioSemanal) * 100 : 0;
                return (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                      {metrica === 'operaciones' ? s.total : formatCurrency(s.total)}
                    </div>
                    <div style={{ fontSize: '11px', color: pctVsAvg >= 0 ? '#4ade80' : '#f87171', marginTop: '4px', fontWeight: 600 }}>
                      {pctVsAvg >= 0 ? '+' : ''}{pctVsAvg.toFixed(1)}% vs promedio
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{s.label}</div>
                  </div>
                );
              })}
              <div>
                {semanaTotales.length > 0 && (
                  <div style={{ height: '80px' }}>
                    <Bar data={semanasChart} options={{ ...barOptions, maintainAspectRatio: false, scales: { ...barOptions.scales, y: { display: false } } }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>MEJOR SEM</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80' }}>{mejorSem.label}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>PEOR SEM</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#f87171' }}>{peorSem.label}</div>
                  </div>
                  {promedioSemanal > 0 && mejorSem.total > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>VARIACIÓN</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        {peorSem.total > 0 ? `${((mejorSem.total / peorSem.total - 1) * 100).toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Por día de semana */}
          <div style={sectionStyle}>
            {sectionTitle('Por Día de Semana', 'Rendimiento en $')}
            <div style={{ height: '180px' }}>
              <Bar data={diasSemanaChart} options={barOptions} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
