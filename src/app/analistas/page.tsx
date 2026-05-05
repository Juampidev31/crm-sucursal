'use client';
// Build trigger: 2026-05-05 12:24

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro, Objetivo, CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { formatCurrency } from '@/lib/utils';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import SelectReporte from '@/components/SelectReporte';
import { Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, Briefcase, PieChart, Tag, ChevronDown, Calculator, Table, DollarSign } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement
} from 'chart.js';
import AnalisisTemporalTab from '@/app/ajustes/AnalisisTemporalTab';
import MetricasTab from '@/app/ajustes/MetricasTab';
import type { AnalisisTemporalState } from '@/app/ajustes/AnalisisTemporalTab';

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
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>{titulo}</span>
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


ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement);

// ── Plugin inline: data labels on bars ───────────────────────────────────
const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx, scales } = chart;
    const isHorizontal = chart.config.options.indexAxis === 'y';
    const isStacked = chart.config.options.scales?.x?.stacked || chart.config.options.scales?.y?.stacked;

    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden || meta.type !== 'bar') return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';

      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,1)';
      ctx.shadowBlur = 5;

      // Detección de porcentaje: solo mediante flag explícito
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
          // Redondear a 1 decimal si es < 10, sino entero
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
 
// ── Plugin inline: líneas de referencia horizontales (Meta/Objetivo) ─────
const referenceLinesPlugin: any = {
  id: 'referenceLinesPlugin',
  afterDraw(chart: any) {
    const { ctx, chartArea: { left, right }, scales } = chart;
    
    chart.data.datasets.forEach((dataset: any) => {
      if (dataset.horizontalReferenceValue !== undefined) {
        const yAxisID = dataset.yAxisID || 'y';
        const yScale = scales[yAxisID];
        if (!yScale) return;
        
        const yValue = yScale.getPixelForValue(dataset.horizontalReferenceValue);
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash(dataset.borderDash || []);
        ctx.lineWidth = dataset.borderWidth || 2;
        ctx.strokeStyle = dataset.borderColor || '#fff';
        ctx.moveTo(left, yValue);
        ctx.lineTo(right, yValue);
        ctx.stroke();
        
        // Etiqueta opcional
        if (dataset.showLabelOnLine) {
          ctx.fillStyle = dataset.borderColor;
          ctx.font = 'bold 9px Outfit, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(dataset.label, right - 5, yValue - 5);
        }
        
        ctx.restore();
      }
    });
  }
};
 
const now = new Date();


