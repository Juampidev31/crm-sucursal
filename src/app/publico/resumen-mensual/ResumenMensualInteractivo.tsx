'use client';

import React, { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement
} from 'chart.js';
import { formatCurrency } from '@/lib/utils';
import { CONFIG } from '@/types';
import { Users, TrendingUp, Shield, Briefcase, FileText, Activity, Target, BarChart3, Tag, PieChart, ChevronDown, ChevronRight } from 'lucide-react';
import AnalisisTemporalTab from '../../ajustes/AnalisisTemporalTab';
import MetricasTab from '../../ajustes/MetricasTab';
import type { AnalisisTemporalState } from '../../ajustes/AnalisisTemporalTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement);

const ModernDoughnut = ({ data, total, label, unit = '', showPercent = false }: { data: any, total: number | string, label: string, unit?: string, showPercent?: boolean }) => {
  const totalNum = typeof total === 'string' ? parseFloat(total) : total;
  const options = {
    cutout: '80%',
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
          label: (context: any) => {
            return `${context.raw}`;
          }
        }
      }
    },
    maintainAspectRatio: false,
    elements: {
      arc: {
        borderWidth: 0,
        borderRadius: 4,
      }
    }
  };

  const displayValue = showPercent && totalNum > 0 ? `${totalNum.toFixed(1)}%` : `${total}${unit}`;

  return (
    <div style={{ position: 'relative', height: '180px', width: '180px', margin: '0 auto' }}>
      <Doughnut data={data} options={options} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
        width: '100%', pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '8px', color: '#555', fontWeight: 800, letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          {displayValue}
        </div>
      </div>
    </div>
  );
};

const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    const isHorizontal = chart.config.options.indexAxis === 'y';
    const isStacked = chart.config.options.scales?.x?.stacked || chart.config.options.scales?.y?.stacked;

    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden || (meta.type !== 'bar' && ds.type !== 'bar')) return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;

      const isPct = chart.config.options?._isPct === true;

      meta.data.forEach((bar: any, idx: number) => {
        const val = ds.data[idx];
        if (val === null || val === undefined || (val === 0 && !isPct)) return;

        let label = '';
        const v = Math.abs(val);

        if (isPct) {
          label = Math.round(val) + '%';
        } else if (v >= 1_000_000) {
          label = (val / 1_000_000).toFixed(1).replace('.', ',') + 'M';
        } else if (v >= 1000) {
          label = (val / 1000).toFixed(0) + 'K';
        } else {
          label = (val < 10 && val > 0 && !Number.isInteger(val)) ? val.toFixed(1).replace('.', ',') : Math.round(val).toString();
        }

        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 6, bar.y);
        } else if (isStacked) {
          ctx.fillText(label, bar.x, bar.y + (bar.base - bar.y) / 2);
        } else {
          ctx.fillText(label, bar.x, bar.y - 7);
        }
      });
      ctx.restore();
    });
  },
};

interface KPITotal {
  capital: number;
  ops: number;
  ticket: number;
  conversion: number;
  clientes: number;
  metaCapital: number;
  metaOps: number;
  cumplCapital: number | null;
  cumplOps: number | null;
  tendCapital: number | null;
  tendOps: number | null;
  tendTicket: number | null;
  tendConversion: number | null;
  tendClientes: number | null;
  restanteCapital: number | null;
  restanteOps: number | null;
  montoVenta?: number;
  montoAprobCC?: number;
}

interface KPIPorAnalista {
  analista: string;
  capital: number;
  ops: number;
  ticket: number;
  conversion: number;
  metaCapital: number;
  metaOps: number;
  cumplCapital: number | null;
  cumplOps: number | null;
  tendCapital: number | null;
  tendOps: number | null;
  clientesIngresados: number;
  restanteCapital: number | null;
  restanteOps: number | null;
  montoVenta?: number;
  montoAprobCC?: number;
  // Projection fields
  esMesActual?: boolean;
  proyeccionCapital?: number | null;
  proyeccionOps?: number | null;
  ventaPorDia?: number | null;
  opsPorDia?: number | null;
  metaDiariaCapital?: number | null;
  metaDiariaOps?: number | null;
  diasHabilesAdmin?: number;
  diasTransAdmin?: number;
  tieneDiasAdmin?: boolean;
}

