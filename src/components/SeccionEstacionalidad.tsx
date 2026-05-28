'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const VERDE = '#34d399';
const ROJO = '#f87171';

interface Props {
  filtroMes: string;      // "YYYY-MM"
  filtroAnalista?: string; // "" = todos
}

export function SeccionEstacionalidad({ filtroMes, filtroAnalista }: Props) {
  const { registros, loading } = useRegistros();
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
        s.positivo ? 'rgba(52, 211, 153, 0.85)' : 'rgba(248, 113, 113, 0.75)'
      ),
      borderRadius: 5,
      borderSkipped: false as const,
    }],
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => ` ${formatCurrency(ctx.raw as number)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#8f929d', font: { size: 10, weight: 600 } },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: {
          color: '#8f929d',
          font: { size: 10, weight: 600 },
          maxTicksLimit: 5,
          callback: (v: string | number) => {
            const num = Number(v);
            if (num >= 1000000) {
              return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
            }
            if (num >= 1000) {
              return (num / 1000).toFixed(0) + 'k';
            }
            return v;
          },
        },
        grid: { color: 'rgba(255,255,255,0.025)' },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{
      background: '#0c0c0c',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div style={{
            fontSize: '11px',
            color: '#8f929d',
            fontWeight: 800,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}>
            Evolución Semanal
          </div>
        </div>

        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#8f929d',
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
          padding: '24px',
          alignItems: 'center',
        }}>
          {semanas.map(s => (
            <div key={s.label} style={{ padding: '0 24px 0 12px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{
                fontSize: '10px',
                color: '#64748b',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '6px',
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
                marginBottom: '6px',
                lineHeight: 1.1,
              }}>
                {formatCurrency(s.monto)}
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                color: s.positivo ? VERDE : ROJO,
              }}>
                {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}% vs promedio
              </div>
            </div>
          ))}

          {/* Bar chart */}
          <div style={{ height: '80px', paddingLeft: '16px' }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
