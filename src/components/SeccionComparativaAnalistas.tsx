'use client';

import React, { useMemo, useState } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { formatCurrency } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface Props {
  filtroMes: string; // "YYYY-MM"
}

export function SeccionComparativaAnalistas({ filtroMes }: Props) {
  const { registros, loading } = useRegistros();
  const [vista, setVista] = useState<'diario' | 'semanal'>('diario');
  const [showVictoria, setShowVictoria] = useState(true);

  // Parse Year and Month
  const { year, month } = useMemo(() => {
    if (!filtroMes) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    const parts = filtroMes.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
    };
  }, [filtroMes]);

  const numDays = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // Compute Sales data
  const dataPoints = useMemo(() => {
    const defaultLabels: string[] = [];
    if (vista === 'diario') {
      for (let i = 1; i <= numDays; i++) {
        defaultLabels.push(`Día ${i}`);
      }
    } else {
      defaultLabels.push('Semana 1', 'Semana 2', 'Semana 3', 'Semana 4');
    }

    const ventas = registros.filter(r => {
      const estado = r.estado?.toLowerCase() || '';
      if (!(estado === 'venta' || estado.includes('aprobado cc'))) return false;
      if (!r.fecha) return false;
      if (r.fecha.slice(0, 7) !== filtroMes) return false;
      return true;
    });

    const lSales = new Array(vista === 'diario' ? numDays : 4).fill(0);
    const vSales = new Array(vista === 'diario' ? numDays : 4).fill(0);

    for (const r of ventas) {
      const match = r.fecha!.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) continue;
      const dia = parseInt(match[3], 10);
      
      const idx = vista === 'diario'
        ? dia - 1
        : dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3;

      if (idx >= 0 && idx < lSales.length) {
        if (r.analista === 'Luciana') {
          lSales[idx] += Number(r.monto) || 0;
        } else if (r.analista === 'Victoria') {
          vSales[idx] += Number(r.monto) || 0;
        }
      }
    }

    // Cumulative Sum
    const lCumulative: number[] = [];
    const vCumulative: number[] = [];
    let sumL = 0;
    let sumV = 0;

    for (let i = 0; i < lSales.length; i++) {
      sumL += lSales[i];
      lCumulative.push(sumL);
      sumV += vSales[i];
      vCumulative.push(sumV);
    }

    return {
      labels: defaultLabels,
      luciana: lCumulative,
      victoria: vCumulative,
    };
  }, [registros, filtroMes, vista, numDays]);

  const chartData = {
    labels: dataPoints.labels,
    datasets: [
      {
        label: 'Luciana',
        data: dataPoints.luciana,
        borderColor: '#34d399',
        borderWidth: 2.5,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#34d399',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
          gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');
          return gradient;
        },
      },
      ...(showVictoria
        ? [
            {
              label: 'Victoria',
              data: dataPoints.victoria,
              borderColor: '#06b6d4',
              borderWidth: 2.5,
              borderDash: [6, 4],
              tension: 0.35,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointBackgroundColor: '#06b6d4',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              fill: true,
              backgroundColor: (context: any) => {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return null;
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, 'rgba(6, 182, 212, 0.20)');
                gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
                return gradient;
              },
            },
          ]
        : []),
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    hover: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false, // We render a custom HTML legend below
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#0c0d0f',
        titleColor: '#8f929d',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 12, family: 'inherit' },
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const val = context.parsed.y;
            return ` ${label}: ${formatCurrency(val)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#55565e',
          font: { size: 10, weight: 600 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: vista === 'diario' ? 8 : 4,
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: {
          color: '#55565e',
          font: { size: 10, weight: 600 },
          maxTicksLimit: 5,
          callback: (v) => {
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
      padding: '24px',
      marginBottom: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>
            Comparación de Ventas Acumuladas
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: 600 }}>
            Luciana vs Victoria
          </p>
        </div>

        {/* Dropdown Selector */}
        <div style={{ position: 'relative' }}>
          <select
            value={vista}
            onChange={(e) => setVista(e.target.value as any)}
            style={{
              appearance: 'none',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              padding: '6px 32px 6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#fff',
              outline: 'none',
              cursor: 'pointer',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238f929d' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            <option value="diario" style={{ background: '#0c0c0c' }}>Diario</option>
            <option value="semanal" style={{ background: '#0c0c0c' }}>Semanal</option>
          </select>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: '240px', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>

      {/* Footer Legend and Switch */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
        {/* Custom Legend */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
            Luciana
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', border: '2px dashed #06b6d4', boxSizing: 'border-box' }} />
            Victoria
          </div>
        </div>

        {/* Switch Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Mostrar Victoria
          </span>
          <button
            onClick={() => setShowVictoria(!showVictoria)}
            style={{
              position: 'relative',
              width: '38px',
              height: '20px',
              borderRadius: '20px',
              background: showVictoria ? '#06b6d4' : 'rgba(255,255,255,0.06)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              padding: 0,
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: showVictoria ? '20px' : '2px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}