interface DatosGraficos {
  kpiTotal: KPITotal;
  kpiPorAnalista: KPIPorAnalista[];
  mesActual: string;
  mesAnterior: string;
  year: number;
  month: number;
  experienciaCliente?: string;
  analisisComercial?: string;
  operacionProcesos?: string;
  gestionesRealizadas?: string;
  coordinacionSalidas?: string;
  empresasEstrategicas?: string;
  logros?: string;
  desvios?: string;
  accionesClave?: string;
  dotacion?: string;
  ausentismo?: string;
  capacitacion?: string;
  evaluacionDesempeno?: string;
  planAcciones?: Array<{ problema: string; accion: string; responsable: string; fecha: string }>;
  auditCounts?: Record<string, number>;
  collapsedSections?: Record<number, boolean>;
  registros?: any[];
  chartCapitalVsObjetivo?: any;
  chartTicketPromedio?: any;
  chartVariacion?: any;
  chartEmbudo?: any;
  chartAperturas?: any;
  chartRenovaciones?: any;
  chartEmpleoPublPriv?: any;
  chartConversionTotal?: any;
  chartConversionPresupuesto?: any;
  chartCumplimiento?: any;
  chartAcuerdos?: any;
  distSexo?: Array<{ label: string; monto: number; cantidad: number }>;
  distCuotas?: Array<{ label: string; monto: number; cantidad: number }>;
  distRangoEtario?: Array<{ label: string; monto: number; cantidad: number }>;
  distLocalidad?: Array<{ label: string; monto: number; cantidad: number }>;
  distEmpleador?: Array<{ label: string; monto: number; cantidad: number }>;
  distAcuerdos?: Array<{ label: string; monto: number; cantidad: number }>;
  distEstados?: Array<{ label: string; monto: number; cantidad: number }>;
  distSexoTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distCuotasTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distRangoEtarioTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distLocalidadTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distEmpleadorTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distAcuerdosTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  seccion10State?: AnalisisTemporalState | null;
}

const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false): any => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: horizontal ? 'y' as const : 'x' as const,
  layout: { padding: { top: showLabels ? 50 : 20, bottom: 5, left: 8, right: 8 } },
  _isPct: yLabel.includes('%'),
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      align: 'end' as const,
      labels: { color: '#666', font: { size: 10 }, usePointStyle: true, padding: 10 }
    },
    tooltip: {
      backgroundColor: '#111',
      titleColor: '#fff',
      bodyColor: '#aaa',
      borderColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      enabled: true // Garantizamos que las tooltips estén activas
    },
    datalabels: { display: false } // Usamos nuestro plugin custom
  },
  categoryPercentage: 0.8,
  barPercentage: 0.7,
  scales: {
    x: {
      stacked,
      ticks: { color: '#555', font: { size: 10 }, padding: 8 },
      grid: { color: 'rgba(255,255,255,0.03)' }
    },
    y: {
      stacked,
      ticks: {
        color: '#555',
        font: { size: 10 },
        padding: 8,
        precision: yLabel.includes('ops') || yLabel.includes('reg') ? 0 : undefined,
        callback: function(val: any) {
          const n = Number(val);
          if (isNaN(n)) return val;
          if (yLabel.includes('%')) return n.toFixed(0) + '%';
          if (n >= 1000) return n.toLocaleString('es-AR') + yLabel;
          return n + yLabel;
        }
      },
      grid: { color: 'rgba(255,255,255,0.04)' },
      beginAtZero: true
    },
  },
});

const cumplColor = (pct: number | null) =>
  pct === null ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

const tendBadge = (pct: number | null) => {
  if (pct === null) return <span style={{ color: '#333' }}>—</span>;
  const color = pct >= 0 ? '#34d399' : '#f87171';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ color }}>{pct >= 0 ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(2)}%
      </span>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>vs mes anterior</span>
    </div>
  );
};

