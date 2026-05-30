import React, { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { BarChart3, Users } from 'lucide-react';
import { CONFIG } from '@/types';
import { calloutPlugin, bgTrackPlugin, glowPlugin } from '@/lib/chartPlugins';

const filterByMonth = (regs: any[], mes: number, anio: number) => {
  const key = `${anio}-${String(mes).padStart(2, '0')}`;
  return regs.filter(r => r.fecha?.slice(0, 7) === key);
};

const isVenta = (r: any) => {
  const e = (r.estado ?? '').toLowerCase();
  return e === 'venta' || e.includes('aprobado cc');
};

const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (meta.hidden) return;
      meta.data.forEach((element: any, index: number) => {
        const val = ds.data[index];
        if (!val) return;
        const isPct = chart.config.options?._isPct === true;
        const text = isPct ? `${val.toFixed(0)}%` : val.toString();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, element.x, element.y - 6);
      });
    });
  }
};

const referenceLinesPlugin: any = {
  id: 'referenceLinesPlugin',
  beforeDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    const yAxis = scales.y;
    if (!yAxis) return;
    const isPct = chart.config.options?._isPct === true;
    if (isPct) {
      const y100 = yAxis.getPixelForValue(100);
      if (y100 >= chartArea.top && y100 <= chartArea.bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(chartArea.left, y100);
        ctx.lineTo(chartArea.right, y100);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.stroke();
        ctx.restore();
      }
    }
  }
};

