'use client';

import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController,
} from 'chart.js';
import { formatCurrency } from '@/lib/utils';
import { CONFIG } from '@/types';
import { Users, TrendingUp, Shield, Briefcase, FileText, Activity, Target, BarChart3, Tag, PieChart, ChevronDown, ChevronRight } from 'lucide-react';
import AnalisisTemporalTab from '../../ajustes/AnalisisTemporalTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController);

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
  restanteCapital: number | null;
  restanteOps: number | null;
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
        callback: function(val: any) {
          const n = Number(val);
          if (isNaN(n)) return val;
          return (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n) + yLabel;
        }
      },
      grid: { color: 'rgba(255,255,255,0.04)' },
      beginAtZero: true
    },
  },
});

const cumplColor = (pct: number | null) =>
  pct === null ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

const DistBlock = ({ titulo, icon, datos, color, totalMes, scrollable = false }: { titulo: string; icon: React.ReactNode; datos: { label: string; monto: number; cantidad: number }[]; color: string; totalMes: number; scrollable?: boolean }) => {
  const totalCant = datos.reduce((s, d) => s + d.cantidad, 0);
  const displayData = datos;

  return (
    <div style={{ flex: 1, minWidth: 220, maxHeight: 320, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</span>
      </div>
      <div style={{ 
        background: '#0d0d0d', 
        borderRadius: 10, 
        border: '1px solid rgba(255,255,255,0.04)', 
        overflowY: scrollable ? 'auto' as const : 'hidden' as const, 
        flex: 1, 
        maxHeight: 280 
      }} className={scrollable ? 'custom-scroll' : ''}>
        {displayData.map((d, i) => {
          const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
          const pctMonto = totalMes > 0 ? (d.monto / totalMes) * 100 : 0;
          return (
            <div key={i} style={{ padding: '9px 14px', borderBottom: i < displayData.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{d.label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
    kpiTotal, kpiPorAnalista, mesActual, mesAnterior, experienciaCliente, analisisComercial, 
    operacionProcesos, gestionesRealizadas, coordinacionSalidas, empresasEstrategicas, 
    logros, desvios, accionesClave, dotacion, ausentismo, capacitacion, evaluacionDesempeno, 
    planAcciones, auditCounts, collapsedSections, registros, chartCapitalVsObjetivo, chartTicketPromedio, chartVariacion, 
    chartCumplimiento, chartEmbudo, chartAperturas, chartRenovaciones, chartConversionTotal, 
    chartConversionPresupuesto, chartEmpleoPublPriv, chartAcuerdos, distSexo, distCuotas, 
    distRangoEtario, distLocalidad, distEmpleador, distAcuerdos 
  } = datos;

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(collapsedSections || { 10: true });

  const toggleSection = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => (
    <div 
      style={{ 
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed[id] ? 0 : 16, 
        paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', 
        userSelect: 'none' 
      }}
    >
      <div style={{ width: 14 }} /> {/* Espacio para el chevron removido */}
      {icon}
      <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', flex: 1 }}>{title}</span>
    </div>
  );

  const LegendPill = ({ color, label }: { color: string, label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );

  const allAnalistas = [...kpiPorAnalista, { analista: 'Total PDV', ...kpiTotal, clientesIngresados: kpiTotal.clientes }];
  const totalMes = kpiTotal.capital;
  const ventasCount = kpiTotal.ops;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* SECCIÓN 1: TABLERO */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#60a5fa" />)}
        {!collapsed[1] && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}</div>
              {kpiTotal.cumplCapital !== null && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: cumplColor(kpiTotal.cumplCapital) }}>{kpiTotal.cumplCapital.toFixed(1)}% cumpl.</div>}
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
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{kpiTotal.ops}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}</div>
              {kpiTotal.cumplOps !== null && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: cumplColor(kpiTotal.cumplOps) }}>{kpiTotal.cumplOps.toFixed(1)}% cumpl.</div>}
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
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Conversión: {kpiTotal.conversion.toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{kpiTotal.clientes} clientes ingresados</div>
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
        )}
      </div>

      {/* SECCIÓN 2: INDICADORES POR ANALISTA */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(2, '2. Indicadores por Analista', <Users size={15} color="#a78bfa" />)}
        {!collapsed[2] && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
              {allAnalistas.map((k: any, idx: number) => {
                const isTotal = idx === kpiPorAnalista.length;
                return (
                  <div key={k.analista} style={{ background: isTotal ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: 12, border: `1px solid ${isTotal ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)'}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: isTotal ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={13} color={isTotal ? '#a78bfa' : '#666'} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isTotal ? '#a78bfa' : '#ccc' }}>{k.analista}</span>
                      </div>
                    </div>
                    <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Capital</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{formatCurrency(k.capital)}</div>
                        {k.cumplCapital !== null && (
                          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(k.cumplCapital, 100)}%`, background: cumplColor(k.cumplCapital), borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: cumplColor(k.cumplCapital), whiteSpace: 'nowrap' }}>{k.cumplCapital.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Operaciones</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{k.ops}</div>
                        {k.cumplOps !== null && (
                          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(k.cumplOps, 100)}%`, background: cumplColor(k.cumplOps), borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: cumplColor(k.cumplOps), whiteSpace: 'nowrap' }}>{k.cumplOps.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Ticket Prom.</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>{formatCurrency(k.ticket)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Conversión</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>{k.conversion.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8 }}>% Cumplimiento — Actual vs {mesAnterior}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="rgba(96,165,250,0.8)" label={mesActual} />
                    <LegendPill color="rgba(30, 58, 138, 0.9)" label={mesAnterior} />
                  </div>
                </div>
                <div style={{ height: 280 }}><Bar data={chartCumplimiento as any} options={baseChartOpts('%', false, true)} plugins={[labelsPlugin]} /></div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8 }}>Variación % vs {mesAnterior}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="rgba(52,211,153,0.7)" label="Positivo" />
                    <LegendPill color="rgba(248,113,113,0.7)" label="Negativo" />
                  </div>
                </div>
                <div style={{ height: 280 }}><Bar data={chartVariacion as any} options={baseChartOpts('%', false, true)} plugins={[labelsPlugin]} /></div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8 }}>Embudo Comercial</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="rgba(96,165,250,0.8)" label="Atendidos" />
                    <LegendPill color="rgba(167,139,250,0.8)" label="Cerradas" />
                  </div>
                </div>
                <div style={{ height: 280 }}>
                  {chartEmbudo && <Bar data={chartEmbudo} options={baseChartOpts(' registros', false, true)} plugins={[labelsPlugin]} />}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8 }}>% Total Conversión</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="rgba(251,191,36,0.8)" label={mesActual} />
                    <LegendPill color="rgba(124, 45, 18, 0.8)" label={mesAnterior} />
                  </div>
                </div>
                <div style={{ height: 280 }}>
                  {chartConversionTotal && <Bar data={chartConversionTotal} options={baseChartOpts('%', false, true)} plugins={[labelsPlugin]} />}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 12, background: '#34d399', borderRadius: 2 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8 }}>% Empleo Público / Privado</span>
                </div>
                <div style={{ height: 280 }}>
                  {chartEmpleoPublPriv && <Bar data={chartEmpleoPublPriv} options={baseChartOpts(' ops', false, true)} plugins={[labelsPlugin]} />}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8 }}>Acuerdos por Analista</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <LegendPill color="#60a5fa" label="Luciana" />
                    <LegendPill color="#a78bfa" label="Victoria" />
                  </div>
                </div>
                <div style={{ height: 280 }}>
                  {chartAcuerdos && <Bar data={chartAcuerdos} options={baseChartOpts(' ops', false, true)} plugins={[labelsPlugin]} />}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SECCIÓN 3: VENTAS POR CATEGORÍA */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(3, '3. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}
        {!collapsed[3] && (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: '#444' }}>{ventasCount} ops · {formatCurrency(totalMes)}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {distAcuerdos && <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#f97316" />} datos={distAcuerdos} color="#f97316" totalMes={totalMes} />}
              {distCuotas && <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={distCuotas} color="#60a5fa" totalMes={totalMes} />}
              {distRangoEtario && <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={distRangoEtario} color="#34d399" totalMes={totalMes} />}
              {distSexo && <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={distSexo} color="#f472b6" totalMes={totalMes} />}
              {distEmpleador && <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={distEmpleador} color="#fbbf24" totalMes={totalMes} scrollable={true} />}
              {distLocalidad && <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={distLocalidad} color="#a78bfa" totalMes={totalMes} />}
            </div>
          </>
        )}
      </div>

      {/* SECCIÓN 4: ANÁLISIS COMERCIAL */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(4, '4. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
        {!collapsed[4] && <ManualTextareaView label="Interpretación del Período" value={analisisComercial || ''} />}
      </div>

      {/* SECCIÓN 5: OPERACIÓN Y PROCESOS */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(5, '5. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
        {!collapsed[5] && <ManualTextareaView label="Cumplimiento de Procedimientos / Tiempos / Stock" value={operacionProcesos || ''} />}
      </div>

      {/* SECCIÓN 6: GESTIÓN COMERCIAL */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(6, '6. Gestión Comercial', <Briefcase size={15} color="#34d399" />)}
        {!collapsed[6] && (
          <>
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
          </>
        )}
      </div>

      {/* SECCIÓN 7: EXPERIENCIA DEL CLIENTE */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(7, '7. Experiencia del Cliente', <FileText size={15} color="#f472b6" />)}
        {!collapsed[7] && <ManualTextareaView label="Reclamos y Satisfacción" value={experienciaCliente || ''} />}
      </div>

      {/* SECCIÓN 8: GESTIÓN DEL EQUIPO */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(8, '8. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
        {!collapsed[8] && (
          <>
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
          </>
        )}
      </div>

      {/* SECCIÓN 9: PLAN DE ACCIÓN */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(9, '9. Plan de Acción', <Target size={15} color="#fb923c" />)}
        {!collapsed[9] && (
          planAcciones && planAcciones.length > 0 ? (
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
          ) : <div style={{ color: '#444', fontSize: 13 }}>—</div>
        )}
      </div>

      {/* SECCIÓN 10: ANÁLISIS TEMPORAL */}
      <div className="data-card" style={{ background: '#0a0a0a' }}>
        {sectionHeader(10, '10. Análisis Temporal', <Activity size={15} color="#60a5fa" />)}
        {!collapsed[10] && (
          registros && registros.length > 0 ? (
            <AnalisisTemporalTab registros={registros} isPublic={true} />
          ) : (
            <div style={{ color: '#444', fontSize: 13, fontStyle: 'italic', padding: '10px 0' }}>
              No hay datos históricos disponibles para este período.
            </div>
          )
        )}
      </div>
    </div>
  );
}