const DistBlock = ({ 
  titulo, icon, datos, color, totalMes, maxItems = 5
}: { 
  titulo: string; icon: React.ReactNode; 
  datos: { label: string; monto: number; cantidad: number }[]; 
  color: string; totalMes: number; maxItems?: number;
}) => {
  const [expanded, setExpanded] = useState(false);

  // Separar datos válidos de "No especificado"
  const validData = datos.filter(d => {
    const l = d.label?.trim()?.toLowerCase();
    return l !== 'no especificado' && l !== 'sin dato' && l !== '';
  });
  
  const noEspData = datos.find(d => {
    const l = d.label?.trim()?.toLowerCase();
    return l === 'no especificado' || l === 'sin dato' || l === '';
  });

  const totalCant = validData.reduce((s, d) => s + d.cantidad, 0);
  const displayData = expanded ? validData : validData.slice(0, maxItems);
  const hasMore = validData.length > maxItems;

  return (
    <div style={{ 
      flex: 1, 
      minWidth: 240, 
      maxHeight: expanded ? 'none' : 320, 
      display: 'flex', 
      flexDirection: 'column',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</span>
      </div>
      <div style={{ 
        background: '#0d0d0d', 
        borderRadius: 10, 
        border: '1px solid rgba(255,255,255,0.04)', 
        overflowX: 'hidden', 
        overflowY: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1, 
        maxHeight: expanded ? 'none' : 280,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ flex: 1, overflowX: 'hidden', overflowY: 'hidden' }}>
          {displayData.map((d, i) => {
            const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
            const pctMonto = totalMes > 0 ? (d.monto / totalMes) * 100 : 0;
            return (
              <div key={i} style={{ padding: '9px 14px', borderBottom: i < displayData.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label?.trim()}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#444' }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#aaa', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctMonto}%`, background: color, opacity: 0.6, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Observación de no especificados */}
        {noEspData && noEspData.cantidad > 0 && (
          <div style={{ 
            padding: '8px 14px', 
            background: 'rgba(255,255,255,0.01)', 
            borderTop: '1px solid rgba(255,255,255,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <span style={{ fontSize: 10, color: '#999', fontWeight: 700, fontStyle: 'italic' }}>
              * {noEspData.cantidad} sin especificar
            </span>
            <span style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>{formatCurrency(noEspData.monto)}</span>
          </div>
        )}

        {hasMore && (
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: 'none',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              color: color,
              fontSize: '10px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}
          >
            {expanded ? 'Ver menos' : `Ver todos (${validData.length})`}
            <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
          </button>
        )}
      </div>
    </div>
  );
};

const ManualTextareaView = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 260 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 13, padding: '12px 14px', whiteSpace: 'pre-wrap', minHeight: 72 }}>{value || '—'}</div>
  </div>
);

export default function ResumenMensualInteractivo({ datos }: { datos: DatosGraficos }) {
  const { 
    kpiTotal, kpiPorAnalista, mesActual, mesAnterior, month, year, experienciaCliente, analisisComercial, 
    operacionProcesos, gestionesRealizadas, coordinacionSalidas, empresasEstrategicas, 
    logros, desvios, accionesClave, dotacion, ausentismo, capacitacion, evaluacionDesempeno, 
    planAcciones, auditCounts, collapsedSections, registros, chartCapitalVsObjetivo, chartTicketPromedio, chartVariacion, 
    chartCumplimiento, chartEmbudo, chartAperturas, chartRenovaciones, chartConversionTotal, 
    chartConversionPresupuesto, chartEmpleoPublPriv, chartAcuerdos, distSexo, distCuotas,
    distRangoEtario, distLocalidad, distEmpleador, distAcuerdos, distEstados,
    distSexoTotal, distCuotasTotal, distRangoEtarioTotal, distLocalidadTotal, distEmpleadorTotal, distAcuerdosTotal,
    seccion10State
  } = datos;

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(collapsedSections || { 10: true });
  const [periodoSec3, setPeriodoSec3] = useState<'mensual' | 'total'>('mensual');

  const toggleSection = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.01)',
        userSelect: 'none',
        borderBottom: collapsed[id] ? 'none' : '1px solid rgba(255,255,255,0.05)',
        cursor: 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20 }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#eee', textTransform: 'uppercase', letterSpacing: '1px', flex: 1 }}>{title}</span>
      <div style={{ 
        width: 24, 
        height: 24, 
        borderRadius: '50%', 
        background: 'rgba(255,255,255,0.03)', 
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <ChevronRight size={14} color="#555" />
      </div>
    </div>
  );

  const LegendPill = ({ color, label }: { color: string, label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );


  const tendBadge = (pct: number | null) => {
    if (pct === null) return <span style={{ color: '#333' }}>—</span>;
    const color = pct >= 0 ? '#34d399' : '#f87171';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}18`, padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
          {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
        </span>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>vs mes anterior</span>
      </div>
    );
  };

  const allAnalistas = kpiPorAnalista;
  const totalMes = kpiTotal.capital;
  const ventasCount = kpiTotal.ops;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* SECCIÓN 1: TABLERO */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#60a5fa" />)}
        {!collapsed[1] && (
          <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</div>
                {tendBadge(kpiTotal.tendCapital)}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}</div>
              {kpiTotal.cumplCapital !== null && (
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  <span style={{ color: cumplColor(kpiTotal.cumplCapital), marginRight: 4 }}>●</span>
                  {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                </div>
              )}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>Capital vs Objetivo</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="rgba(96,165,250,0.8)" label={mesActual} />
                    <LegendPill color="rgba(30, 58, 138, 0.9)" label={mesAnterior} />
                  </div>
                </div>
                <div style={{ height: 180 }}>
                  <Bar data={chartCapitalVsObjetivo as any} options={baseChartOpts('$', false, true)} plugins={[labelsPlugin]} />
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Operaciones</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{kpiTotal.ops}</div>
                {tendBadge(kpiTotal.tendOps)}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}</div>
              {kpiTotal.cumplOps !== null && (
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  <span style={{ color: cumplColor(kpiTotal.cumplOps), marginRight: 4 }}>●</span>
                  {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                </div>
              )}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>Aperturas vs Renovaciones</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="#60a5fa" label={mesActual} />
                    <LegendPill color="rgba(30, 58, 138, 0.9)" label={mesAnterior} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' }}>Aperturas</div>
                    <div style={{ height: 160 }}>
                      {chartAperturas && <Bar data={chartAperturas} options={baseChartOpts(' ops', false, true)} plugins={[labelsPlugin]} />}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' }}>Renov.</div>
                    <div style={{ height: 160 }}>
                      {chartRenovaciones && <Bar data={chartRenovaciones} options={baseChartOpts(' ops', false, true)} plugins={[labelsPlugin]} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</div>
                {tendBadge(kpiTotal.tendTicket)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>Conversión: {kpiTotal.conversion.toFixed(1)}%</div>
                {tendBadge(kpiTotal.tendConversion)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 11, color: '#444' }}>{kpiTotal.clientes} clientes ingresados</div>
                {tendBadge(kpiTotal.tendClientes)}
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>Análisis vs {mesAnterior}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="rgba(52,211,153,0.8)" label={mesActual} />
                    <LegendPill color="rgba(6, 78, 59, 0.9)" label={mesAnterior} />
                  </div>
                </div>
                <div style={{ height: 180 }}>
                  <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', false, true)} plugins={[labelsPlugin]} />
                </div>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>


      {/* SECCIÓN 2: VENTAS POR CATEGORÍA */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(2, '2. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}
        {!collapsed[2] && (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#444' }}>{ventasCount} ops · {formatCurrency(totalMes)}</span>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 3 }}>
                {(['mensual', 'total'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodoSec3(p)}
                    style={{
                      padding: '4px 14px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      background: periodoSec3 === p ? '#fb923c' : 'transparent',
                      color: periodoSec3 === p ? '#000' : '#555',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {p === 'mensual' ? 'Mes' : 'Total'}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const isMensual = periodoSec3 === 'mensual';
              const ac = isMensual ? distAcuerdos : distAcuerdosTotal;
              const cu = isMensual ? distCuotas : distCuotasTotal;
              const re = isMensual ? distRangoEtario : distRangoEtarioTotal;
              const sx = isMensual ? distSexo : distSexoTotal;
              const em = isMensual ? distEmpleador : distEmpleadorTotal;
              const lo = isMensual ? distLocalidad : distLocalidadTotal;
              const base = isMensual ? totalMes : (ac ?? cu ?? re ?? sx ?? em ?? lo ?? []).reduce((s: number, d: { monto: number }) => s + d.monto, 0);
              return (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {ac && <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#f97316" />} datos={ac} color="#f97316" totalMes={base} />}
                  {cu && <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={cu} color="#60a5fa" totalMes={base} />}
                  {re && <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={re} color="#34d399" totalMes={base} />}
                  {sx && <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={sx} color="#f472b6" totalMes={base} />}
                  {em && <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={em} color="#fbbf24" totalMes={base} />}
                  {lo && <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={lo} color="#a78bfa" totalMes={base} />}
                </div>
              );
            })()}
          </div>
        )}
      </div>


      {/* SECCIÓN 3: RENDIMIENTO DISTRIBUIDO POR ANALISTA Y TOTAL GENERAL */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(3, '3. Rendimiento distribuido por analista y total general', <PieChart size={15} color="#4ade80" />)}
        {!collapsed[3] && (
          <div style={{ padding: '24px' }}>
            <MetricasTab selectedMes={month} selectedAnio={year} registros={registros} />
          </div>
        )}
      </div>

      {/* SECCIÓN 4: ANÁLISIS COMERCIAL */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(4, '4. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
        {!collapsed[4] && (
          <div style={{ padding: '24px' }}>
            <ManualTextareaView label="Interpretación del Período" value={analisisComercial || ''} />
          </div>
        )}
      </div>

      {/* SECCIÓN 5: OPERACIÓN Y PROCESOS */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(5, '5. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
        {!collapsed[5] && (
          <div style={{ padding: '24px' }}>
            <ManualTextareaView label="Cumplimiento de Procedimientos / Tiempos / Stock" value={operacionProcesos || ''} />
          </div>
        )}
      </div>

      {/* SECCIÓN 6: GESTIÓN COMERCIAL */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(6, '6. Gestión Comercial', <Briefcase size={15} color="#34d399" />)}
        {!collapsed[6] && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ManualTextareaView label="Gestiones Realizadas" value={gestionesRealizadas || ''} />
              <ManualTextareaView label="Coordinación de Salidas" value={coordinacionSalidas || ''} />
              <ManualTextareaView label="Empresas Estratégicas" value={empresasEstrategicas || ''} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
              <ManualTextareaView label="Principales Logros" value={logros || ''} />
              <ManualTextareaView label="Principales Desvíos / Problemas" value={desvios || ''} />
              <ManualTextareaView label="Acciones Clave a Seguir" value={accionesClave || ''} />
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 7: EXPERIENCIA DEL CLIENTE */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(7, '7. Experiencia del Cliente', <FileText size={15} color="#f472b6" />)}
        {!collapsed[7] && (
          <div style={{ padding: '24px' }}>
            <ManualTextareaView label="Reclamos y Satisfacción" value={experienciaCliente || ''} />
          </div>
        )}
      </div>

      {/* SECCIÓN 8: GESTIÓN DEL EQUIPO */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(8, '8. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
        {!collapsed[8] && (
          <div style={{ padding: '24px' }}>
            {auditCounts && Object.keys(auditCounts).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Actividad en Sistema</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(auditCounts).map(([analista, count]) => (
                    <div key={analista} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>{analista}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#aaa' }}>{count}</div>
                      <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>acciones registradas</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ManualTextareaView label="Dotación Actual" value={dotacion || ''} />
              <ManualTextareaView label="Ausentismo / Tardanzas" value={ausentismo || ''} />
              <ManualTextareaView label="Capacitación Realizada" value={capacitacion || ''} />
              <ManualTextareaView label="Evaluación de Desempeño" value={evaluacionDesempeno || ''} />
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 9: PLAN DE ACCIÓN */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(9, '9. Plan de Acción', <Target size={15} color="#fb923c" />)}
        {!collapsed[9] && (
          <div style={{ padding: '24px' }}>
          {planAcciones && planAcciones.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr>
                  {['Problema Detectado', 'Acción Concreta', 'Responsable', 'Fecha Ejecución'].map((h: string) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planAcciones.map((fila: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '6px 8px', color: '#ccc' }}>{fila.problema || '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#ccc' }}>{fila.accion || '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#ccc' }}>{fila.responsable || '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#ccc' }}>{fila.fecha || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ color: '#444', fontSize: 13 }}>—</div>}
          </div>
        )}
      </div>

      {/* SECCIÓN 10: RENDIMIENTO Y TENDENCIAS */}
      <div className="data-card" style={{ background: '#0a0a0a', padding: 0, overflow: 'hidden' }}>
        {sectionHeader(10, '10. Rendimiento y Tendencias', <BarChart3 size={15} color="#60a5fa" />)}
        {!collapsed[10] && (
          <div style={{ padding: '24px' }}>
            {registros && registros.length > 0 ? (
              <AnalisisTemporalTab registros={registros} isPublic={true} initialMonth={month} initialYear={year} initialState={seccion10State ?? undefined} />
            ) : (
              <div style={{ color: '#444', fontSize: 13, fontStyle: 'italic' }}>
                No hay datos históricos disponibles para este período.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}