export const ModernDoughnut = ({ data, total, label, unit = '', showPercent = false }: { data: any, total: number | string, label: string, unit?: string, showPercent?: boolean }) => {
  const options = {
    layout: { padding: 30 },
    cutout: '88%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111',
        titleColor: '#fff',
        bodyColor: '#ccc',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            if (showPercent && typeof total === 'number' && total > 0) {
              return ` ${ctx.label}: ${val}${unit} (${((val / total) * 100).toFixed(1)}%)`;
            }
            return ` ${ctx.label}: ${val}${unit}`;
          }
        }
      }
    },
    maintainAspectRatio: false,
    elements: {
      arc: {
        borderWidth: 0,
        borderRadius: 30,
      }
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', margin: '0 auto' }}>
      <Doughnut data={data} options={options} plugins={[calloutPlugin, bgTrackPlugin, glowPlugin]} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
        width: '100%', pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '10px', color: '#555', fontWeight: 800, letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          {total}<span style={{ fontSize: '12px', color: '#888', fontWeight: 700, marginLeft: '2px' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
};

export default function SeccionGraficosResumen({
  kpiTotal, selectedMes, selectedAnio, allRegistros
}: {
  kpiTotal: any, selectedMes: number, selectedAnio: number, allRegistros: any[]
}) {
  const mesPrev = selectedMes === 1 ? 12 : selectedMes - 1;
  const anioPrev = selectedMes === 1 ? selectedAnio - 1 : selectedAnio;
  
  const mesActualLabel = CONFIG.MESES_NOMBRES[selectedMes - 1];
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1];

  const baseChartOpts = (yLabel = '', isPct = false): any => ({
    responsive: true,
    maintainAspectRatio: false,
    _isPct: isPct,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9, weight: '700' } }, border: { display: false } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#666', font: { size: 9 }, callback: (v: any) => v + yLabel }, border: { display: false } }
    }
  });

  const getGradient = (context: any, color1: string, color2: string) => {
    const chart = context.chart;
    const { ctx, chartArea } = chart;
    if (!chartArea) return null;
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  };

  const chartCumplimiento = useMemo(() => {
    return {
      labels: [''],
      datasets: [
        { label: `Capital ${mesActualLabel}`, data: [kpiTotal.cumplCapital || 0], backgroundColor: (c: any) => getGradient(c, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'), borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
        { label: `Capital ${mesAntLabel}`, data: [kpiTotal.cumplCapitalAnt || 0], backgroundColor: (c: any) => getGradient(c, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'), borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
        { label: `Ops ${mesActualLabel}`, data: [kpiTotal.cumplOps || 0], backgroundColor: (c: any) => getGradient(c, 'rgba(6, 182, 212, 0.05)', 'rgba(6, 182, 212, 0.85)'), borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
        { label: `Ops ${mesAntLabel}`, data: [kpiTotal.cumplOpsAnt || 0], backgroundColor: (c: any) => getGradient(c, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'), borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
      ],
    };
  }, [kpiTotal, mesActualLabel, mesAntLabel]);

  const chartVariacion = useMemo(() => {
    return {
      labels: [''],
      datasets: [
        { 
          label: 'Variación Capital %', 
          data: [kpiTotal.tendCapital ?? 0], 
          backgroundColor: (kpiTotal.tendCapital >= 0) ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', 
          borderColor: (kpiTotal.tendCapital >= 0) ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)', 
          borderWidth: 1.5, borderRadius: 4, maxBarThickness: 100 
        },
        { 
          label: 'Variación Ops %', 
          data: [kpiTotal.tendOps ?? 0], 
          backgroundColor: (kpiTotal.tendOps >= 0) ? 'rgba(167,139,250,0.15)' : 'rgba(248,113,113,0.15)', 
          borderColor: (kpiTotal.tendOps >= 0) ? 'rgba(167,139,250,0.5)' : 'rgba(248,113,113,0.5)', 
          borderWidth: 1.5, borderRadius: 4, maxBarThickness: 100 
        },
      ],
    };
  }, [kpiTotal]);

  const { chartAcuerdosData, chartAcuerdosTotal } = useMemo(() => {
    const sourceRegs = filterByMonth(allRegistros, selectedMes, selectedAnio).filter(isVenta);
    const categories = ['PREMIUM', 'Riesgo MEDIO', 'Riesgo BAJO', 'No califica'];
    const displayData = categories.map(cat => {
      return sourceRegs.filter(r => {
          const ac = (r.acuerdo_precios || '').toLowerCase();
          if (cat === 'PREMIUM') return ac.includes('premium');
          if (cat === 'Riesgo MEDIO') return ac.includes('medio');
          if (cat === 'Riesgo BAJO') return ac.includes('bajo');
          if (cat === 'No califica') return ac.includes('no califica') || ac === 'n/c';
          return false;
      }).length;
    });
    return {
      chartAcuerdosData: {
        labels: categories,
        datasets: [{
          data: displayData,
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
          borderWidth: 0, hoverOffset: 10, borderRadius: 4, spacing: 4
        }]
      },
      chartAcuerdosTotal: displayData.reduce((a, b) => a + b, 0)
    };
  }, [allRegistros, selectedMes, selectedAnio]);

  const { chartEmpleoData, chartEmpleoTotal } = useMemo(() => {
    const PUBLICO = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const ventas = filterByMonth(allRegistros, selectedMes, selectedAnio).filter(isVenta);
    const classify = (r: any) => {
      const e = (r.empleador ?? '').toLowerCase();
      return PUBLICO.some(k => e.includes(k)) ? 'Público' : e.trim() === '' || e === 'sin dato' ? 'No especificado' : 'Privado';
    };
    const counts: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    ventas.forEach(r => counts[classify(r)]++);
    
    const labels = ['Público', 'Privado', 'Sin dato'];
    const filtered = labels.filter(l => (counts[l] ?? 0) > 0);
    
    return {
      chartEmpleoData: {
        labels: filtered,
        datasets: [{
          data: filtered.map(l => counts[l] ?? 0),
          backgroundColor: filtered.map(l => l === 'Público' ? '#10b981' : l === 'Privado' ? '#3b82f6' : 'rgba(100,100,100,0.5)'),
          borderWidth: 0, hoverOffset: 10, borderRadius: 4, spacing: 4
        }],
      },
      chartEmpleoTotal: filtered.reduce((a, b) => a + (counts[b] ?? 0), 0)
    };
  }, [allRegistros, selectedMes, selectedAnio]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* 1. Cumplimiento */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>% Cumplimiento — Actual vs {mesAntLabel}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(96,165,250,0.8)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{mesActualLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{mesAntLabel}</span>
              </div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar data={chartCumplimiento as any} options={baseChartOpts('%', true)} plugins={[labelsPlugin, referenceLinesPlugin]} />
          </div>
        </div>

        {/* 2. Variación */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Variación % vs {mesAntLabel}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.7)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Capital</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(167,139,250,0.7)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Operaciones</span>
              </div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar data={chartVariacion as any} options={baseChartOpts('%', true)} plugins={[labelsPlugin, referenceLinesPlugin]} />
          </div>
        </div>

        {/* 3. Acuerdos */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
              Distribución de Acuerdos
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <Users size={12} color="#666" />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#666' }}>
                  {kpiTotal.ops} TOTAL
                </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ height: 200, width: '100%', margin: 'auto 0' }}>
              <ModernDoughnut data={chartAcuerdosData} total={chartAcuerdosTotal} label="Acuerdos" unit=" Ops" />
            </div>
            <div style={{ paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {chartAcuerdosData.labels.map((l, i) => {
                const val = chartAcuerdosData.datasets[0].data[i] as number;
                const pct = chartAcuerdosTotal > 0 ? (val / chartAcuerdosTotal * 100).toFixed(1) : '0';
                return (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: chartAcuerdosData.datasets[0].backgroundColor[i] }} />
                    <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{l} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Empleo */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{ width: 3, height: 12, background: '#34d399', borderRadius: 2 }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
              % Empleo Público / Privado
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ height: 200, width: '100%', margin: 'auto 0' }}>
              <ModernDoughnut data={chartEmpleoData} total={chartEmpleoTotal} label="Total" unit=" Ops" />
            </div>
            <div style={{ paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {chartEmpleoData.labels.map((l, i) => {
                const val = chartEmpleoData.datasets[0].data[i] as number;
                const pct = chartEmpleoTotal > 0 ? (val / chartEmpleoTotal * 100).toFixed(1) : '0';
                return (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: chartEmpleoData.datasets[0].backgroundColor[i] }} />
                    <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{l} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