export default function AnalistasPage() {
  const { registros: allRegistros, loading } = useRegistros();
  const { objetivos } = useObjetivos();
  const { diasConfig } = useSettings();
  const [analista, setAnalista] = useState<string>('PDV');

  const registros = useMemo(() => {
    return analista === 'PDV' ? allRegistros : allRegistros.filter(r => r.analista === analista);
  }, [allRegistros, analista]);

  const analistasParaMostrar = analista === 'PDV' ? CONFIG.ANALISTAS_DEFAULT : [analista];
  const chartLabels = useMemo(() => {
    const base = analistasParaMostrar.map(a => a.charAt(0).toUpperCase() + a.slice(1));
    if (analista === 'PDV') return [...base, 'Total PDV'];
    return base;
  }, [analistasParaMostrar, analista]);
  const [seccion10State, setSeccion10State] = useState<AnalisisTemporalState | null>(null);

  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(now.getFullYear());
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });

  const toggleSection = (id: number) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };



  const [manualCobranzas, setManualCobranzas] = useState({
    pctTr90: 0,
    pctTr120: 0,
    pctRefin: 0
  });

  const handleManualCobChange = (key: string, val: string) => {
    const num = parseFloat(val) || 0;
    setManualCobranzas(prev => ({ ...prev, [key]: num }));
  };

  // ── Helpers de cálculo ────────────────────────────────────────────────────
  const filterByMonth = (regs: Registro[], mes: number, anio: number) => {
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    return regs.filter(r => r.fecha?.slice(0, 7) === key);
  };

  const isVenta = (r: Registro) => {
    const e = (r.estado ?? '').toLowerCase();
    return e === 'venta' || e.includes('aprobado cc');
  };

  const cumplColor = (pct: number | null) =>
    pct === null ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

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

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => {
    const isCollapsed = !!collapsedSections[id];
    return (
      <div 
        onClick={() => toggleSection(id)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: isCollapsed ? 0 : 16, 
          paddingBottom: 10, 
          borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
          gap: 12,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{title}</span>
        </div>
      </div>
    );
  };

  const mesPrev = selectedMes === 1 ? 12 : selectedMes - 1;
  const anioPrev = selectedMes === 1 ? selectedAnio - 1 : selectedAnio;

  // ── KPI por analista ──────────────────────────────────────────────────────
  const kpiPorAnalista = useMemo(() => {
    return analistasParaMostrar.map(analista => {
      const regsAnalista = filterByMonth(registros, selectedMes, selectedAnio).filter(r => r.analista === analista);
      const ventas = regsAnalista.filter(isVenta);
      const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const ops = ventas.length;
      const ticket = ops > 0 ? capital / ops : 0;
      const conversion = regsAnalista.length > 0 ? (ops / regsAnalista.length) * 100 : 0;

      // Monto venta y Aprob CC por separado
      const montoVenta = regsAnalista
        .filter(r => (r.estado ?? '').toLowerCase() === 'venta')
        .reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const montoAprobCC = regsAnalista
        .filter(r => (r.estado ?? '').toLowerCase().includes('aprobado cc'))
        .reduce((s, r) => s + (Number(r.monto) || 0), 0);

      // Objetivo.mes es 0-indexed (0 = Enero)
      const obj = objetivos.find(o => o.analista === analista && o.mes === selectedMes - 1 && o.anio === selectedAnio);
      const metaCapital = obj?.meta_ventas ?? 0;
      const metaOps = obj?.meta_operaciones ?? 0;
      const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
      const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
      const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
      const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

      const ventasAnt = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === analista).filter(isVenta);
      const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const opsAnt = ventasAnt.length;
      const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
      const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;

      // Proyección a fin de mes — usa días hábiles cargados manualmente por admin (/ajustes)
      const hoy = new Date();
      const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
      const cfgDias = diasConfig.find(d => d.analista === analista);
      const diasHabilesAdmin = cfgDias?.dias_habiles ?? 0;
      const diasTransAdmin = cfgDias?.dias_transcurridos ?? 0;
      const tieneDiasAdmin = diasHabilesAdmin > 0 && diasTransAdmin > 0;

      const diasRestantes = Math.max(0, diasHabilesAdmin - diasTransAdmin);
      const ventaPorDia = tieneDiasAdmin ? capital / diasTransAdmin : null;
      const opsPorDia = tieneDiasAdmin ? ops / diasTransAdmin : null;
      
      // La meta diaria se calcula como lo que falta para llegar dividido los días restantes
      // Si ya pasó el mes o no hay días cargados, se usa la meta lineal original
      const metaDiariaCapital = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
        ? Math.max(0, metaCapital - capital) / diasRestantes
        : (tieneDiasAdmin ? metaCapital / diasHabilesAdmin : null);
      
      const metaDiariaOps = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
        ? Math.max(0, metaOps - ops) / diasRestantes
        : (tieneDiasAdmin ? metaOps / diasHabilesAdmin : null);

      const proyCapital = (esMesActual && tieneDiasAdmin && ventaPorDia !== null) ? ventaPorDia * diasHabilesAdmin : (esMesActual ? null : capital);
      const proyOps = (esMesActual && tieneDiasAdmin && opsPorDia !== null) ? Math.round(opsPorDia * diasHabilesAdmin) : (esMesActual ? null : ops);
      const faltaCapital = metaCapital > 0 ? Math.max(0, metaCapital - capital) : null;
      const faltaOps = metaOps > 0 ? Math.max(0, metaOps - ops) : null;

      const cumplProyCapital = metaCapital > 0 ? (proyCapital !== null ? (proyCapital / metaCapital) * 100 : null) : null;
      const cumplProyOps = metaOps > 0 ? (proyOps !== null ? (proyOps / metaOps) * 100 : null) : null;

      // Cálculo de incentivos (SOLO LUCIANA Y VICTORIA)
      const analistasConIncentivo = ['luciana', 'victoria'];
      const tieneIncentivo = analistasConIncentivo.includes(analista.toLowerCase());
      
      let coefCap = 0;
      let coefOps = 0;
      let incentivoCap = 0;
      let incentivoOps = 0;

      if (tieneIncentivo) {
        if (cumplCapital !== null) {
          if (cumplCapital >= 120) coefCap = 0.0045;
          else if (cumplCapital >= 110) coefCap = 0.0037;
          else if (cumplCapital >= 90) coefCap = 0.0030;
          else if (cumplCapital >= 75) coefCap = 0.0020;
        }
        
        if (cumplOps !== null && cumplCapital !== null && cumplCapital >= 75) {
          if (cumplOps >= 100) coefOps = 0.0030;
          else if (cumplOps >= 80) coefOps = 0.0020;
        }

        incentivoCap = capital * coefCap;
        incentivoOps = capital * coefOps * 10;
      }

      // ── Incentivos de Cobranzas ──────────────────────────────────────────────
      let incentivoCobTr90 = 0, incentivoCobTr120 = 0, incentivoCobRefin = 0;
      let pctTr90 = 0, pctTr120 = 0, pctRefin = 0;

      if (['luciana', 'victoria'].includes(analista.toLowerCase())) {
        pctTr90 = manualCobranzas.pctTr90;
        pctTr120 = manualCobranzas.pctTr120;
        pctRefin = manualCobranzas.pctRefin;

        // Tramo 90-119
        if (pctTr90 >= 100) incentivoCobTr90 = 16667;
        else if (pctTr90 >= 90) incentivoCobTr90 = 12643;

        // Tramo 120-209
        if (pctTr120 >= 100) incentivoCobTr120 = 16667;
        else if (pctTr120 >= 90) incentivoCobTr120 = 12643;

        // Refinanciacion
        if (pctRefin >= 110) incentivoCobRefin = 16667;
        else if (pctRefin >= 90) incentivoCobRefin = 12643;
      }

      const incentivoTotal = incentivoCap + incentivoOps + incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;

      return {
        analista, capital, ops, ticket, conversion, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, tendCapital, tendOps,
        clientesIngresados: regsAnalista.length,
        montoVenta,
        montoAprobCC,
        ventaPorDia, opsPorDia, metaDiariaCapital, metaDiariaOps, proyCapital, proyOps, faltaCapital, faltaOps, esMesActual,
        diasHabilesAdmin, diasTransAdmin, tieneDiasAdmin,
        cumplProyCapital, cumplProyOps,
        coefCap, coefOps, incentivoCap, incentivoOps,
        incentivoCobTr90, incentivoCobTr120, incentivoCobRefin,
        pctTr90, pctTr120, pctRefin,
        incentivoTotal
      };
    });
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, manualCobranzas]);

  // ── KPI total ─────────────────────────────────────────────────────────────
  const kpiTotal = useMemo(() => {
    const regs = filterByMonth(registros, selectedMes, selectedAnio);
    const ventas = regs.filter(isVenta);
    const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const ops = ventas.length;
    const ticket = ops > 0 ? capital / ops : 0;
    const clientes = regs.length;
    const conversion = clientes > 0 ? (ops / clientes) * 100 : 0;

    const montoVenta = regs
      .filter(r => (r.estado ?? '').toLowerCase() === 'venta')
      .reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const montoAprobCC = regs
      .filter(r => (r.estado ?? '').toLowerCase().includes('aprobado cc'))
      .reduce((s, r) => s + (Number(r.monto) || 0), 0);

    const ventasAnt = filterByMonth(registros, mesPrev, anioPrev).filter(isVenta);
    const regsAnt = filterByMonth(registros, mesPrev, anioPrev);
    const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const opsAnt = ventasAnt.length;
    const ticketAnt = opsAnt > 0 ? capitalAnt / opsAnt : 0;
    const clientesAnt = regsAnt.length;
    const conversionAnt = clientesAnt > 0 ? (opsAnt / clientesAnt) * 100 : 0;

    const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
    const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;
    const tendTicket = ticketAnt > 0 ? ((ticket - ticketAnt) / ticketAnt) * 100 : null;
    const tendClientes = clientesAnt > 0 ? ((clientes - clientesAnt) / clientesAnt) * 100 : null;
    const tendConversion = conversionAnt > 0 ? ((conversion - conversionAnt) / conversionAnt) * 100 : null;

    const obj = objetivos.find(o => o.analista === analista && o.mes === selectedMes - 1 && o.anio === selectedAnio);
    const metaCapital = analista === 'PDV' 
      ? objetivos.filter(o => o.mes === selectedMes - 1 && o.anio === selectedAnio && o.analista !== 'PDV').reduce((s, o) => s + (o.meta_ventas || 0), 0)
      : (obj?.meta_ventas ?? 0);
    const metaOps = analista === 'PDV' 
      ? objetivos.filter(o => o.mes === selectedMes - 1 && o.anio === selectedAnio && o.analista !== 'PDV').reduce((s, o) => s + (o.meta_operaciones || 0), 0)
      : (obj?.meta_operaciones ?? 0);
    const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
    const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
    const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
    const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

    // Proyección PDV consolidada — admin carga días con analista='Todos' en /ajustes (Punto de Venta)
    const hoy = new Date();
    const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
    const cfgDias = diasConfig.find(d => d.analista === 'Todos');
    const diasHabilesAdmin = cfgDias?.dias_habiles ?? 0;
    const diasTransAdmin = cfgDias?.dias_transcurridos ?? 0;
    const tieneDiasAdmin = diasHabilesAdmin > 0 && diasTransAdmin > 0;
    const diasRestantes = Math.max(0, diasHabilesAdmin - diasTransAdmin);
    const ventaPorDia = tieneDiasAdmin ? capital / diasTransAdmin : null;
    const opsPorDia = tieneDiasAdmin ? ops / diasTransAdmin : null;
    
    const metaDiariaCapital = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
      ? Math.max(0, metaCapital - capital) / diasRestantes
      : (tieneDiasAdmin ? metaCapital / diasHabilesAdmin : null);
      
    const metaDiariaOps = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
      ? Math.max(0, metaOps - ops) / diasRestantes
      : (tieneDiasAdmin ? metaOps / diasHabilesAdmin : null);

    const proyCapital = (esMesActual && tieneDiasAdmin && ventaPorDia !== null) ? ventaPorDia * diasHabilesAdmin : (esMesActual ? null : capital);
    const proyOps = (esMesActual && tieneDiasAdmin && opsPorDia !== null) ? Math.round(opsPorDia * diasHabilesAdmin) : (esMesActual ? null : ops);
    const faltaCapital = metaCapital > 0 ? Math.max(0, metaCapital - capital) : null;
    const faltaOps = metaOps > 0 ? Math.max(0, metaOps - ops) : null;

    const cumplProyCapital = metaCapital > 0 ? (proyCapital !== null ? (proyCapital / metaCapital) * 100 : null) : null;
    const cumplProyOps = metaOps > 0 ? (proyOps !== null ? (proyOps / metaOps) * 100 : null) : null;

    // Cálculo de incentivos global - Suma de individuales (Solo Luciana y Victoria)
    const incentivoCap = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCap || 0), 0);
    const incentivoOps = kpiPorAnalista.reduce((s, k) => s + (k.incentivoOps || 0), 0);
    
    // Cobranzas Total (Suma de analistas con incentivo)
    const incentivoCobTr90 = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCobTr90 || 0), 0);
    const incentivoCobTr120 = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCobTr120 || 0), 0);
    const incentivoCobRefin = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCobRefin || 0), 0);

    const incentivoTotal = incentivoCap + incentivoOps + incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;

    return {
      analista: 'PDV',
      capital, ops, ticket, conversion, clientes, tendCapital, tendOps, tendTicket, tendClientes, tendConversion,
      metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, montoVenta, montoAprobCC,
      clientesIngresados: clientes,
      ventaPorDia, opsPorDia, metaDiariaCapital, metaDiariaOps, proyCapital, proyOps, faltaCapital, faltaOps, esMesActual,
      diasHabilesAdmin, diasTransAdmin, tieneDiasAdmin,
      cumplProyCapital, cumplProyOps,
      coefCap: 0, coefOps: 0, incentivoCap, incentivoOps, 
      incentivoCobTr90, incentivoCobTr120, incentivoCobRefin,
      incentivoTotal
    };
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, analista, kpiPorAnalista]);

  // ── Distribución acuerdo de precios ──────────────────────────────────────
  const distribucionAcuerdos = useMemo(() => {
    const tipos: Record<string, { monto: number; cantidad: number }> = {
      'PREMIUM': { monto: 0, cantidad: 0 },
      'Riesgo MEDIO': { monto: 0, cantidad: 0 },
      'Riesgo BAJO': { monto: 0, cantidad: 0 },
      'No califica/Excepcion': { monto: 0, cantidad: 0 },
      'No califica': { monto: 0, cantidad: 0 },
    };
    // Mapeo para match con DB
    const matchTipo = (acuerdo: string, estado: string, isV: boolean): string | null => {
      const ac = (acuerdo || '').toLowerCase().trim();
      const es = (estado || '').toLowerCase().trim();
      // Prioridad a estados de no calificación
      const esRechazo = ac.includes('no califica') || ac === 'n/c' || 
                        es.includes('no califica') || es.includes('bajo') || es.includes('afectaciones') || es.includes('rechazado');
      
      if (esRechazo) {
        return isV ? 'No califica/Excepcion' : 'No califica';
      }

      if (ac.includes('bajo')) return 'Riesgo BAJO';
      if (ac.includes('medio')) return 'Riesgo MEDIO';
      if (ac.includes('premium')) return 'PREMIUM';
      
      return null;
    };
    for (const r of filterByMonth(allRegistros, selectedMes, selectedAnio)) {
      const isV = isVenta(r);
      const matched = matchTipo(r.acuerdo_precios ?? '', r.estado ?? '', isV);
      if (matched) {
        tipos[matched].monto += Number(r.monto) || 0;
        tipos[matched].cantidad += 1;
      }
    }
    return tipos;
  }, [allRegistros, selectedMes, selectedAnio]);

  // ── Distribuciones demográficas (ventas del mes) ─────────────────────────
  const ventasMes = useMemo(() =>
    filterByMonth(registros, selectedMes, selectedAnio),
    [registros, selectedMes, selectedAnio]
  );

  const distPor = (campo: keyof Registro, fuente = ventasMes) => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuente) {
      const val = (r[campo] as string | undefined)?.trim() || 'No especificado';
      const prev = map.get(val) ?? { monto: 0, cantidad: 0 };
      map.set(val, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([label, data]) => ({ label, ...data }));
  };

  // ── Normalización de empleador para agrupar duplicados ────────────────────
  const normalizarEmpleador = (nombre: string): string => {
    if (!nombre) return 'No especificado';
    let n = nombre.toUpperCase().trim();
    // Quitar acentos
    n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Quitar sufijos legales comunes
    n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
    // Quitar palabras vacías al final
    n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
    // Quitar múltiples espacios
    n = n.replace(/\s+/g, ' ').trim();
    return n || 'No especificado';
  };

  const distEmpleador = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number; variantes: Map<string, number>; displayLabel: string }>();
    for (const r of ventasMes) {
      const raw = (r.empleador ?? '').trim();
      const key = normalizarEmpleador(raw);
      const prev = map.get(key) ?? { monto: 0, cantidad: 0, variantes: new Map<string, number>(), displayLabel: raw };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      if (raw) {
        prev.variantes.set(raw, (prev.variantes.get(raw) || 0) + 1);
        // Usar la variante más común como displayLabel
        let maxCount = 0;
        let maxVariant = raw;
        for (const [v, c] of prev.variantes) {
          if (c > maxCount) { maxCount = c; maxVariant = v; }
        }
        prev.displayLabel = maxVariant;
      }
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([_, data]) => ({ label: data.displayLabel, monto: data.monto, cantidad: data.cantidad }));
  }, [ventasMes]);

  const distCuotas = useMemo(() => distPor('cuotas', ventasMes.filter(isVenta)), [ventasMes]);
  const distRangoEtario = useMemo(() => distPor('rango_etario'), [ventasMes]);
  const distSexo = useMemo(() => distPor('sexo'), [ventasMes]);
  const distLocalidad = useMemo(() => distPor('localidad'), [ventasMes]);
  const distEstados = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of ventasMes) {
      let raw = (r.estado || '').toLowerCase().trim();
      let label = '';

      if (raw.includes('derivado') || raw.includes('aprobado cc')) {
        label = 'Aprob. CC';
      } else if (raw.includes('rechazado')) {
        label = 'Rechaz. CC';
      } else if (raw === 'venta') {
        label = 'Venta';
      } else if (raw === 'proyeccion') {
        label = 'Proyección';
      } else if (raw === 'en seguimiento') {
        label = 'En Seguimiento';
      } else if (raw === 'no califica') {
        label = 'No califica';
      } else if (raw === 'score bajo') {
        label = 'Score Bajo';
      } else if (raw === 'afectaciones') {
        label = 'Afectaciones';
      } else {
        label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'No especificado';
      }

      const prev = map.get(label) ?? { monto: 0, cantidad: 0 };
      map.set(label, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([label, data]) => ({ label, ...data }));
  }, [ventasMes]);
  const distAcuerdos = useMemo(() => {
    return Object.entries(distribucionAcuerdos)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [distribucionAcuerdos]);

  // ── Distribuciones mes anterior ───────────────────────────────────────────
  const ventasMesAnt = useMemo(() =>
    filterByMonth(registros, mesPrev, anioPrev),
    [registros, mesPrev, anioPrev]
  );

  const distPorAnt = (campo: keyof Registro, fuente: typeof ventasMesAnt) => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuente) {
      const val = (r[campo] as string | undefined)?.trim() || 'No especificado';
      const prev = map.get(val) ?? { monto: 0, cantidad: 0 };
      map.set(val, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
    }
    return map;
  };

  const distCuotasAnt = useMemo(() => distPorAnt('cuotas', ventasMesAnt), [ventasMesAnt]);
  const distRangoAnt = useMemo(() => distPorAnt('rango_etario', ventasMesAnt), [ventasMesAnt]);
  const distSexoAnt = useMemo(() => distPorAnt('sexo', ventasMesAnt), [ventasMesAnt]);
  const distEmpleadorAnt = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number; variantes: Map<string, number>; displayLabel: string }>();
    for (const r of ventasMesAnt) {
      const raw = (r.empleador ?? '').trim();
      const key = normalizarEmpleador(raw);
      const prev = map.get(key) ?? { monto: 0, cantidad: 0, variantes: new Map<string, number>(), displayLabel: raw };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      if (raw) {
        prev.variantes.set(raw, (prev.variantes.get(raw) || 0) + 1);
        let maxCount = 0;
        let maxVariant = raw;
        for (const [v, c] of prev.variantes) {
          if (c > maxCount) { maxCount = c; maxVariant = v; }
        }
        prev.displayLabel = maxVariant;
      }
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([_, data]) => ({ label: data.displayLabel, monto: data.monto, cantidad: data.cantidad }));
  }, [ventasMesAnt]);
  const distLocalidadAnt = useMemo(() => distPorAnt('localidad', ventasMesAnt), [ventasMesAnt]);
  const distAcuerdosAnt = useMemo(() => distPorAnt('acuerdo_precios', ventasMesAnt), [ventasMesAnt]);

  // ── Config base de gráficos (dark theme) ─────────────────────────────────
  const mesActualLabel = CONFIG.MESES_NOMBRES[selectedMes - 1].slice(0, 3);
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1].slice(0, 3);

  const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false): any => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    layout: { padding: { top: showLabels ? 50 : 20, bottom: 5 } },
    _isPct: yLabel.includes('%'), // Flag explícito para el plugin
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
    categoryPercentage: 0.8,
    barPercentage: 0.7,
    scales: {
      x: {
        stacked,
        ticks: {
          color: '#555', font: { size: 10 },
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
        grid: { color: 'rgba(255,255,255,0.03)' }
      },
      y: {
        stacked,
        ticks: {
          color: '#555', font: { size: 10 },
          callback: function (this: any, val: any) {
            let label = this.getLabelForValue(val);
            if (label === undefined) label = val;
            if (!horizontal) {
              const n = Number(label);
              if (isNaN(n)) return label;
              return (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n) + yLabel;
            }
            return label;
          }
        },
        grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true,
      },
    },
  });

  // Helper: línea de referencia 100%
  const refLine100 = (n: number, yAxisID?: string) => ({
    type: 'line' as const,
    label: 'Meta 100%',
    data: Array(n).fill(100),
    horizontalReferenceValue: 100,
    borderColor: '#f87171',
    borderWidth: 1.5,
    borderDash: [5, 4],
    pointRadius: 0,
    fill: false,
    order: 0,
    yAxisID,
  });

  // ── Datos gráfico cumplimiento por analista ───────────────────────────────
  // Card unificada: en Vista Global usa el consolidado (kpiTotal); en vista de analista usa el individual
  const kpiCards = useMemo(
    () => (analista === 'PDV' ? [kpiTotal] : kpiPorAnalista),
    [analista, kpiTotal, kpiPorAnalista]
  );

  const chartCumplimiento = useMemo(() => {
    const labels = kpiCards.map(k => k.analista);
    return {
      labels,
      datasets: [
        {
          label: `Capital ${mesActualLabel}`,
          data: kpiCards.map(k => k.cumplCapital ?? 0),
          backgroundColor: 'rgba(96,165,250,0.7)', borderRadius: 4, order: 1,
        },
        {
          label: `Capital ${mesAntLabel}`,
          data: kpiCards.map(k => {
            const antRegs = filterByMonth(registros, mesPrev, anioPrev);
            const ant = (k.analista === 'PDV' ? antRegs : antRegs.filter(r => r.analista === k.analista)).filter(isVenta);
            const capitalAnt = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_ventas ? (capitalAnt / objAnt.meta_ventas) * 100 : 0;
          }),
          backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesActualLabel}`,
          data: kpiCards.map(k => k.cumplOps ?? 0),
          backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesAntLabel}`,
          data: kpiCards.map(k => {
            const antRegs = filterByMonth(registros, mesPrev, anioPrev);
            const ant = (k.analista === 'PDV' ? antRegs : antRegs.filter(r => r.analista === k.analista)).filter(isVenta);
            const opsAnt = ant.length;
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_operaciones ? (opsAnt / objAnt.meta_operaciones) * 100 : 0;
          }),
          backgroundColor: 'rgba(76, 29, 149, 0.9)', borderRadius: 4, order: 1, // Purpura oscuro
        },
        refLine100(labels.length),
      ],
    };
  }, [kpiCards, registros, objetivos, mesPrev, anioPrev, mesActualLabel, mesAntLabel]);

  // ── Datos gráfico acuerdo de precios ──────────────────────────────────────
  const chartAcuerdos = useMemo(() => {
    const tiposDisplay = ['PREMIUM', 'Riesgo MEDIO', 'Riesgo BAJO', 'No califica/Excepcion', 'No califica'];
    const analistas = analistasParaMostrar;
    const colores = ['#60a5fa', '#a78bfa'];

    const matchAcuerdo = (acuerdo: string, estado: string, isV: boolean): string | null => {
      const ac = (acuerdo || '').toLowerCase().trim();
      const es = (estado || '').toLowerCase().trim();
      // Prioridad a estados de no calificación
      const esRechazo = ac.includes('no califica') || ac === 'n/c' || 
                        es.includes('no califica') || es.includes('bajo') || es.includes('afectaciones') || es.includes('rechazado');
      
      if (esRechazo) {
        return isV ? 'No califica/Excepcion' : 'No califica';
      }

      if (ac.includes('bajo')) return 'Riesgo BAJO';
      if (ac.includes('medio')) return 'Riesgo MEDIO';
      if (ac.includes('premium')) return 'PREMIUM';
      return null;
    };

    return {
      labels: tiposDisplay,
      datasets: analistas.map((an, idx) => ({
        label: an,
        data: tiposDisplay.map(t => {
          return filterByMonth(registros, selectedMes, selectedAnio).filter(r => {
            const isV = isVenta(r);
            const matched = matchAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', isV);
            return r.analista === an && matched === t;
          }).length;
        }),
        backgroundColor: colores[idx] || '#555',
        borderRadius: 4,
        maxBarThickness: 70,
      }))
    };
  }, [registros, selectedMes, selectedAnio, filterByMonth, isVenta]);

  // ── Helper gráfico horizontal por categoría ───────────────────────────────
  const buildCatChart = (
    actual: { label: string; cantidad: number }[],
    anterior: Map<string, { cantidad: number }>,
    color: string,
    limit = 8
  ) => {
    const top = actual.slice(0, limit);
    return {
      labels: top.map(d => d.label),
      datasets: [
        {
          label: mesActualLabel,
          data: top.map(d => d.cantidad),
          backgroundColor: color,
          borderRadius: 4, order: 1,
        },
        {
          label: mesAntLabel,
          data: top.map(d => anterior.get(d.label)?.cantidad ?? 0),
          backgroundColor: `${color}44`,
          borderRadius: 4, order: 1,
        },
      ],
    };
  };

  const chartSexo = useMemo(() => buildCatChart(distSexo, distSexoAnt, '#f472b6'), [distSexo, distSexoAnt, mesActualLabel, mesAntLabel]);

  // ── Ranking analistas ─────────────────────────────────────────────────────
  const rankingAnalistas = useMemo(() =>
    [...kpiPorAnalista].sort((a, b) => b.capital - a.capital),
    [kpiPorAnalista]
  );

  // ── Chart 1: Capital vs Objetivo ──────────────────────────────────────────
  const chartCapitalVsObjetivo = useMemo(() => {
    const labels = chartLabels;
    const isSingle = labels.length === 1;

    const capitalAct = [...kpiPorAnalista.map(k => k.capital)];
    if (analista === 'PDV') capitalAct.push(kpiTotal.capital);

    const capitalAnt = [
      ...kpiPorAnalista.map(k => {
        const ant = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
        return ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      })
    ];
    if (analista === 'PDV') {
      capitalAnt.push(filterByMonth(allRegistros, mesPrev, anioPrev).filter(isVenta).reduce((s, r) => s + (Number(r.monto) || 0), 0));
    }

    const objetivo = [...kpiPorAnalista.map(k => k.metaCapital || 0)];
    if (analista === 'PDV') objetivo.push(kpiTotal.metaCapital || 0);

    const cumplimiento = [...kpiPorAnalista.map(k => k.cumplCapital || 0)];
    if (analista === 'PDV') cumplimiento.push(kpiTotal.cumplCapital || 0);

    return {
      labels,
      datasets: [
        { label: `Capital ${mesActualLabel}`, data: capitalAct, backgroundColor: 'rgba(96,165,250,0.8)', borderRadius: 4, order: 2, maxBarThickness: 70 },
        { label: `Capital ${mesAntLabel}`, data: capitalAnt, backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: 4, order: 2, maxBarThickness: 70 },
        { 
          type: 'line' as const, label: 'Objetivo ($)', data: objetivo, borderColor: '#f87171', borderWidth: 2, borderDash: [5, 4], pointRadius: 0, fill: false, order: 1,
          horizontalReferenceValue: isSingle ? objetivo[0] : undefined 
        },
      ],
    };
  }, [chartLabels, kpiPorAnalista, kpiTotal, allRegistros, mesPrev, anioPrev, mesActualLabel, mesAntLabel, analista]);

  // ── Chart 2: Ticket Promedio ──────────────────────────────────────────────
  const chartTicketPromedio = useMemo(() => {
    const labels = chartLabels;
    const ticketAct = [...kpiPorAnalista.map(k => k.ticket)];
    if (analista === 'PDV') ticketAct.push(kpiTotal.ticket);

    const ticketAnt = [
      ...kpiPorAnalista.map(k => {
        const ant = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
        const cap = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
        return ant.length > 0 ? cap / ant.length : 0;
      })
    ];
    if (analista === 'PDV') {
      const vAnt = filterByMonth(allRegistros, mesPrev, anioPrev).filter(isVenta);
      ticketAnt.push(vAnt.length > 0 ? vAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0) / vAnt.length : 0);
    }

    return {
      labels,
      datasets: [
        { label: `Ticket ${mesActualLabel}`, data: ticketAct, backgroundColor: 'rgba(52,211,153,0.8)', borderRadius: 4, maxBarThickness: 70 },
        { label: `Ticket ${mesAntLabel}`, data: ticketAnt, backgroundColor: 'rgba(6, 78, 59, 0.9)', borderRadius: 4, maxBarThickness: 70 },
      ],
    };
  }, [chartLabels, kpiPorAnalista, kpiTotal, allRegistros, mesPrev, anioPrev, mesActualLabel, mesAntLabel, analista]);

  // ── Chart 4: Variación % vs mes anterior ─────────────────────────────────
  const chartVariacion = useMemo(() => {
    const isGlobal = analista === 'PDV';
    const labels = isGlobal ? ['TOTAL GENERAL'] : [analista.toUpperCase()];
    
    const capitalVar = isGlobal ? [kpiTotal.tendCapital ?? 0] : [kpiPorAnalista[0]?.tendCapital ?? 0];
    const opsVar = isGlobal ? [kpiTotal.tendOps ?? 0] : [kpiPorAnalista[0]?.tendOps ?? 0];

    return {
      labels,
      datasets: [
        { 
          label: 'Variación Capital %', 
          data: capitalVar, 
          backgroundColor: capitalVar.map(v => v >= 0 ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)'), 
          borderRadius: 4, 
          maxBarThickness: 100 
        },
        { 
          label: 'Variación Ops %', 
          data: opsVar, 
          backgroundColor: opsVar.map(v => v >= 0 ? 'rgba(167,139,250,0.7)' : 'rgba(248,113,113,0.7)'), 
          borderRadius: 4, 
          maxBarThickness: 100 
        },
      ],
    };
  }, [kpiPorAnalista, kpiTotal, analista]);

  // ── Chart 7: Aperturas vs Renovaciones ───────────────────────────────────
  const apertVsRenData = useMemo(() => {
    const allVentas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    const allAnt = ventasMesAnt.filter(isVenta);
    return {
      porAnalista: analistasParaMostrar.map(analista => {
        const v = allVentas.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      porAnalistaAnt: analistasParaMostrar.map(analista => {
        const v = allAnt.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      total: { aperturas: allVentas.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allVentas.filter(r => r.tipo_cliente === 'Renovacion').length },
      ant: { aperturas: allAnt.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allAnt.filter(r => r.tipo_cliente === 'Renovacion').length },
    };
  }, [registros, selectedMes, selectedAnio, ventasMesAnt]);

  const chartAperturas = useMemo(() => {
    const labels = chartLabels;
    const actual = [...apertVsRenData.porAnalista.map(d => d.aperturas)];
    if (analista === 'PDV') actual.push(apertVsRenData.total.aperturas);

    const anterior = [...apertVsRenData.porAnalistaAnt.map(d => d.aperturas)];
    if (analista === 'PDV') anterior.push(apertVsRenData.ant.aperturas);

    return {
      labels,
      datasets: [
        { label: `Actual`, data: actual, backgroundColor: '#60a5fa', borderRadius: 4, maxBarThickness: 50 },
        { label: `Anterior`, data: anterior, backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: 4, maxBarThickness: 50 },
      ],
    };
  }, [chartLabels, apertVsRenData, analista]);

  const chartRenovaciones = useMemo(() => {
    const labels = chartLabels;
    const actual = [...apertVsRenData.porAnalista.map(d => d.renovaciones)];
    if (analista === 'PDV') actual.push(apertVsRenData.total.renovaciones);

    const anterior = [...apertVsRenData.porAnalistaAnt.map(d => d.renovaciones)];
    if (analista === 'PDV') anterior.push(apertVsRenData.ant.renovaciones);

    return {
      labels,
      datasets: [
        { label: `Actual`, data: actual, backgroundColor: '#a78bfa', borderRadius: 4, maxBarThickness: 50 },
        { label: `Anterior`, data: anterior, backgroundColor: 'rgba(76, 29, 149, 0.9)', borderRadius: 4, maxBarThickness: 50 },
      ],
    };
  }, [chartLabels, apertVsRenData, analista]);

  // ── Chart 8: % Empleo Público / Privado ──────────────────────────────────
  const empleoPublPrivData = useMemo(() => {
    const PUBLICO = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const ventas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    const ant = ventasMesAnt.filter(isVenta);
    const classify = (r: typeof ventas[0]) => {
      const e = (r.empleador ?? '').toLowerCase();
      return PUBLICO.some(k => e.includes(k)) ? 'Público' : e.trim() === '' || e === 'sin dato' ? 'No especificado' : 'Privado';
    };
    const counts: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    const countsAnt: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    ventas.forEach(r => counts[classify(r)]++);
    ant.forEach(r => countsAnt[classify(r)]++);
    return { counts, countsAnt };
  }, [registros, selectedMes, selectedAnio, ventasMesAnt]);

  const chartEmpleoPublPriv = useMemo(() => {
    const { counts } = empleoPublPrivData;
    const labels = ['Público', 'Privado', 'Sin dato'];
    const colors = ['#10b981', '#3b82f6', 'rgba(100,100,100,0.5)'];
    const filtered = labels.filter(l => (counts[l] ?? 0) > 0);
    return {
      labels: filtered,
      datasets: [{
        data: filtered.map(l => counts[l] ?? 0),
        backgroundColor: filtered.map(l => colors[labels.indexOf(l)]),
        borderWidth: 0,
        hoverOffset: 10,
        borderRadius: 4,
        spacing: 4
      }],
    };
  }, [empleoPublPrivData]);

  // ── Chart 10: % Total Conversión ─────────────────────────────────────────
  const chartConversionTotal = useMemo(() => {
    const labels = chartLabels;
    const actual = [...kpiPorAnalista.map(k => k.conversion)];
    if (analista === 'PDV') actual.push(kpiTotal.conversion);

    const anterior = [
      ...kpiPorAnalista.map(k => {
        const regsAnt = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista);
        const ventasAnt = regsAnt.filter(isVenta);
        return regsAnt.length > 0 ? (ventasAnt.length / regsAnt.length) * 100 : 0;
      })
    ];
    if (analista === 'PDV') {
      const regsAntTotal = filterByMonth(allRegistros, mesPrev, anioPrev);
      const ventasAntTotal = regsAntTotal.filter(isVenta);
      anterior.push(regsAntTotal.length > 0 ? (ventasAntTotal.length / regsAntTotal.length) * 100 : 0);
    }

    return {
      labels,
      datasets: [
        { label: `Conversión % ${mesActualLabel}`, data: actual, backgroundColor: 'rgba(251,191,36,0.8)', borderRadius: 4, order: 1 },
        { label: `Conversión % ${mesAntLabel}`, data: anterior, backgroundColor: 'rgba(124, 45, 18, 0.8)', borderRadius: 4, order: 1 },
        refLine100(labels.length),
      ],
    };
  }, [chartLabels, kpiPorAnalista, kpiTotal, allRegistros, mesPrev, anioPrev, mesActualLabel, mesAntLabel, analista]);

  // ── Chart 5: Embudo Comercial ────────────────────────────────────────────
  const chartEmbudo = useMemo(() => {
    const labels = analistasParaMostrar;
    const regsMes = filterByMonth(allRegistros, selectedMes, selectedAnio);
    const cerradas = labels.map(a => regsMes.filter(r => r.analista === a && isVenta(r)).length);
    
    return {
      labels: labels.map(a => a.toUpperCase()),
      datasets: [
        {
          data: cerradas,
          backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'],
          borderWidth: 0,
          hoverOffset: 10,
          borderRadius: 4,
          spacing: 4
        }
      ],
    };
  }, [registros, selectedMes, selectedAnio, isVenta]);

  // ── Chart 6: % Conversión de Presupuesto ──────────────────────────────────
  const chartConversionPresupuesto = useMemo(() => {
    const labels = analistasParaMostrar;
    const data = labels.map((a, i) => {
      const pres = ({})[a] ?? 0;
      const ops = kpiPorAnalista[i]?.ops ?? 0;
      return pres > 0 ? (ops / pres) * 100 : 0;
    });
    return {
      labels,
      datasets: [
        { label: '% Conv. Presupuesto → Venta', data, backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 4, order: 1 },
        refLine100(labels.length),
      ],
    };
  }, [({}), kpiPorAnalista, refLine100]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'40px'}}><div className="spinner"></div></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', paddingTop: '32px' }}>
      <style>{`
        .row-hover {
          transition: background 0.2s ease;
        }
        .row-hover:hover {
          background: rgba(255,255,255,0.02);
        }
      `}</style>

      {/* Toolbar Superior */}
      <div style={{ 
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '24px',
        padding: '24px 32px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.02)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <BarChart3 size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Vista Analistas</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Métricas detalladas por persona</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SelectReporte
              icon="user"
              value={analista}
              onChange={v => setAnalista(String(v))}
              options={[
                { label: 'Vista Global (PDV)', value: 'PDV' },
                ...CONFIG.ANALISTAS_DEFAULT.map(a => ({ label: a.toUpperCase(), value: a }))
              ]}
              width="220px"
            />
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '4px' }}>
              <select value={selectedMes} onChange={e => setSelectedMes(Number(e.target.value))} style={{ background: 'transparent', color: '#fff', border: 'none', padding: '8px 12px', outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}>
                {CONFIG.MESES_NOMBRES.map((m, i) => <option key={m} value={i + 1} style={{ background: '#111' }}>{m}</option>)}
              </select>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <select value={selectedAnio} onChange={e => setSelectedAnio(Number(e.target.value))} style={{ background: 'transparent', color: '#fff', border: 'none', padding: '8px 12px', outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}>
                {[2023, 2024, 2025, 2026].map(a => <option key={a} value={a} style={{ background: '#111' }}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── SECCIÓN 1: TABLERO ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#60a5fa" />)}
            {!collapsedSections[1] && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</div>
                    {tendBadge(kpiTotal.tendCapital)}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                    Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}
                  </div>
                  {kpiTotal.cumplCapital !== null && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: cumplColor(kpiTotal.cumplCapital) }}>
                      {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                    </div>
                  )}
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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
                    <div id="chart-capital-objetivo" style={{ height: 180 }}>
                      {(() => {
                        const opts = baseChartOpts('$', false, true, false);
                        return <Bar data={chartCapitalVsObjetivo as any} options={opts} plugins={[labelsPlugin, referenceLinesPlugin]} />;
                      })()}
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Operaciones</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{kpiTotal.ops}</div>
                    {tendBadge(kpiTotal.tendOps)}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                    Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}
                  </div>
                  {kpiTotal.cumplOps !== null && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: cumplColor(kpiTotal.cumplOps) }}>
                      {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                    </div>
                  )}
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Aperturas vs Renovaciones</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Aperturas</div>
                        <div id="chart-aperturas" style={{ height: 140, position: 'relative', width: '100%' }}>
                          <Bar data={chartAperturas} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin, referenceLinesPlugin]} />
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Renov.</div>
                        <div id="chart-renovaciones" style={{ height: 140, position: 'relative', width: '100%' }}>
                          <Bar data={chartRenovaciones} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin, referenceLinesPlugin]} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
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
                    <div id="chart-ticket-promedio" style={{ height: 180 }}>
                      <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin, referenceLinesPlugin]} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SECCIÓN 2: INDICADORES CLAVE ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader(2, '2. Indicadores', <Users size={15} color="#a78bfa" />)}
            {!collapsedSections[2] && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {(analista === 'PDV' ? [kpiTotal] : kpiPorAnalista).map((k, idx) => {
                    const isTotal = false;
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
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Capital</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{formatCurrency(k.capital)}</div>
                              {tendBadge(k.tendCapital)}
                            </div>
                            {k.cumplCapital !== null && (
                              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(k.cumplCapital, 100)}%`, background: cumplColor(k.cumplCapital), borderRadius: 2, transition: 'width 0.4s' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, color: cumplColor(k.cumplCapital), whiteSpace: 'nowrap' as const }}>{k.cumplCapital.toFixed(0)}%</span>
                              </div>
                            )}
                            {k.metaCapital > 0 && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>Meta {formatCurrency(k.metaCapital)}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Operaciones</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{k.ops}</div>
                              {tendBadge(k.tendOps)}
                            </div>
                            {k.cumplOps !== null && (
                              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(k.cumplOps, 100)}%`, background: cumplColor(k.cumplOps), borderRadius: 2, transition: 'width 0.4s' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, color: cumplColor(k.cumplOps), whiteSpace: 'nowrap' as const }}>{k.cumplOps.toFixed(0)}%</span>
                              </div>
                            )}
                            {k.metaOps > 0 && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>Meta {k.metaOps}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Ticket Prom.</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>{formatCurrency(k.ticket)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Conversión</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>{k.conversion.toFixed(1)}%</div>
                          </div>

                          {/* Nuevos indicadores solicitados */}
                          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Monto de Venta</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#ccc' }}>{formatCurrency(k.montoVenta)}</div>
                          </div>
                          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Aprob. CC</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#ccc' }}>{formatCurrency(k.montoAprobCC)}</div>
                          </div>
                          <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Cantidad de operaciones</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#888' }}>{k.clientesIngresados} <span style={{ fontSize: 10, fontWeight: 500, color: '#444' }}>registros totales</span></div>
                          </div>

                          <div style={{ gridColumn: 'span 2', paddingTop: 10, marginTop: 4, borderTop: '1px solid rgba(167,139,250,0.12)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '6px', background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Target size={14} color="#a78bfa" />
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
                                  {k.esMesActual ? 'Proyección a fin de mes' : 'Cierre del mes'}
                                </div>
                              </div>
                              {k.tieneDiasAdmin && k.esMesActual && (
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: 4 }}>
                                  {k.diasTransAdmin} / {k.diasHabilesAdmin} DÍAS
                                </div>
                              )}
                            </div>
                            {k.esMesActual && !k.tieneDiasAdmin ? (
                              <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', padding: '4px 0' }}>
                                Cargá días hábiles en Ajustes para ver proyección
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                                <div className="row-hover" style={{ display: 'flex', gap: 12, padding: '6px 8px', borderRadius: '6px' }}>
                                  <div style={{ flex: 1 }}>
                                    {k.metaDiariaCapital !== null && (
                                      <>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Venta / día ({k.esMesActual ? 'Necesario' : 'Meta'})</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#ccc' }}>{formatCurrency(k.metaDiariaCapital)}</div>
                                        {k.ventaPorDia !== null && <div style={{ fontSize: 9, color: '#444', fontWeight: 600, marginTop: 2 }}>RITMO: {formatCurrency(k.ventaPorDia)}</div>}
                                      </>
                                    )}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    {k.metaDiariaOps !== null && (
                                      <>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Ops. / día ({k.esMesActual ? 'Necesario' : 'Meta'})</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#ccc' }}>{k.metaDiariaOps.toFixed(1)}</div>
                                        {k.opsPorDia !== null && <div style={{ fontSize: 9, color: '#444', fontWeight: 600, marginTop: 2 }}>RITMO: {k.opsPorDia.toFixed(1)}</div>}
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="row-hover" style={{ display: 'flex', gap: 12, padding: '8px 8px 6px', borderRadius: '6px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div style={{ flex: 1 }}>
                                    {k.proyCapital !== null && (
                                      <>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>{k.esMesActual ? 'Proy. fin mes (K)' : 'Final mes (K)'}</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                          <div style={{ fontSize: 14, fontWeight: 800, color: k.esMesActual ? (k.proyCapital >= k.metaCapital ? '#10b981' : '#f87171') : '#ccc' }}>{formatCurrency(k.proyCapital)}</div>
                                          {k.cumplProyCapital !== null && (
                                            <span style={{ fontSize: 10, fontWeight: 800, color: k.esMesActual ? (k.cumplProyCapital >= 100 ? '#10b981' : '#f87171') : '#444' }}>
                                              ({k.cumplProyCapital.toFixed(0)}%)
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    {k.proyOps !== null && (
                                      <>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>{k.esMesActual ? 'Proy. fin mes (Q)' : 'Final mes (Q)'}</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                          <div style={{ fontSize: 14, fontWeight: 800, color: k.esMesActual ? (k.proyOps >= k.metaOps ? '#10b981' : '#f87171') : '#ccc' }}>{k.proyOps}</div>
                                          {k.cumplProyOps !== null && (
                                            <span style={{ fontSize: 10, fontWeight: 800, color: k.esMesActual ? (k.cumplProyOps >= 100 ? '#10b981' : '#f87171') : '#444' }}>
                                              ({k.cumplProyOps.toFixed(0)}%)
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="row-hover" style={{ display: 'flex', gap: 12, padding: '8px 8px 6px', borderRadius: '6px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div style={{ flex: 1 }}>
                                    {k.faltaCapital !== null && (
                                      <>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Falta 100% (K)</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: k.faltaCapital === 0 ? '#10b981' : '#f87171' }}>{formatCurrency(k.faltaCapital)}</div>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    {k.faltaOps !== null && (
                                      <>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Falta 100% (Q)</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: k.faltaOps === 0 ? '#10b981' : '#f87171' }}>{k.faltaOps}</div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {/* 1. Cumplimiento */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>% Cumplimiento — Actual vs {mesAntLabel}</div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(96,165,250,0.8)' }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                          </div>
                        </div>
                      </div>
                      <div id="chart-cumplimiento" style={{ height: 280 }}>
                        <Bar data={chartCumplimiento as any} options={baseChartOpts('%', false, true, false)} plugins={[labelsPlugin, referenceLinesPlugin]} />
                      </div>
                    </div>

                    {/* 2. Variación */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Variación % vs {mesAntLabel}</div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.7)' }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Positivo</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(248,113,113,0.7)' }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Negativo</span>
                          </div>
                        </div>
                      </div>
                      <div id="chart-variacion" style={{ height: 280 }}>
                        <Bar data={chartVariacion} options={baseChartOpts('%', false, true, false)} plugins={[labelsPlugin, referenceLinesPlugin]} />
                      </div>
                    </div>

                    {/* 3. Embudo */}
                    {/* 3. Acuerdos por Analista */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                          {analista === 'PDV' ? 'Distribución de Acuerdos (Total)' : `Acuerdos de ${analista}`}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                           <Users size={12} color="#666" />
                           <span style={{ fontSize: 9, fontWeight: 700, color: '#666' }}>
                             {analista === 'PDV' ? kpiTotal.ops : (kpiPorAnalista.find(k => k.analista === analista)?.ops ?? 0)} TOTAL
                           </span>
                        </div>
                      </div>
                      {(() => {
                        const isGlobal = analista === 'PDV';
                        const sourceRegs = filterByMonth(allRegistros, selectedMes, selectedAnio);
                        const regs = isGlobal ? sourceRegs : sourceRegs.filter(r => r.analista === analista);
                        
                        const categories = ['PREMIUM', 'Riesgo MEDIO', 'Riesgo BAJO', 'No califica'];
                        const bgColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
                        const displayLabels = categories;
                        
                        const displayData = categories.map(cat => {
                          return regs.filter(r => {
                             const ac = (r.acuerdo_precios || '').toLowerCase();
                             if (cat === 'PREMIUM') return ac.includes('premium');
                             if (cat === 'Riesgo MEDIO') return ac.includes('medio');
                             if (cat === 'Riesgo BAJO') return ac.includes('bajo');
                             if (cat === 'No califica') return ac.includes('no califica') || ac === 'n/c';
                             return false;
                          }).length;
                        });

                        const total = displayData.reduce((s, v) => s + v, 0);
                        const chartData = {
                          labels: displayLabels,
                          datasets: [{
                            data: displayData,
                            backgroundColor: bgColors,
                            borderWidth: 0,
                            hoverOffset: 10,
                            borderRadius: 4,
                            spacing: 4
                          }]
                        };

                        return (
                          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <ModernDoughnut data={chartData} total={total} label="Acuerdos" unit=" Ops" />
                            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                              {displayLabels.map((l, i) => {
                                const pct = total > 0 ? (displayData[i] / total * 100).toFixed(1) : '0';
                                return (
                                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: bgColors[i] }} />
                                    <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{l} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 4. Empleo */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <div style={{ width: 3, height: 12, background: '#34d399', borderRadius: 2 }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                          {analista === 'PDV' ? '% Empleo Público / Privado (Total)' : `% Empleo de ${analista}`}
                        </span>
                      </div>
                      {(() => {
                        const counts = chartEmpleoPublPriv.datasets[0].data as number[];
                        const total = counts.reduce((s, v) => s + v, 0);
                        
                        return (
                          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <ModernDoughnut data={chartEmpleoPublPriv} total={total} label="Total" unit=" Ops" />
                            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                              {chartEmpleoPublPriv.labels.map((l, i) => {
                                const val = counts[i];
                                const pct = total > 0 ? (val / total * 100).toFixed(1) : '0';
                                return (
                                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: (chartEmpleoPublPriv.datasets[0].backgroundColor as string[])[i] }} />
                                    <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{l} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── SECCIÓN 3: VENTAS POR CATEGORÍA ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <div style={{ flex: 1 }}>{sectionHeader(3, '3. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}</div>
              {!collapsedSections[3] && <span style={{ fontSize: 11, color: '#444', marginBottom: 20 }}>{ventasMes.length} ops · {formatCurrency(ventasMes.reduce((s, r) => s + (Number(r.monto) || 0), 0))}</span>}
            </div>
            {!collapsedSections[3] && ventasMes.length > 0 && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                {(() => {
                  const totalMes = ventasMes.reduce((s, r) => s + (Number(r.monto) || 0), 0);
                  return (
                    <>
                      <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#f97316" />} datos={distAcuerdos} color="#f97316" totalMes={totalMes} />
                      <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={distCuotas} color="#60a5fa" totalMes={totalMes} />
                      <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={distRangoEtario} color="#34d399" totalMes={totalMes} />
                      <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={distSexo} color="#f472b6" totalMes={totalMes} />
                      <DistBlock 
                        titulo="Empleador" 
                        icon={<Shield size={12} color="#fbbf24" />} 
                        datos={distEmpleador} 
                        color="#fbbf24" 
                        totalMes={totalMes}
                      />
                      <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={distLocalidad} color="#a78bfa" totalMes={totalMes} />
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── SECCIÓN 4: RENDIMIENTO DISTRIBUIDO POR ANALISTA Y TOTAL GENERAL ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader(4, '4. Distribucion por Estado', <PieChart size={15} color="#4ade80" />)}
            {!collapsedSections[4] && <MetricasTab selectedMes={selectedMes} selectedAnio={selectedAnio} registros={registros} analista={analista} />}
          </div>

          {/* ── SECCIÓN 5: RENDIMIENTO Y TENDENCIAS ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader(5, '5. Tendencia', <BarChart3 size={15} color="#60a5fa" />)}
            {!collapsedSections[5] && (
              <AnalisisTemporalTab 
                registros={allRegistros} 
                initialMonth={selectedMes} 
                initialYear={selectedAnio} 
                forcedAnalista={analista === 'PDV' ? 'todos' : analista}
                hideFilters={true}
                onStateChange={setSeccion10State} 
              />
            )}
          </div>

          {/* ── SECCIÓN 6: CÁLCULO DE INCENTIVOS ── */}
          {['luciana', 'victoria'].includes(analista.toLowerCase()) && (
            <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader(6, '6. Cálculo de Incentivos', <Calculator size={15} color="#a78bfa" />)}
            {!collapsedSections[6] && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
                  {/* Reglas de Capital */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Target size={14} /> Escala de Incentivos - Capital
                    </div>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ textAlign: 'left', padding: '10px 4px', color: '#aaa' }}>ALCANCE</th>
                          <th style={{ textAlign: 'right', padding: '10px 4px', color: '#aaa' }}>COEFICIENTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { a: '75% < 90%', c: '0.20%' },
                          { a: '90% < 110%', c: '0.30%' },
                          { a: '110% < 120%', c: '0.37%' },
                          { a: '>= 120%', c: '0.45%' },
                        ].map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px 4px', color: '#bbb' }}>{r.a}</td>
                            <td style={{ padding: '10px 4px', textAlign: 'right', color: '#fff', fontWeight: 800 }}>{r.c}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Reglas de Operaciones */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={14} /> Escala de Incentivos - Operaciones
                    </div>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ textAlign: 'left', padding: '10px 4px', color: '#aaa' }}>ALCANCE</th>
                          <th style={{ textAlign: 'right', padding: '10px 4px', color: '#aaa' }}>COEFICIENTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { a: '80% y 99.99%', c: '0.20%' },
                          { a: '>= 100%', c: '0.30%' },
                        ].map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px 4px', color: '#bbb' }}>{r.a}</td>
                            <td style={{ padding: '10px 4px', textAlign: 'right', color: '#fff', fontWeight: 800 }}>{r.c}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>
                      * Requiere alcance mínimo de 75% en Capital.
                    </div>
                  </div>

                  {/* Reglas de Cobranzas */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fb923c', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DollarSign size={14} /> Escala de Incentivos - Cobranzas
                    </div>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 4px', color: '#aaa' }}>CONCEPTO</th>
                          <th style={{ textAlign: 'left', padding: '8px 4px', color: '#aaa' }}>ALCANCE</th>
                          <th style={{ textAlign: 'right', padding: '8px 4px', color: '#aaa' }}>PREMIO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { n: 'TRAMO 90-119', a: '90% - 99.99%', p: '$12.643' },
                          { n: 'TRAMO 90-119', a: '>= 100%', p: '$16.667' },
                          { n: 'TRAMO 120-209', a: '90% - 99.99%', p: '$12.643' },
                          { n: 'TRAMO 120-209', a: '>= 100%', p: '$16.667' },
                          { n: 'REFINANCIACION', a: '90% - 109.99%', p: '$12.643' },
                          { n: 'REFINANCIACION', a: '>= 110%', p: '$16.667' },
                        ].map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px 4px', color: '#aaa', fontSize: 11 }}>{r.n}</td>
                            <td style={{ padding: '8px 4px', color: '#bbb' }}>{r.a}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', color: '#fff', fontWeight: 800 }}>{r.p}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 8, textTransform: 'uppercase' }}>Ingreso Manual de Cumplimiento (%)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>TR 90</div>
                          <input 
                            type="number" 
                            value={manualCobranzas.pctTr90 || ''} 
                            onChange={(e) => handleManualCobChange('pctTr90', e.target.value)}
                            style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4, padding: '6px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
                            placeholder="0%"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>TR 120</div>
                          <input 
                            type="number" 
                            value={manualCobranzas.pctTr120 || ''} 
                            onChange={(e) => handleManualCobChange('pctTr120', e.target.value)}
                            style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4, padding: '6px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
                            placeholder="0%"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>REFIN</div>
                          <input 
                            type="number" 
                            value={manualCobranzas.pctRefin || ''} 
                            onChange={(e) => handleManualCobChange('pctRefin', e.target.value)}
                            style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4, padding: '6px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
                            placeholder="0%"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de resultados por Analista */}
                <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)', padding: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Analista</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Vendido (K)</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Cumpl. (K)</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Incent. (K)</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Cumpl. (Q)</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Incent. (Q)</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Incent. (Cob)</th>
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(167, 139, 250, 0.05)' }}>Total Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiCards.filter(k => k.analista === 'PDV' || ['luciana', 'victoria'].includes(k.analista.toLowerCase())).map((k, idx) => (
                        <tr key={k.analista} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '18px 15px', fontSize: 13, fontWeight: 800, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {k.analista === 'PDV' ? 'TOTAL GENERAL' : k.analista.toUpperCase()}
                          </td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#eee', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency(k.capital)}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: k.cumplCapital && k.cumplCapital >= 75 ? '#10b981' : '#f87171', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{k.cumplCapital?.toFixed(1)}%</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency(k.incentivoCap)}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: k.cumplOps && k.cumplOps >= 80 ? '#10b981' : '#f87171', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{k.cumplOps?.toFixed(1)}%</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency(k.incentivoOps)}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency((k.incentivoCobTr90 || 0) + (k.incentivoCobTr120 || 0) + (k.incentivoCobRefin || 0))}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 15, color: '#fff', fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(167, 139, 250, 0.1)' }}>{formatCurrency(k.incentivoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          )}


        </div>
    </div>
  );
}