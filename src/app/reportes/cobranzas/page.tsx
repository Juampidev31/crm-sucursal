'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const YEARS = ['2025', '2026'];

interface TramoRow { mes: string; objetivo: string; recupero: string; cumplimiento: string; pct: number | null; }
interface MorosidadRow { mes: string; current: string; currentPct: number | null; anterior: string; anteriorPct: number | null; mediaEmp: string; mediaPct: number | null; }
interface Data {
  tramo90: TramoRow[]; tramo120: TramoRow[]; refin: TramoRow[];
  morosidad: MorosidadRow[]; mediaEmpGlobal: string; anioCurrent: string; anioAnterior: string;
}

function cumplColor(pct: number | null): string {
  if (pct === null) return '#333';
  if (pct >= 100) return '#34d399';
  if (pct >= 75) return '#fbbf24';
  return '#f87171';
}

function TramoTable({ titulo, rows, color }: { titulo: string; rows: TramoRow[]; color: string }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', overflow: 'hidden', flex: 1, minWidth: '280px' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '3px', height: '14px', background: color, borderRadius: '4px' }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>{titulo}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {['Mes', 'Objetivo', 'Recupero', 'Cumpl.'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Mes' ? 'left' : 'right', color: '#444', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const c = cumplColor(r.pct);
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 12px', color: '#888', fontWeight: 600 }}>{r.mes}</td>
                <td style={{ padding: '8px 12px', color: '#444', textAlign: 'right' }}>{r.objetivo}</td>
                <td style={{ padding: '8px 12px', color: '#aaa', fontWeight: 600, textAlign: 'right' }}>{r.recupero}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                  {r.pct !== null ? (
                    <span style={{ color: c, fontWeight: 800, fontSize: '11px', background: `${c}18`, padding: '2px 7px', borderRadius: '6px' }}>{r.cumplimiento}</span>
                  ) : <span style={{ color: '#333' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const chartOpts = (yLabel: string) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#666', font: { size: 11 }, usePointStyle: true, padding: 16 } },
    tooltip: { backgroundColor: '#111', titleColor: '#fff', bodyColor: '#aaa', borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 },
  },
  scales: {
    x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
    y: { ticks: { color: '#555', font: { size: 10 }, callback: (v: number | string) => `${v}${yLabel}` }, grid: { color: 'rgba(255,255,255,0.04)' } },
  },
});

export default function ReporteCobranzasPage() {
  const [year, setYear] = useState('2026');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cobranzas?year=${year}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [year]);

  const meses = data?.tramo90.map(r => r.mes) ?? [];

  const cumplData = {
    labels: meses,
    datasets: [
      { label: 'Tramo 90-119', data: data?.tramo90.map(r => r.pct) ?? [], backgroundColor: 'rgba(96,165,250,0.7)', borderRadius: 4 },
      { label: 'Tramo 120-209', data: data?.tramo120.map(r => r.pct) ?? [], backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 4 },
      { label: 'Refinanciaciones', data: data?.refin.map(r => r.pct) ?? [], backgroundColor: 'rgba(247,228,121,0.7)', borderRadius: 4 },
    ],
  };

  const moresMeses = data?.morosidad.map(r => r.mes) ?? [];
  const moresData = {
    labels: moresMeses,
    datasets: [
      { label: data?.anioCurrent ?? 'Actual', data: data?.morosidad.map(r => r.currentPct) ?? [], borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', tension: 0.3, pointRadius: 3, fill: true },
      { label: data?.anioAnterior ?? 'Anterior', data: data?.morosidad.map(r => r.anteriorPct) ?? [], borderColor: '#555', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderDash: [4, 4] },
      { label: 'Media Emp.', data: data?.morosidad.map(r => r.mediaPct) ?? [], borderColor: '#fbbf24', backgroundColor: 'transparent', tension: 0, pointRadius: 0, borderDash: [6, 3] },
    ],
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Reporte de Cobranzas</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {data?.mediaEmpGlobal && (
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 12px', textAlign: 'center', height: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '8px', color: '#444', fontWeight: 800, letterSpacing: '1px', marginBottom: '1px' }}>MEDIA EMP.</div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#f87171' }}>{data.mediaEmpGlobal}</div>
            </div>
          )}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px 3px', height: '36px', display: 'flex', alignItems: 'center' }}>
            {YEARS.map(y => (
              <button key={y} onClick={() => setYear(y)} style={{
                padding: '4px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: year === y ? '#f7e479' : 'transparent',
                color: year === y ? '#000' : '#555',
              }}>{y}</button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <>
          {/* Tablas tramos */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <TramoTable titulo="Tramo 90-119" rows={data?.tramo90 ?? []} color="#60a5fa" />
            <TramoTable titulo="Tramo 120-209" rows={data?.tramo120 ?? []} color="#a78bfa" />
            <TramoTable titulo="Refinanciaciones" rows={data?.refin ?? []} color="#f7e479" />
          </div>

          {/* Gráfico cumplimiento */}
          <div className="data-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Cumplimiento por Tramo</h3>
            <div style={{ height: '260px' }}>
              <Bar data={cumplData} options={chartOpts('%') as object} />
            </div>
          </div>

          {/* Gráfico morosidad */}
          <div className="data-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Morosidad</h3>
            <div style={{ height: '260px' }}>
              <Line data={moresData} options={chartOpts('%') as object} />
            </div>
          </div>

          {/* Tabla morosidad */}
          {data?.morosidad && data.morosidad.length > 0 && (
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>Detalle Morosidad</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Mes', data.anioCurrent, data.anioAnterior, 'Media Emp.'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Mes' ? 'left' : 'right', color: '#444', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.morosidad.map((r, i) => {
                    const c = r.currentPct !== null ? (r.currentPct < (r.mediaPct ?? 99) ? '#34d399' : '#f87171') : '#333';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '8px 14px', color: '#888', fontWeight: 600 }}>{r.mes}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          {r.currentPct !== null ? <span style={{ color: c, fontWeight: 800, fontSize: '11px', background: `${c}18`, padding: '2px 7px', borderRadius: '6px' }}>{r.current}</span> : <span style={{ color: '#333' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 14px', color: '#555', textAlign: 'right' }}>{r.anteriorPct !== null ? r.anterior : '—'}</td>
                        <td style={{ padding: '8px 14px', color: '#555', textAlign: 'right' }}>{r.mediaPct !== null ? r.mediaEmp : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
