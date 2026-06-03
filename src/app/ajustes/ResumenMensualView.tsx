'use client';

import React, { useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement
} from 'chart.js';
import { CONFIG } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, Briefcase, PieChart, Tag, ChevronDown } from 'lucide-react';
import { calloutPlugin, bgTrackPlugin, glowPlugin } from '@/lib/chartPlugins';
import AnalisisTemporalTab from './AnalisisTemporalTab';
import MetricasTab from './MetricasTab';
import NuevaSeccionSheets from '@/app/analistas/NuevaSeccionSheets';
import SeccionGraficosResumen from './SeccionGraficosResumen';
import type { AnalisisTemporalState } from './AnalisisTemporalTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement);

// ── Plugin inline: data labels on bars ───────────────────────────────────
const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    const isHorizontal = chart.config.options.indexAxis === 'y';
    const isStacked = chart.config.options.scales?.x?.stacked || chart.config.options.scales?.y?.stacked;

    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden || meta.type !== 'bar') return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';

      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;

      const isPct = chart.config.options?._isPct === true;

      meta.data.forEach((bar: any, idx: number) => {
        const val = ds.data[idx];
        if (val === null || val === undefined || (val === 0 && !isPct)) return;

        let label = '';
        const v = Math.abs(val);

        if (isPct) {
          label = Math.round(val) + '%';
        } else if (v >= 1000) {
          label = Math.round(val).toLocaleString('es-AR');
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

const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false): any => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: horizontal ? 'y' as const : 'x' as const,
  layout: { padding: { top: showLabels ? 50 : 20, bottom: 0 } },
  _isPct: yLabel.includes('%'),
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      align: 'end' as const,
      labels: { color: '#666', font: { size: 10 }, usePointStyle: true, padding: 10 }
    },
    tooltip: { backgroundColor: '#111', titleColor: '#fff', bodyColor: '#aaa', borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 },
    datalabels: {
      display: showLabels,
      align: stacked ? 'center' as const : 'top' as const,
      anchor: stacked ? 'center' as const : 'end' as const,
      offset: stacked ? 0 : 12,
      color: '#fff',
      formatter: (v: any) => {
        if (v === 0 || v === undefined || v === null) return '';
        const n = Number(v);
        if (isNaN(n)) return v;
        if (yLabel.includes('%')) return n.toFixed(0) + '%';
        if (yLabel.includes('ops') || yLabel.includes('reg')) return n;
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n;
      },
      font: { size: 10, weight: 800 }
    },
  },
  categoryPercentage: 0.85,
  barPercentage: 0.9,
  scales: {
    x: {
      stacked,
      ticks: {
        color: '#555', font: { size: 10 },
        maxRotation: 0, minRotation: 0, padding: 0, autoSkip: false,
        callback: function (this: any, val: any) {
          let label = this.getLabelForValue(val);
          if (label === undefined) label = val;
          if (horizontal) {
            const n = Number(label);
            if (isNaN(n)) return label;
            return (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n) + yLabel;
          }
          return label;
        }
      },
      grid: { display: false }, border: { display: false }
    },
    y: {
      stacked,
      ticks: {
        color: '#555', font: { size: 10 },
        precision: yLabel.includes('ops') || yLabel.includes('reg') ? 0 : undefined,
        callback: function (this: any, val: any) {
          const n = Number(val);
          if (isNaN(n)) return val;
          if (horizontal) return val;
          if (yLabel.includes('%')) return n.toFixed(0) + '%';
          if (n >= 1000) return n.toLocaleString('es-AR') + yLabel;
          return n + yLabel;
        }
      },
      grid: { display: false }, border: { display: false }, beginAtZero: true,
    },
  },
});

const cumplColor = (pct: number | null) =>
  pct === null ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#ff3366';

