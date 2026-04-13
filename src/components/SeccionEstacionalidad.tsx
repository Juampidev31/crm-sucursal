'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const VERDE = '#4CAF50';
const ROJO = '#ef4444';
const AZUL = '#3b82f6';

interface Props {
  filtroMes: string;      // "YYYY-MM"
  filtroAnalista?: string; // "" = todos
}

export function SeccionEstacionalidad({ filtroMes, filtroAnalista }: Props) {
  const { registros, loading } = useData();
  const [collapsed, setCollapsed] = useState(false);

  const semanas = useMemo(() => {
    if (!filtroMes) return null;

    const ventas = registros.filter(r => {
      const estado = r.estado?.toLowerCase() || '';
      if (!(estado === 'venta' || estado.includes('aprobado cc'))) return false;
      if (!r.fecha) return false;
      if (r.fecha.slice(0, 7) !== filtroMes) return false;
      if (filtroAnalista && r.analista !== filtroAnalista) return false;
      return true;
    });

    const sums = [0, 0, 0, 0];

    for (const r of ventas) {
      const match = r.fecha!.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const dia = match ? +match[3] : 1;
      const idx = dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3;
      sums[idx] += Number(r.monto) || 0;
    }

    const avg = sums.reduce((a, b) => a + b, 0) / 4;

    return sums.map((monto, i) => ({
      label: `SEMANA ${i + 1}`,
      shortLabel: `Sem ${i + 1}`,
      monto,
      pct: avg > 0 ? ((monto - avg) / avg) * 100 : 0,
      positivo: monto >= avg,
    }));
  }, [registros, filtroMes, filtroAnalista]);

  if (loading || !semanas) return null;

  const chartData = {
    labels: semanas.map(s => s.shortLabel),
    datasets: [{
      data: semanas.map(s => s.monto),
      backgroundColor: semanas.map(s =>
        s.positivo ? 'rgba(76,175,80,0.85)' : 'rgba(239,68,68,0.75)'
      ),
      borderRadius: 5,
      borderSkipped: false as const,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#555', font: { size: 11 } },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: {
          color: '#555',
          font: { size: 10 },
          maxTicksLimit: 5,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) =>
            new Intl.NumberFormat('es-AR').format(Number(v)),
        },
        grid: { color: 'rgba(255,255,255,0.03)' },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid rgba(255,255,255,0.03)',
      borderRadius: '16px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.03)',
      }}>
        <div>
          <div style={{
            fontSize: '11px',
            color: '#fff',
            fontWeight: 900,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            EVOLUCION SEMANAL
          </div>
        </div>

        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#555',
          }}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr) 300px',
          gap: '0',
          padding: '12px 24px',
          alignItems: 'center',
        }}>
          {semanas.map(s => (
            <div key={s.label} style={{ padding: '8px 12px', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{
                fontSize: '10px',
                color: '#555',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '4px',
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
                marginBottom: '4px',
                lineHeight: 1.1,
              }}>
                {formatCurrency(s.monto)}
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: s.positivo ? VERDE : ROJO,
              }}>
                {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}% vs promedio
              </div>
            </div>
          ))}

          {/* Bar chart */}
          <div style={{ height: '80px', paddingLeft: '16px' }}>
            <Bar data={chartData} options={chartOptions as never} />
          </div>
        </div>
      )}
    </div>
  );
}