const tendBadge = (pct: number | null, showLabel = true) => {
  if (pct === null) return <span style={{ color: '#333' }}>—</span>;
  const color = pct >= 0 ? '#34d399' : '#ff3366';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {showLabel && <span style={{ fontSize: 9, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>vs mes anterior</span>}
      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, minWidth: '60px', justifyContent: 'center' }}>
        <span style={{ color }}>{pct >= 0 ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(2)}%
      </span>
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
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>{titulo}</span>
      </div>
      <div style={{
        background: '#111111',
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
              <div key={i} style={{ padding: '9px 14px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label?.trim()}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#444' }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#aaa', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right' as const }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctMonto}%`, background: color, opacity: 0.6, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>

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
              letterSpacing: '1.5px',
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

const ManualTextarea = ({ label, value, onChange, placeholder, readOnly }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 260 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
    {readOnly ? (
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, color: value ? '#ccc' : '#333', fontFamily: "'Outfit', sans-serif", fontSize: 13,
        padding: '12px 14px', minHeight: 88, width: '100%', boxSizing: 'border-box' as const,
        whiteSpace: 'pre-wrap', lineHeight: 1.5
      }}>
        {value || placeholder || '—'}
      </div>
    ) : (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? `${label}...`}
        rows={4}
        style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 13,
          padding: '12px 14px', resize: 'vertical', outline: 'none',
          width: '100%', boxSizing: 'border-box' as const,
        }}
      />
    )}
  </div>
);

interface PlanAccion {
  problema: string;
  accion: string;
  responsable: string;
  fecha: string;
}

interface ResumenTextos {
  logros: string;
  desvios: string;
  acciones_clave: string;
  gestiones_realizadas: string;
  coordinacion_salidas: string;
  empresas_estrategicas: string;
  analisis_comercial: string;
  dotacion: string;
  ausentismo: string;
  capacitacion: string;
  evaluacion_desempeno: string;
  operacion_procesos: string;
  experiencia_cliente: string;
  plan_acciones: PlanAccion[];
}

type DistItem = { label: string; monto: number; cantidad: number };

export interface ResumenMensualViewProps {
  readOnly?: boolean;
  // periodo
  selectedMes: number;
  selectedAnio: number;
  mesPrev: number;
  mesAntLabel: string;
  // colapsado
  collapsedSections: Record<number, boolean>;
  toggleSection: (id: number) => void;
  // KPIs / charts (pre-calculados)
  kpiTotal: any;
  chartCapitalVsObjetivo: any;
  chartAperturas: any;
  chartRenovaciones: any;
  chartTicketPromedio: any;
  // registros "safe" para sub-componentes
  registros: any[];
  ventasMes: any[];
  auditoriaData: { analista: string }[];
  // distribuciones
  periodoSec3: 'mensual' | 'total';
  setPeriodoSec3: (p: 'mensual' | 'total') => void;
  distAcuerdos: DistItem[]; distAcuerdosTotal: DistItem[];
  distCuotas: DistItem[]; distCuotasTotal: DistItem[];
  distRangoEtario: DistItem[]; distRangoEtarioTotal: DistItem[];
  distSexo: DistItem[]; distSexoTotal: DistItem[];
  distEmpleador: DistItem[]; distEmpleadorTotal: DistItem[];
  distLocalidad: DistItem[]; distLocalidadTotal: DistItem[];
  // textos del resumen
  resumen: ResumenTextos;
  setResumen: React.Dispatch<React.SetStateAction<any>>;
  // sección 10
  setSeccion10State: (s: AnalisisTemporalState | null) => void;
}

export default function ResumenMensualView(props: ResumenMensualViewProps) {
  const {
    readOnly = false,
    selectedMes, selectedAnio, mesPrev, mesAntLabel,
    collapsedSections, toggleSection,
    kpiTotal, chartCapitalVsObjetivo, chartAperturas, chartRenovaciones, chartTicketPromedio,
    registros, ventasMes, auditoriaData,
    periodoSec3, setPeriodoSec3,
    distAcuerdos, distAcuerdosTotal, distCuotas, distCuotasTotal,
    distRangoEtario, distRangoEtarioTotal, distSexo, distSexoTotal,
    distEmpleador, distEmpleadorTotal, distLocalidad, distLocalidadTotal,
    resumen, setResumen, setSeccion10State,
  } = props;

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => {
    const isCollapsed = !!collapsedSections[id];
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isCollapsed ? 0 : 16,
        paddingBottom: 10,
        borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{title}</span>
        </div>
        {!readOnly && (
          <button
            onClick={() => toggleSection(id)}
            style={{
              background: isCollapsed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isCollapsed ? '#555' : '#fff',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isCollapsed ? 'none' : '0 0 15px rgba(255,255,255,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isCollapsed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = isCollapsed ? '#555' : '#fff';
            }}
          >
            <ChevronDown size={14} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="resumen-reporte-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: '100%' }}>
      {/* ── SECCIÓN 1: TABLERO ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column', width: '100%' }}>
        {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#00d4ff" />)}
        {!collapsedSections[1] && (
          <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24, padding: '24px 32px 0 32px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</div>
                {tendBadge(kpiTotal.tendCapital)}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}
              </div>
              {kpiTotal.cumplCapital !== null && (
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  <span style={{ color: cumplColor(kpiTotal.cumplCapital), marginRight: 4 }}>●</span>
                  {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                </div>
              )}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Capital vs Objetivo</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(96,165,250,0.8)' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                    </div>
                  </div>
                </div>
                <div id="chart-capital-objetivo" style={{ height: 200, position: 'relative', width: '100%' }}>
                  <Bar data={chartCapitalVsObjetivo as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin]} />
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Operaciones</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{kpiTotal.ops}</div>
                {tendBadge(kpiTotal.tendOps)}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}
              </div>
              {kpiTotal.cumplOps !== null && (
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  <span style={{ color: cumplColor(kpiTotal.cumplOps), marginRight: 4 }}>●</span>
                  {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                </div>
              )}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Aperturas vs Renovaciones</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#00d4ff', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Aperturas</div>
                    <div id="chart-aperturas" style={{ height: 200, position: 'relative', width: '100%' }}>
                      <Bar data={chartAperturas} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                    </div>
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Renov.</div>
                    <div id="chart-renovaciones" style={{ height: 200, position: 'relative', width: '100%' }}>
                      <Bar data={chartRenovaciones} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</div>
                {tendBadge(kpiTotal.tendTicket)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }} title="Ventas sobre clientes ingresados en el mes (cohorte)">Conversión: {(kpiTotal.conversionGlobal ?? 0).toFixed(1)}%</div>
                {tendBadge(kpiTotal.tendConversionGlobal, false)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }} title="Ventas sobre casos decididos (excluye leads aún abiertos)">Tasa de cierre: {kpiTotal.conversion.toFixed(1)}%</div>
                {tendBadge(kpiTotal.tendConversion, false)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 11, color: '#444' }}>{kpiTotal.clientes} clientes ingresados</div>
                {tendBadge(kpiTotal.tendClientes, false)}
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Análisis vs {mesAntLabel}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.8)' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(6, 78, 59, 0.9)' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                    </div>
                  </div>
                </div>
                <div id="chart-ticket-promedio" style={{ height: 200, position: 'relative', width: '100%' }}>
                  <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin]} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '0 32px 0 32px' }}>
            {/* ── SECCIÓN GRÁFICOS ── */}
            <SeccionGraficosResumen
              kpiTotal={kpiTotal}
              selectedMes={selectedMes}
              selectedAnio={selectedAnio}
              allRegistros={registros}
            />
          </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN 2: VENTAS POR CATEGORÍA ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          <div style={{ flex: 1 }}>{sectionHeader(2, '2. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}</div>
          {!collapsedSections[2] && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>
                {periodoSec3 === 'mensual'
                  ? (() => {
                      const isVentaLocal = (r: any) => {
                        const e = (r.estado || '').toLowerCase().trim();
                        return e === 'venta' || e.includes('aprobado cc') || e.includes('derivado');
                      };
                      const v = ventasMes.filter(isVentaLocal);
                      return `MES: Solo Venta y Aprob. CC (${v.length} ops · ${formatCurrency(v.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`;
                    })()
                  : `TOTAL: Todos los estados (${registros.length} ops · ${formatCurrency(registros.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`}
              </span>
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
          )}
        </div>
        {!collapsedSections[2] && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            {(() => {
              const isMensual = periodoSec3 === 'mensual';
              const fuente = isMensual ? ventasMes : registros;
              const base = fuente.reduce((s, r) => s + (Number(r.monto) || 0), 0);
              const ac = isMensual ? distAcuerdos : distAcuerdosTotal;
              const cu = isMensual ? distCuotas : distCuotasTotal;
              const re = isMensual ? distRangoEtario : distRangoEtarioTotal;
              const sx = isMensual ? distSexo : distSexoTotal;
              const em = isMensual ? distEmpleador : distEmpleadorTotal;
              const lo = isMensual ? distLocalidad : distLocalidadTotal;
              return (
                <>
                  <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#ffaa00" />} datos={ac} color="#ffaa00" totalMes={base} />
                  <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#00d4ff" />} datos={cu} color="#00d4ff" totalMes={base} />
                  <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={re} color="#34d399" totalMes={base} />
                  <DistBlock titulo="Sexo" icon={<Users size={12} color="#b266ff" />} datos={sx} color="#b266ff" totalMes={base} />
                  <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={em} color="#fbbf24" totalMes={base} />
                  <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={lo} color="#a78bfa" totalMes={base} />
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── SECCIÓN 3: DISTRIBUCIÓN POR ESTADO Y CATEGORÍAS ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column', width: '100%' }}>
        {sectionHeader(3, '3. Distribución por estado y categorías', <PieChart size={15} color="#00ff88" />)}
        {!collapsedSections[3] && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', padding: '0 24px 24px 24px' }}>
            <MetricasTab selectedMes={selectedMes} selectedAnio={selectedAnio} registros={registros} analista="PDV" />
            <NuevaSeccionSheets analista="PDV" />
          </div>
        )}
      </div>

      {/* ── SECCIÓN 4: ANÁLISIS COMERCIAL ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column', width: '100%' }}>
        {sectionHeader(4, '4. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
        {!collapsedSections[4] && (
          <ManualTextarea
            label="Interpretación del Período"
            value={resumen.analisis_comercial}
            onChange={v => setResumen((p: any) => ({ ...p, analisis_comercial: v }))}
            placeholder="¿Por qué se vendió más o menos? Impacto de campañas, comportamiento del cliente, factores externos..."
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── SECCIÓN 5: OPERACIÓN Y PROCESOS ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column' }}>
        {sectionHeader(5, '5. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
        {!collapsedSections[5] && (
          <ManualTextarea
            label="Cumplimiento de Procedimientos / Tiempos / Stock"
            value={resumen.operacion_procesos}
            onChange={v => setResumen((p: any) => ({ ...p, operacion_procesos: v }))}
            placeholder="Cumplimiento de procedimientos, tiempos de atención, stock de merchandising y flyers..."
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── SECCIÓN 6: GESTIÓN COMERCIAL ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column' }}>
        {sectionHeader(6, '6. Gestión Comercial', <Briefcase size={15} color="#34d399" />)}
        {!collapsedSections[6] && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ManualTextarea label="Gestiones Realizadas" value={resumen.gestiones_realizadas} onChange={v => setResumen((p: any) => ({ ...p, gestiones_realizadas: v }))} placeholder="Visitas, llamados, coordinaciones del período..." readOnly={readOnly} />
              <ManualTextarea label="Coordinación de Salidas" value={resumen.coordinacion_salidas} onChange={v => setResumen((p: any) => ({ ...p, coordinacion_salidas: v }))} placeholder="Salidas al campo, visitas programadas..." readOnly={readOnly} />
              <ManualTextarea label="Empresas Estratégicas" value={resumen.empresas_estrategicas} onChange={v => setResumen((p: any) => ({ ...p, empresas_estrategicas: v }))} placeholder="Empresas clave contactadas o visitadas..." readOnly={readOnly} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
              <ManualTextarea label="Principales Logros" value={resumen.logros} onChange={v => setResumen((p: any) => ({ ...p, logros: v }))} placeholder="Describí los principales logros del período..." readOnly={readOnly} />
              <ManualTextarea label="Principales Desvíos / Problemas" value={resumen.desvios} onChange={v => setResumen((p: any) => ({ ...p, desvios: v }))} placeholder="Describí los desvíos o problemas detectados..." readOnly={readOnly} />
              <ManualTextarea label="Acciones Clave a Seguir" value={resumen.acciones_clave} onChange={v => setResumen((p: any) => ({ ...p, acciones_clave: v }))} placeholder="Acciones prioritarias para el próximo período..." readOnly={readOnly} />
            </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN 7: EXPERIENCIA DEL CLIENTE ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column' }}>
        {sectionHeader(7, '7. Experiencia del Cliente', <FileText size={15} color="#b266ff" />)}
        {!collapsedSections[7] && (
          <ManualTextarea
            label="Reclamos y Satisfacción"
            value={resumen.experiencia_cliente}
            onChange={v => setResumen((p: any) => ({ ...p, experiencia_cliente: v }))}
            placeholder="Cantidad y tipo de reclamos, nivel de satisfacción, problemas recurrentes..."
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── SECCIÓN 8: GESTIÓN DEL EQUIPO ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column' }}>
        {sectionHeader(8, '8. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
        {!collapsedSections[8] && (
          <>
            {auditoriaData.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Actividad en Sistema</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {CONFIG.ANALISTAS_DEFAULT.map(analista => {
                    const count = auditoriaData.filter(a => a.analista === analista).length;
                    return (
                      <div key={analista} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{analista}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#aaa' }}>{count}</div>
                        <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>acciones registradas</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ManualTextarea label="Dotación Actual" value={resumen.dotacion} onChange={v => setResumen((p: any) => ({ ...p, dotacion: v }))} readOnly={readOnly} />
              <ManualTextarea label="Ausentismo / Tardanzas" value={resumen.ausentismo} onChange={v => setResumen((p: any) => ({ ...p, ausentismo: v }))} readOnly={readOnly} />
              <ManualTextarea label="Capacitación Realizada" value={resumen.capacitacion} onChange={v => setResumen((p: any) => ({ ...p, capacitacion: v }))} readOnly={readOnly} />
              <ManualTextarea label="Evaluación de Desempeño" value={resumen.evaluacion_desempeno} onChange={v => setResumen((p: any) => ({ ...p, evaluacion_desempeno: v }))} readOnly={readOnly} />
            </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN 9: PLAN DE ACCIÓN ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column' }}>
        {sectionHeader(9, '9. Plan de Acción', <Target size={15} color="#fb923c" />)}
        {!collapsedSections[9] && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr>
                  {['Problema Detectado', 'Acción Concreta', 'Responsable', 'Fecha Ejecución', ...(readOnly ? [] : [''])].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.plan_acciones.map((fila, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {(['problema', 'accion', 'responsable'] as const).map(campo => (
                      <td key={campo} style={{ padding: '6px 8px' }}>
                        {readOnly ? (
                          <div style={{ color: '#ccc', fontSize: 12, padding: '7px 10px' }}>{fila[campo] || '—'}</div>
                        ) : (
                          <input
                            value={fila[campo]}
                            onChange={e => {
                              const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, [campo]: e.target.value } : f);
                              setResumen((p: any) => ({ ...p, plan_acciones: updated }));
                            }}
                            placeholder={campo === 'problema' ? 'Describí el problema...' : campo === 'accion' ? 'Acción concreta...' : 'Responsable'}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 12, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' as const }}
                          />
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '6px 8px' }}>
                      {readOnly ? (
                        <div style={{ color: '#ccc', fontSize: 12, padding: '7px 10px' }}>{fila.fecha || '—'}</div>
                      ) : (
                        <input
                          type="date"
                          value={fila.fecha}
                          onChange={e => {
                            const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, fecha: e.target.value } : f);
                            setResumen((p: any) => ({ ...p, plan_acciones: updated }));
                          }}
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 12, padding: '7px 10px', outline: 'none', colorScheme: 'dark' as const }}
                        />
                      )}
                    </td>
                    {!readOnly && (
                      <td style={{ padding: '6px 8px' }}>
                        <button
                          onClick={() => setResumen((p: any) => ({ ...p, plan_acciones: p.plan_acciones.filter((_: any, i: number) => i !== idx) }))}
                          style={{
                            background: 'rgba(239,68,68,0.06)',
                            border: '1px solid rgba(239,68,68,0.12)',
                            borderRadius: 8, color: '#ff3366',
                            cursor: 'pointer', padding: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <button
                onClick={() => setResumen((p: any) => ({ ...p, plan_acciones: [...p.plan_acciones, { problema: '', accion: '', responsable: '', fecha: '' }] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, color: '#666',
                  fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 800,
                  cursor: 'pointer', padding: '10px 18px',
                  textTransform: 'uppercase', letterSpacing: '1px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Plus size={14} strokeWidth={2.5} /> Agregar fila
              </button>
            )}
          </>
        )}
      </div>

      {/* ── SECCIÓN 10: RENDIMIENTO Y TENDENCIAS ── */}
      <div className="data-card" style={{ background: '#111111', display: 'flex', flexDirection: 'column' }}>
        {sectionHeader(10, '10. Rendimiento y Tendencias', <BarChart3 size={15} color="#00d4ff" />)}
        {!collapsedSections[10] && <AnalisisTemporalTab registros={registros} initialMonth={selectedMes} initialYear={selectedAnio} onStateChange={setSeccion10State} />}
      </div>
    </div>
  );
}
