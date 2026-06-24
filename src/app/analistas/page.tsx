'use client';

import React, { useState, useMemo, memo, useEffect } from 'react';
import { useDeferredMount, ChartShimmer } from '@/components/ChartShimmer';
import { Registro, Objetivo, CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { formatCurrency } from '@/lib/utils';
import { tasaCierrePct, conversionTotalPct } from '@/lib/kpi-cierre';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useSettings, useAnalistas } from '@/features/settings/SettingsProvider';
import { useAuth } from '@/context/AuthContext';
import { BarChart3, Users, Activity, Shield, Target, FileText, PieChart, Tag, ChevronLeft, ChevronRight, Calculator, DollarSign, TrendingUp, X } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement, Filler
} from 'chart.js';
import MetricasTab from '@/app/ajustes/MetricasTab';
import CustomSelect from '@/components/CustomSelect';
import NuevaSeccionSheets from './NuevaSeccionSheets';
import { filterByMonth, isVenta, TIPOS_ACUERDO, emptyTiposAcuerdo, matchTipoAcuerdo, normalizarEmpleador, buildDistEmpleador } from '@/lib/registro-stats';
import ModernDoughnut from '@/components/charts/ModernDoughnut';
import DistBlock from '@/components/charts/DistBlock';
import ProyeccionCard from './ProyeccionCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement, Filler);

// ─ Plugin inline: sombreado para líneas ─
const lineShadowPlugin: any = {
  id: 'lineShadowPlugin',
  beforeDatasetDraw(chart: any, args: any) {
    const { ctx } = chart;
    ctx.save();
    if (args.index === 0) {
      ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    } else if (args.index === 1) {
      ctx.shadowColor = 'rgba(251, 146, 60, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }
  },
  afterDatasetDraw(chart: any) {
    chart.ctx.restore();
  }
};

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
      ctx.font = 'bold 11px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';

      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;

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
 
import { useSearchParams } from 'next/navigation';

const now = new Date();

const cumplColor = (pct: number | null) =>
  pct === null ? '#64748b' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

export default function AnalistasPage() {
  const { registros: allRegistros, loading } = useRegistros();
  const { objetivos } = useObjetivos();
  const { diasConfig } = useSettings();
  const { nombres: analistasDefault, cobraIncentivo } = useAnalistas();
  const { isAdmin } = useAuth();
  
  const searchParams = useSearchParams();
  const [analista, setAnalista] = useState<string>('PDV');

  useEffect(() => {
    const queryAnalista = searchParams?.get('analista');
    if (queryAnalista) {
      setAnalista(queryAnalista);
    } else {
      setAnalista('PDV');
    }
  }, [searchParams]);

  const chartsLoaded = useDeferredMount();
  const esVistaGlobal = analista === 'PDV' || analista === 'PROYECTADOS';

  const registros = useMemo(() => {
    return esVistaGlobal ? allRegistros : allRegistros.filter(r => r.analista === analista);
  }, [allRegistros, analista, esVistaGlobal]);

  const analistasParaMostrar = esVistaGlobal ? analistasDefault : [analista];
  const chartLabels = useMemo(() => {
    if (analista === 'PDV') {
      return ['TOTAL GENERAL'];
    }
    return ['INDIVIDUAL'];
  }, [analista]);

  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(now.getFullYear());
  // Selector independiente de la sección 4 (Distribución por Estado)
  const [sec4Mes, setSec4Mes] = useState<string>(String(now.getMonth() + 1).padStart(2, '0'));
  const [sec4Anio, setSec4Anio] = useState<number>(now.getFullYear());
  const [periodoSec3, setPeriodoSec3] = useState<'mensual' | 'total'>('mensual');
  const [periodoAcuerdos, setPeriodoAcuerdos] = useState<'mensual' | 'total'>('mensual');
  const [periodoEmpleo, setPeriodoEmpleo] = useState<'mensual' | 'total'>('mensual');
  const [rendimiento12MOpen, setRendimiento12MOpen] = useState(false);
  const [anioRendimiento, setAnioRendimiento] = useState<number | 'TODOS'>(now.getFullYear());
  const [mesRendimiento, setMesRendimiento] = useState<number | 'TODOS'>('TODOS');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [proyShowActual, setProyShowActual] = useState(true);
  const [proyShowProy, setProyShowProy] = useState(true);

  const aniosDisponiblesRendimiento = useMemo(() => {
    const set = new Set<number>();
    for (const r of registros) {
      const y = r.fecha?.slice(0, 4);
      if (y) set.add(Number(y));
    }
    for (const o of objetivos) set.add(o.anio);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [registros, objetivos]);

  const mesesAnioKQ = useMemo(() => {
    const buckets: { key: string; mes0: number; anio: number; label: string; monto: number; ops: number; metaK: number; metaQ: number }[] = [];
    
    const aniosToInclude = anioRendimiento === 'TODOS' ? aniosDisponiblesRendimiento.slice().sort((a,b) => a - b) : [anioRendimiento];
    const mesesToInclude = mesRendimiento === 'TODOS' ? Array.from({length: 12}, (_, i) => i) : [mesRendimiento as number];

    for (const y of aniosToInclude) {
      for (const m of mesesToInclude) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        buckets.push({ 
           key, 
           mes0: m, 
           anio: y, 
           label: anioRendimiento === 'TODOS' ? `${CONFIG.MESES_NOMBRES[m]} ${y}` : CONFIG.MESES_NOMBRES[m], 
           monto: 0, ops: 0, metaK: 0, metaQ: 0 
        });
      }
    }

    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const r of registros) {
      if (!(r.estado?.toLowerCase() === 'venta' || r.estado?.toLowerCase().includes('aprobado cc'))) continue;
      const k = r.fecha?.slice(0, 7);
      if (!k) continue;
      const i = idx.get(k);
      if (i === undefined) continue;
      buckets[i].monto += Number(r.monto) || 0;
      buckets[i].ops += 1;
    }
    for (const b of buckets) {
      const obj = objetivos.find(o => o.analista === analista && o.mes === b.mes0 && o.anio === b.anio);
      b.metaK = obj?.meta_ventas ?? 0;
      b.metaQ = obj?.meta_operaciones ?? 0;
    }
    return buckets;
  }, [registros, objetivos, analista, anioRendimiento, mesRendimiento, aniosDisponiblesRendimiento]);

  const [manualCobranzas, setManualCobranzas] = useState({
    pctTr90: 0,
    pctTr120: 0,
    pctRefin: 0
  });

  const handleManualCobChange = (key: string, val: string) => {
    const num = parseFloat(val) || 0;
    setManualCobranzas(prev => ({ ...prev, [key]: num }));
  };

  const tendBadge = (pct: number | null, showLabel = true) => {
    if (pct === null) return <span style={{ color: '#64748b' }}>—</span>;
    const color = pct >= 0 ? '#34d399' : '#f87171';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {showLabel && <span style={{ fontSize: 9, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>vs mes anterior</span>}
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, minWidth: '60px', justifyContent: 'center' }}>
          <span style={{ color }}>{pct >= 0 ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    );
  };

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => {
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 16, 
          paddingBottom: 10, 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          gap: 12,
          userSelect: 'none',
        }}
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
      // Tasa de cierre (efectividad) y conversión total del embudo — fórmula centralizada
      const conversion = tasaCierrePct(regsAnalista) ?? 0;
      const conversionGlobal = conversionTotalPct(regsAnalista) ?? 0;

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

      // Ticket promedio = total vendido (Venta + Aprob. CC) / dias transcurridos
      const ticket = diasTransAdmin > 0 ? capital / diasTransAdmin : 0;

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
      const proyOps = (esMesActual && tieneDiasAdmin && opsPorDia !== null) ? opsPorDia * diasHabilesAdmin : (esMesActual ? null : ops);
      const faltaCapital = metaCapital > 0 ? Math.max(0, metaCapital - capital) : null;
      const faltaOps = metaOps > 0 ? Math.max(0, metaOps - ops) : null;

      const cumplProyCapital = metaCapital > 0 ? (proyCapital !== null ? (proyCapital / metaCapital) * 100 : null) : null;
      const cumplProyOps = metaOps > 0 ? (proyOps !== null ? (proyOps / metaOps) * 100 : null) : null;

      // Cálculo de incentivos (analistas con incentivo)
      const tieneIncentivo = cobraIncentivo(analista);
      
      let coefCap = 0;
      let coefOps = 0;
      let incentivoCap = 0;
      let incentivoOps = 0;
      let topeKQAplicado = false;
      let topeKQExcedente = 0;

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

        const incentivoCapVariable = capital * coefCap;
        incentivoCap = incentivoCapVariable + 21470;
        
        // El incentivo de operaciones es un % del incentivo de capital VARIABLE (sin los 21470)
        incentivoOps = incentivoCapVariable * (coefOps === 0.0030 ? 0.30 : (coefOps === 0.0020 ? 0.20 : 0));

        // Tope máximo de $200,000 para Ventas (K y Q)
        const totalKQ = incentivoCap + incentivoOps;
        if (totalKQ > 200000) {
          topeKQAplicado = true;
          topeKQExcedente = totalKQ - 200000;
          const factor = 200000 / totalKQ;
          incentivoCap = incentivoCap * factor;
          incentivoOps = incentivoOps * factor;
        }
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

        // Tope máximo de $50,000 para Cobranzas
        const totalCobranzas = incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;
        if (totalCobranzas > 50000) {
          const factorCob = 50000 / totalCobranzas;
          incentivoCobTr90 = incentivoCobTr90 * factorCob;
          incentivoCobTr120 = incentivoCobTr120 * factorCob;
          incentivoCobRefin = incentivoCobRefin * factorCob;
        }
      }

      const incentivoTotal = incentivoCap + incentivoOps + incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;

      return {
        analista, capital, ops, ticket, conversion, conversionGlobal, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, tendCapital, tendOps,
        clientesIngresados: regsAnalista.length,
        montoVenta,
        montoAprobCC,
        ventaPorDia, opsPorDia, metaDiariaCapital, metaDiariaOps, proyCapital, proyOps, faltaCapital, faltaOps, esMesActual,
        diasHabilesAdmin, diasTransAdmin, tieneDiasAdmin,
        cumplProyCapital, cumplProyOps,
        coefCap, coefOps, incentivoCap, incentivoOps,
        topeKQAplicado, topeKQExcedente,
        incentivoCobTr90, incentivoCobTr120, incentivoCobRefin,
        pctTr90, pctTr120, pctRefin,
        incentivoTotal
      };
    });
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, manualCobranzas, analista, cobraIncentivo]);

  // ── KPI total ─────────────────────────────────────────────────────────────
  const kpiTotal = useMemo(() => {
    // Total usa el entry 'Todos' como fuente canonica; fallback al max sobre analistas si no existe
    const cfgTodos = diasConfig.find(d => d.analista === 'Todos');
    const diasTransMes = cfgTodos
      ? (Number(cfgTodos.dias_transcurridos) || 0)
      : Math.max(0, ...diasConfig.map(d => Number(d.dias_transcurridos) || 0));
    const regs = filterByMonth(registros, selectedMes, selectedAnio);
    const ventas = regs.filter(isVenta);
    const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const ops = ventas.length;
    // Ticket promedio = total vendido (Venta + Aprob. CC) / dias transcurridos
    const ticket = diasTransMes > 0 ? capital / diasTransMes : 0;
    const clientes = regs.length;
    // Tasa de cierre (efectividad) y conversión total del embudo — fórmula centralizada
    const conversion = tasaCierrePct(regs) ?? 0;
    const conversionGlobal = conversionTotalPct(regs) ?? 0;

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
    const ticketAnt = diasTransMes > 0 ? capitalAnt / diasTransMes : 0;
    const clientesAnt = regsAnt.length;
    const conversionAnt = tasaCierrePct(regsAnt) ?? 0;
    const conversionGlobalAnt = conversionTotalPct(regsAnt) ?? 0;

    const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
    const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;
    const tendTicket = ticketAnt > 0 ? ((ticket - ticketAnt) / ticketAnt) * 100 : null;
    const tendClientes = clientesAnt > 0 ? ((clientes - clientesAnt) / clientesAnt) * 100 : null;
    const tendConversion = conversionAnt > 0 ? ((conversion - conversionAnt) / conversionAnt) * 100 : null;
    const tendConversionGlobal = conversionGlobalAnt > 0 ? ((conversionGlobal - conversionGlobalAnt) / conversionGlobalAnt) * 100 : null;

    const analistaObjetivo = analista === 'PROYECTADOS' ? 'PDV' : analista;
    const obj = objetivos.find(o => o.analista === analistaObjetivo && o.mes === selectedMes - 1 && o.anio === selectedAnio);
    const metaCapital = obj?.meta_ventas ?? 0;
    const metaOps = obj?.meta_operaciones ?? 0;
    const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
    const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
    const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
    const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

    const hoy = new Date();
    const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
    const cfgDias = esVistaGlobal
      ? diasConfig.find(d => d.analista === 'Todos')
      : diasConfig.find(d => d.analista === analista);
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
    const proyOps = (esMesActual && tieneDiasAdmin && opsPorDia !== null) ? opsPorDia * diasHabilesAdmin : (esMesActual ? null : ops);
    const faltaCapital = metaCapital > 0 ? Math.max(0, metaCapital - capital) : null;
    const faltaOps = metaOps > 0 ? Math.max(0, metaOps - ops) : null;

    const cumplProyCapital = metaCapital > 0 ? (proyCapital !== null ? (proyCapital / metaCapital) * 100 : null) : null;
    const cumplProyOps = metaOps > 0 ? (proyOps !== null ? (proyOps / metaOps) * 100 : null) : null;

    // ── Mes anterior a la misma fecha (comparación acumulada al mismo día) ────
    // Día de corte: hoy si es el mes en curso, sino el último día con datos del mes seleccionado
    const diaCorte = esMesActual
      ? hoy.getDate()
      : (regs.reduce((max, r) => Math.max(max, Number(r.fecha?.slice(8, 10)) || 0), 0)
         || new Date(selectedAnio, selectedMes, 0).getDate());
    const ventasAntFecha = ventasAnt.filter(r => (Number(r.fecha?.slice(8, 10)) || 0) <= diaCorte);
    const capitalAntFecha = ventasAntFecha.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const opsAntFecha = ventasAntFecha.length;
    const varCapitalFecha = capitalAntFecha > 0 ? ((capital - capitalAntFecha) / capitalAntFecha) * 100 : null;
    const varOpsFecha = opsAntFecha > 0 ? ((ops - opsAntFecha) / opsAntFecha) * 100 : null;

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
      capital, ops, ticket, conversion, conversionGlobal, clientes, tendCapital, tendOps, tendTicket, tendClientes, tendConversion, tendConversionGlobal,
      metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, montoVenta, montoAprobCC,
      clientesIngresados: clientes,
      ventaPorDia, opsPorDia, metaDiariaCapital, metaDiariaOps, proyCapital, proyOps, faltaCapital, faltaOps, esMesActual,
      diasHabilesAdmin, diasTransAdmin, tieneDiasAdmin,
      cumplProyCapital, cumplProyOps,
      diaCorte, capitalAntFecha, opsAntFecha, varCapitalFecha, varOpsFecha,
      coefCap: 0, coefOps: 0, incentivoCap, incentivoOps,
      topeKQAplicado: kpiPorAnalista.some(k => k.topeKQAplicado),
      topeKQExcedente: kpiPorAnalista.reduce((s, k) => s + (k.topeKQExcedente || 0), 0),
      incentivoCobTr90, incentivoCobTr120, incentivoCobRefin,
      incentivoTotal
    };
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, analista, kpiPorAnalista]);

  // ── Distribución acuerdo de precios ──────────────────────────────────────
  const distribucionAcuerdos = useMemo(() => {
    const tipos = emptyTiposAcuerdo();
    for (const r of filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta)) {
      const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', true);
      if (matched) {
        tipos[matched].monto += Number(r.monto) || 0;
        tipos[matched].cantidad += 1;
      }
    }
    return tipos;
  }, [registros, selectedMes, selectedAnio]);

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

  const distEmpleador = useMemo(() => buildDistEmpleador(ventasMes.filter(isVenta)), [ventasMes]);

  const distCuotas = useMemo(() => distPor('cuotas', ventasMes.filter(isVenta)), [ventasMes]);
  const distRangoEtario = useMemo(() => distPor('rango_etario', ventasMes.filter(isVenta)), [ventasMes]);
  const distSexo = useMemo(() => distPor('sexo', ventasMes.filter(isVenta)), [ventasMes]);
  const distLocalidad = useMemo(() => distPor('localidad', ventasMes.filter(isVenta)), [ventasMes]);
  const distAcuerdos = useMemo(() => {
    return Object.entries(distribucionAcuerdos)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [distribucionAcuerdos]);

  // ── Distribuciones totales (todos los registros) ──────────────────────────
  const distCuotasTotal = useMemo(() => distPor('cuotas', registros.filter(isVenta)), [registros]);
  const distRangoEtarioTotal = useMemo(() => distPor('rango_etario', registros), [registros]);
  const distSexoTotal = useMemo(() => distPor('sexo', registros), [registros]);
  const distLocalidadTotal = useMemo(() => distPor('localidad', registros), [registros]);
  const distEmpleadorTotal = useMemo(() => buildDistEmpleador(registros), [registros]);
  const distAcuerdosTotal = useMemo(() => {
    const tipos = emptyTiposAcuerdo();
    for (const r of registros) {
      const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', isVenta(r));
      if (matched) { tipos[matched].monto += Number(r.monto) || 0; tipos[matched].cantidad += 1; }
    }
    return Object.entries(tipos).map(([label, data]) => ({ label, ...data })).sort((a, b) => b.cantidad - a.cantidad);
  }, [registros]);

  // ── Distribuciones mes anterior ───────────────────────────────────────────
  const ventasMesAnt = useMemo(() =>
    filterByMonth(registros, mesPrev, anioPrev),
    [registros, mesPrev, anioPrev]
  );

  // ── Config base de gráficos (dark theme) ─────────────────────────────────
  const mesActualLabel = CONFIG.MESES_NOMBRES[selectedMes - 1].slice(0, 3);
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1].slice(0, 3);

  // Helper: gradient
  const getGradient = (context: any, colorStart: string, colorEnd: string) => {
    const chart = context.chart;
    const { ctx, chartArea } = chart;
    if (!chartArea) return null;
    let horizontal = chart.config.options.indexAxis === 'y';
    const gradient = horizontal 
      ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
      : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };

  const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false, hideXLabels = false): any => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    layout: { padding: { top: showLabels ? 50 : 20, bottom: 0 } },
    _isPct: yLabel.includes('%'), // Flag explícito para el plugin
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        align: 'end' as const,
        labels: { color: '#666', font: { size: 10 }, usePointStyle: true, padding: 10 }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 18, weight: 900, family: "'Outfit', sans-serif" },
        titleAlign: 'center' as const,
        titleMarginBottom: 16,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 15, weight: 600, family: "'Outfit', sans-serif" },
        bodySpacing: 10,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        padding: 24,
        cornerRadius: 16,
        boxPadding: 8,
        usePointStyle: true,
      },
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
        display: !hideXLabels,
        stacked,
        ticks: {
          display: !hideXLabels,
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
    () => (esVistaGlobal ? [kpiTotal] : kpiPorAnalista),
    [esVistaGlobal, kpiTotal, kpiPorAnalista]
  );

  const chartCumplimiento = useMemo(() => {
    const labels = kpiCards.map(k => k.analista);
    return {
      labels,
      datasets: [
        {
          label: `Capital ${mesActualLabel}`,
          data: kpiCards.map(k => k.cumplCapital ?? 0),
          backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'),
          borderColor: '#10b981',
          borderWidth: 0,
          borderRadius: 4, order: 1,
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
          backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0,
          borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesActualLabel}`,
          data: kpiCards.map(k => k.cumplOps ?? 0),
          backgroundColor: (context: any) => getGradient(context, 'rgba(6, 182, 212, 0.05)', 'rgba(6, 182, 212, 0.85)'),
          borderColor: '#06b6d4',
          borderWidth: 0,
          borderRadius: 4, order: 1,
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
          backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0,
          borderRadius: 4, order: 1, // Purpura oscuro
        },
        refLine100(labels.length),
      ],
    };
  }, [kpiCards, registros, objetivos, mesPrev, anioPrev, mesActualLabel, mesAntLabel]);

  // ── Chart 1: Capital vs Objetivo ──────────────────────────────────────────
  const chartCapitalVsObjetivo = useMemo(() => {
    const labels = chartLabels;
    const isSingle = labels.length === 1;

    const isPDV = analista === 'PDV';

    const capitalAct = isPDV ? [kpiTotal.capital] : kpiPorAnalista.map(k => k.capital);

    const capitalAnt = isPDV
      ? [filterByMonth(allRegistros, mesPrev, anioPrev).filter(isVenta).reduce((s, r) => s + (Number(r.monto) || 0), 0)]
      : kpiPorAnalista.map(k => {
          const ant = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
          return ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
        });

    const objetivo = isPDV ? [kpiTotal.metaCapital || 0] : kpiPorAnalista.map(k => k.metaCapital || 0);

    const cumplimiento = isPDV ? [kpiTotal.cumplCapital || 0] : kpiPorAnalista.map(k => k.cumplCapital || 0);

    return {
      labels,
      datasets: [
        { label: `Capital ${mesActualLabel}`, data: capitalAct, backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'), borderColor: '#10b981', borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
        { label: `Capital ${mesAntLabel}`, data: capitalAnt, backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'), borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
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
    const isPDV = analista === 'PDV';

    const ticketAct = isPDV ? [kpiTotal.ticket] : kpiPorAnalista.map(k => k.ticket);

    const ticketAnt = isPDV
      ? (() => {
          const vAnt = filterByMonth(allRegistros, mesPrev, anioPrev).filter(isVenta);
          return [vAnt.length > 0 ? vAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0) / vAnt.length : 0];
        })()
      : kpiPorAnalista.map(k => {
          const ant = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
          const cap = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
          return ant.length > 0 ? cap / ant.length : 0;
        });

    return {
      labels,
      datasets: [
        { label: `Ticket ${mesActualLabel}`, data: ticketAct, backgroundColor: (context: any) => getGradient(context, 'rgba(245, 158, 11, 0.05)', 'rgba(245, 158, 11, 0.85)'), borderColor: '#f59e0b', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
        { label: `Ticket ${mesAntLabel}`, data: ticketAnt, backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'), borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
      ],
    };
  }, [chartLabels, kpiPorAnalista, kpiTotal, allRegistros, mesPrev, anioPrev, mesActualLabel, mesAntLabel, analista]);

  // ── Chart 4: Variación % vs mes anterior ─────────────────────────────────
  const chartVariacion = useMemo(() => {
    const isGlobal = analista === 'PDV';
    const labels = isGlobal ? ['TOTAL GENERAL'] : ['INDIVIDUAL'];
    
    const capitalVar = isGlobal ? [kpiTotal.tendCapital ?? 0] : [kpiPorAnalista[0]?.tendCapital ?? 0];
    const opsVar = isGlobal ? [kpiTotal.tendOps ?? 0] : [kpiPorAnalista[0]?.tendOps ?? 0];

    return {
      labels,
      datasets: [
        { 
          label: 'Variación Capital %', 
          data: capitalVar, 
          backgroundColor: capitalVar.map(v => v >= 0 ? 'rgba(45, 212, 191, 0.2)' : 'rgba(239, 68, 68, 0.1)'), 
          borderColor: capitalVar.map(v => v >= 0 ? 'rgba(45, 212, 191, 0.5)' : 'rgba(239, 68, 68, 0.4)'),
          borderWidth: 1.5,
          borderRadius: 4, 
          maxBarThickness: 100 
        },
        { 
          label: 'Variación Ops %', 
          data: opsVar, 
          backgroundColor: opsVar.map(v => v >= 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(239, 68, 68, 0.1)'), 
          borderColor: opsVar.map(v => v >= 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(239, 68, 68, 0.4)'),
          borderWidth: 1.5,
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

  const chartProgreso = useMemo(() => {
    const regsMes = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    
    const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
    const today = new Date();
    const isCurrentMonth = selectedMes === (today.getMonth() + 1) && selectedAnio === today.getFullYear();
    const maxDay = isCurrentMonth ? today.getDate() : daysInMonth;

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    
    let cumulative = 0;
    const dailyData: (number | null)[] = [];
    const realData = labels.map((_, i) => {
      const day = i + 1;
      if (day > maxDay) {
        dailyData.push(null);
        return null;
      }
      const dayRegs = regsMes.filter(r => {
        if (!r.fecha) return false;
        const d = new Date(r.fecha + 'T12:00:00');
        return d.getDate() === day;
      });
      const dayTotal = dayRegs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      dailyData.push(dayTotal);
      cumulative += dayTotal;
      return cumulative;
    });

    const meta = kpiTotal.metaCapital;
    const idealData = labels.map((_, i) => (meta / daysInMonth) * (i + 1));

    return {
      labels,
      datasets: [
        {
          label: 'Vendido',
          data: realData,
          dailyData,
          borderColor: '#10b981',
          borderWidth: 2,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#10b981',
          pointRadius: 2,
          fill: false,
          tension: 0.2
        },
        {
          label: 'Ideal',
          data: idealData,
          borderColor: '#fb923c',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    };
  }, [registros, selectedMes, selectedAnio, kpiTotal.metaCapital]);

  // Progreso vs Ideal por separado: PDV + cada analista, cada uno con SU propio Ideal.
  const chartsProgresoSep = useMemo(() => {
    const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
    const today = new Date();
    const isCurrentMonth = selectedMes === (today.getMonth() + 1) && selectedAnio === today.getFullYear();
    const maxDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

    const regsMes = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);

    const cumFor = (pred: (r: typeof regsMes[number]) => boolean): (number | null)[] => {
      let cum = 0;
      return labels.map((_, i) => {
        const day = i + 1;
        if (day > maxDay) return null;
        const dayTotal = regsMes.reduce((s, r) => {
          if (!r.fecha || !pred(r)) return s;
          return new Date(r.fecha + 'T12:00:00').getDate() === day ? s + (Number(r.monto) || 0) : s;
        }, 0);
        cum += dayTotal;
        return cum;
      });
    };

    const buildChart = (pred: (r: typeof regsMes[number]) => boolean, meta: number) => ({
      labels,
      datasets: [
        {
          label: 'Vendido', data: cumFor(pred), borderColor: '#10b981', borderWidth: 2,
          pointBackgroundColor: '#10b981', pointBorderColor: '#10b981', pointRadius: 2, fill: false, tension: 0.2,
        },
        {
          label: 'Ideal', data: labels.map((_, i) => (meta / daysInMonth) * (i + 1)),
          borderColor: '#fb923c', borderWidth: 1, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0,
        },
      ],
    });

    const metaDe = (a: string) => kpiPorAnalista.find(k => k.analista === a)?.metaCapital ?? 0;

    return [
      { titulo: 'PDV (Total)', data: buildChart(() => true, kpiTotal.metaCapital) },
      ...analistasDefault.map(a => ({ titulo: a, data: buildChart(r => r.analista === a, metaDe(a)) })),
    ];
  }, [registros, selectedMes, selectedAnio, kpiTotal.metaCapital, kpiPorAnalista, analistasDefault]);

  const chartProgresoSepOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: '#ccc', font: { size: 10 }, usePointStyle: true } },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#fff', bodyColor: '#f1f5f9', padding: 16, cornerRadius: 12, usePointStyle: true,
        callbacks: {
          title: (items: any[]) => `Día ${items[0].label}`,
          label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 9 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 9 }, callback: (v: any) => formatCurrency(v) } },
    },
  };

  const chartProgresoOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: '#ccc', font: { size: 10 } } },
      tooltip: {
        itemSort: (a: any, b: any) => b.datasetIndex - a.datasetIndex,
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 18, weight: 900, family: "'Outfit', sans-serif" },
        titleAlign: 'center' as const,
        titleMarginBottom: 16,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 15, weight: 600, family: "'Outfit', sans-serif" },
        bodySpacing: 10,
        footerColor: (ctx: any) => {
          const tooltipItems = ctx.tooltip.dataPoints;
          if (!tooltipItems || !tooltipItems[0]) return '#34d399';
          const index = tooltipItems[0].dataIndex;
          const vendido = tooltipItems[0].chart.data.datasets[0].data[index];
          const ideal = tooltipItems[0].chart.data.datasets[1].data[index];
          if (vendido == null || ideal == null || ideal === 0) return '#34d399';
          const pct = ((vendido / ideal) - 1) * 100;
          return pct < 0 ? '#f87171' : '#34d399';
        },
        footerFont: { size: 16, weight: 900, family: "'Outfit', sans-serif" },
        footerMarginTop: 16,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        padding: 24,
        cornerRadius: 16,
        boxPadding: 8,
        usePointStyle: true,
        callbacks: {
          title: (tooltipItems: any[]) => {
            return `Día ${tooltipItems[0].label}`;
          },
          label: (ctx: any) => {
            const v = ctx.raw;
            if (ctx.datasetIndex === 0) {
              const daily = ctx.dataset.dailyData?.[ctx.dataIndex];
              if (daily != null) {
                return [
                  ` Acumulado: ${formatCurrency(v)}`,
                  ` ↳ Venta del día: ${formatCurrency(daily)}`
                ];
              }
              return ` Acumulado: ${formatCurrency(v)}`;
            }
            return ` Ideal: ${formatCurrency(v)}`;
          },
          footer: (tooltipItems: any[]) => {
             const index = tooltipItems[0].dataIndex;
             const vendido = tooltipItems[0].chart.data.datasets[0].data[index];
             const ideal = tooltipItems[0].chart.data.datasets[1].data[index];
             if (vendido == null || ideal == null || ideal === 0) return '';
             const pct = ((vendido / ideal) - 1) * 100;
             const sign = pct > 0 ? '+' : '';
             return `➔ Variación: ${sign}${pct.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 9 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 9 }, callback: (v: any) => formatCurrency(v) } }
    },
    interaction: { mode: 'index' as const, intersect: false }
  };

  const chartAperturas = useMemo(() => {
    const labels = chartLabels;
    const isPDV = analista === 'PDV';
    const actual = isPDV ? [apertVsRenData.total.aperturas] : apertVsRenData.porAnalista.map(d => d.aperturas);
    const anterior = isPDV ? [apertVsRenData.ant.aperturas] : apertVsRenData.porAnalistaAnt.map(d => d.aperturas);

    return {
      labels,
      datasets: [
        { label: `Actual`, data: actual, backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'), borderColor: '#10b981', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
        { label: `Anterior`, data: anterior, backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'), borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
      ],
    };
  }, [chartLabels, apertVsRenData, analista]);

  const chartRenovaciones = useMemo(() => {
    const labels = chartLabels;
    const isPDV = analista === 'PDV';
    const actual = isPDV ? [apertVsRenData.total.renovaciones] : apertVsRenData.porAnalista.map(d => d.renovaciones);
    const anterior = isPDV ? [apertVsRenData.ant.renovaciones] : apertVsRenData.porAnalistaAnt.map(d => d.renovaciones);

    return {
      labels,
      datasets: [
        { label: `Actual`, data: actual, backgroundColor: (context: any) => getGradient(context, 'rgba(59, 130, 246, 0.05)', 'rgba(59, 130, 246, 0.85)'), borderColor: '#3b82f6', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
        { label: `Anterior`, data: anterior, backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'), borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
      ],
    };
  }, [chartLabels, apertVsRenData, analista]);

  // ── Chart 8: % Empleo Público / Privado ──────────────────────────────────
  const empleoPublPrivData = useMemo(() => {
    const PUBLICO = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const ventas = periodoEmpleo === 'mensual' ? ventasMes.filter(isVenta) : registros;
    const classify = (r: typeof ventas[0]) => {
      const e = (r.empleador ?? '').toLowerCase();
      return PUBLICO.some(k => e.includes(k)) ? 'Público' : e.trim() === '' || e === 'sin dato' ? 'Sin dato' : 'Privado';
    };
    const counts: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    ventas.forEach(r => counts[classify(r)]++);
    return { counts };
  }, [registros, ventasMes, periodoEmpleo]);

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
        borderRadius: '16px',
        padding: '12px 24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.02)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <BarChart3 size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                {analista === 'PDV' ? 'PDV' : analista.charAt(0).toUpperCase() + analista.slice(1).toLowerCase()}
              </div>
              <div style={{ fontSize: 13, color: '#8f929d', marginTop: 2 }}>Métricas</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CustomSelect
              value={analista}
              onChange={val => setAnalista(String(val))}
              options={[
                { label: 'PDV', value: 'PDV' },
                ...analistasDefault.map(a => ({ label: a, value: a })),
                ...(isAdmin ? [{ label: '📊 Proyectados', value: 'PROYECTADOS' }] : []),
              ]}
              width="150px"
            />
            <CustomSelect
              value={selectedMes}
              onChange={val => setSelectedMes(Number(val))}
              options={CONFIG.MESES_NOMBRES.map((m, i) => ({ label: m, value: i + 1 }))}
              width="150px"
            />
            <CustomSelect
              value={selectedAnio}
              onChange={val => setSelectedAnio(Number(val))}
              options={Array.from({ length: new Date().getFullYear() + 1 - 2016 + 1 }, (_, i) => 2016 + i).map(a => ({ label: String(a), value: a }))}
              width="110px"
            />
          </div>
        </div>
      </div>

            {analista === 'PROYECTADOS' && isAdmin ? (
              <>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                {[
                  { label: 'Situación actual', open: proyShowActual, toggle: () => setProyShowActual(v => !v) },
                  { label: 'Proyección fin de mes', open: proyShowProy, toggle: () => setProyShowProy(v => !v) },
                ].map(({ label, open, toggle }) => (
                  <button
                    key={label}
                    onClick={toggle}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: open ? 'rgba(255,255,255,0.04)' : 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: open ? '#e2e8f0' : '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}
                  >
                    <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'stretch' }}>
                {(() => {
                  // Venta ideal a la fecha = meta / días del mes * día actual (misma fórmula que el gráfico "Progreso vs Ideal")
                  const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
                  const hoyIdeal = new Date();
                  const esMesActualIdeal = selectedMes === (hoyIdeal.getMonth() + 1) && selectedAnio === hoyIdeal.getFullYear();
                  const diaActualIdeal = esMesActualIdeal ? hoyIdeal.getDate() : daysInMonth;
                  const idealFecha = (k: any) => (k.metaCapital > 0 ? (k.metaCapital / daysInMonth) * diaActualIdeal : null);
                  // El General se compone como suma de los individuales para que sea coherente
                  // (Necesario/día, Promedio/día e Ideal del total = suma de Luciana + Victoria)
                  const sum = (f: string) => kpiPorAnalista.reduce((s, k: any) => s + (k[f] ?? 0), 0);
                  const anyIdeal = kpiPorAnalista.some(k => idealFecha(k) !== null);
                  const pdvCard = {
                    ...kpiTotal,
                    metaDiariaCapital: sum('metaDiariaCapital'),
                    metaDiariaOps: sum('metaDiariaOps'),
                    ventaPorDia: sum('ventaPorDia'),
                    opsPorDia: sum('opsPorDia'),
                    ventaIdealFecha: anyIdeal ? kpiPorAnalista.reduce((s, k) => s + (idealFecha(k) ?? 0), 0) : null,
                  };
                  const cards = [
                    { kpi: pdvCard, titulo: 'PDV (Total General)' },
                    ...kpiPorAnalista.map((k: any) => ({ kpi: { ...k, ventaIdealFecha: idealFecha(k) }, titulo: k.analista })),
                  ];
                  return cards.map(({ kpi, titulo }) => (
                    <ProyeccionCard key={titulo} kpi={kpi} titulo={titulo} showActual={proyShowActual} showProy={proyShowProy} />
                  ));
                })()}
              </div>

              {/* ── Progreso vs Ideal por separado (PDV + cada analista, con su propio Ideal) ── */}
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                {chartsProgresoSep.map(({ titulo, data }) => (
                  <div key={titulo} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 }}>Progreso vs Ideal — {titulo}</div>
                    <div style={{ minHeight: 240, position: 'relative', width: '100%' }}>
                      {chartsLoaded ? (
                        <Line data={data} options={chartProgresoSepOptions as any} plugins={[lineShadowPlugin]} />
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </>
            ) : (
              <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── SECCIÓN 1: TABLERO ── */}
          <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>
              <button
                type="button"
                onClick={() => setRendimiento12MOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  boxShadow: '0 0 10px rgba(255,255,255,0.1)',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                <TrendingUp size={13} /> Rendimiento Histórico
              </button>
            </div>
            {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#60a5fa" />)}
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</div>
                    {tendBadge(kpiTotal.tendCapital)}
                  </div>
                  <div style={{ fontSize: 12, color: '#8f929d', marginBottom: 2 }}>
                    Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}
                  </div>
                  {kpiTotal.cumplCapital !== null && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                      <span style={{ color: cumplColor(kpiTotal.cumplCapital), marginRight: 4 }}>●</span>
                      {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                    </div>
                  )}
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Capital vs Objetivo</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(96,165,250,0.8)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div id="chart-capital-objetivo" style={{ height: 180 }}>
                      {chartsLoaded ? (
                        (() => {
                          const opts = baseChartOpts('$', false, true, false, false, analista !== 'PDV');
                          return <Bar data={chartCapitalVsObjetivo as any} options={opts} plugins={[labelsPlugin, referenceLinesPlugin]} />;
                        })()
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Operaciones</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{kpiTotal.ops}</div>
                    {tendBadge(kpiTotal.tendOps)}
                  </div>
                  <div style={{ fontSize: 12, color: '#8f929d', marginBottom: 2 }}>
                    Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}
                  </div>
                  {kpiTotal.cumplOps !== null && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                      <span style={{ color: cumplColor(kpiTotal.cumplOps), marginRight: 4 }}>●</span>
                      {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                    </div>
                  )}
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Aperturas vs Renovaciones</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Aperturas</div>
                        <div id="chart-aperturas" style={{ height: 180, position: 'relative', width: '100%' }}>
                          {chartsLoaded ? (
                            <Bar data={chartAperturas} options={baseChartOpts(' ops', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                          ) : (
                            <ChartShimmer />
                          )}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Renov.</div>
                        <div id="chart-renovaciones" style={{ height: 180, position: 'relative', width: '100%' }}>
                          {chartsLoaded ? (
                            <Bar data={chartRenovaciones} options={baseChartOpts(' ops', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                          ) : (
                            <ChartShimmer />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</div>
                    {tendBadge(kpiTotal.tendTicket)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: '#8f929d' }} title="Avance del pipeline: (Venta + Aprob. CC) / (Venta + Aprob. CC + Proyección + En seguimiento + Score bajo + Afectaciones + Rechaz. CC)">Conversión total: {kpiTotal.conversionGlobal.toFixed(1)}%</div>
                    {tendBadge(kpiTotal.tendConversionGlobal, false)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: '#8f929d' }} title="Efectividad comercial: (Venta + Aprob. CC) / (Venta + Aprob. CC + Rechaz. CC)">Tasa de cierre (efectividad): {kpiTotal.conversion.toFixed(1)}%</div>
                    {tendBadge(kpiTotal.tendConversion, false)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: '#8f929d' }}>{kpiTotal.clientes} clientes ingresados</div>
                    {tendBadge(kpiTotal.tendClientes, false)}
                  </div>
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Análisis vs {mesAntLabel}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.8)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(6, 78, 59, 0.9)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div id="chart-ticket-promedio" style={{ height: 180 }}>
                      {chartsLoaded ? (
                        <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                </div>
              </div>

                {/* ── BLOQUE DE PROYECCIÓN ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginTop: 12, alignItems: 'stretch' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '24px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {kpiTotal.esMesActual && !kpiTotal.tieneDiasAdmin ? (
                      <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
                        Cargá días hábiles en Ajustes para ver proyección
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 32, flex: 1 }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 2, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 32 }}>
                          <div style={{ flex: 1 }}>
                            {kpiTotal.metaDiariaCapital !== null && (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>Venta / día ({kpiTotal.esMesActual ? 'Necesario' : 'Meta'})</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.metaDiariaCapital)}</div>
                                {kpiTotal.ventaPorDia !== null && <div style={{ fontSize: 10, color: '#555', fontWeight: 700, marginTop: 4 }}>RITMO: {formatCurrency(kpiTotal.ventaPorDia)}</div>}
                              </>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            {kpiTotal.metaDiariaOps !== null && (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>Ops. / día ({kpiTotal.esMesActual ? 'Necesario' : 'Meta'})</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{Math.round(kpiTotal.metaDiariaOps)}</div>
                                {kpiTotal.opsPorDia !== null && <div style={{ fontSize: 10, color: '#555', fontWeight: 700, marginTop: 4 }}>RITMO: {Math.round(kpiTotal.opsPorDia)}</div>}
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />

                        <div style={{ display: 'flex', gap: 32 }}>
                          <div style={{ flex: 1 }}>
                            {kpiTotal.proyCapital !== null && (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>{kpiTotal.esMesActual ? 'Proy. fin mes (K)' : 'Final mes (K)'}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                  <div style={{ fontSize: 20, fontWeight: 900, color: kpiTotal.proyCapital >= kpiTotal.metaCapital ? '#10b981' : '#f87171' }}>{formatCurrency(kpiTotal.proyCapital)}</div>
                                  {kpiTotal.cumplProyCapital !== null && (
                                    <span style={{ fontSize: 12, fontWeight: 800, color: kpiTotal.cumplProyCapital >= 100 ? '#10b981' : '#f87171' }}>
                                      ({kpiTotal.cumplProyCapital.toFixed(2)}%)
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            {kpiTotal.proyOps !== null && (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>{kpiTotal.esMesActual ? 'Proy. fin mes (Q)' : 'Final mes (Q)'}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                  <div style={{ fontSize: 20, fontWeight: 900, color: kpiTotal.proyOps >= kpiTotal.metaOps ? '#10b981' : '#f87171' }}>{Math.round(kpiTotal.proyOps)}</div>
                                  {kpiTotal.cumplProyOps !== null && (
                                    <span style={{ fontSize: 12, fontWeight: 800, color: kpiTotal.cumplProyOps >= 100 ? '#10b981' : '#f87171' }}>
                                      ({kpiTotal.cumplProyOps.toFixed(2)}%)
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />

                        <div style={{ display: 'flex', gap: 32 }}>
                          <div style={{ flex: 1 }}>
                            {kpiTotal.faltaCapital !== null && (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>Falta 100% (K)</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: kpiTotal.faltaCapital === 0 ? '#10b981' : '#f87171' }}>{formatCurrency(kpiTotal.faltaCapital)}</div>
                              </>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            {kpiTotal.faltaOps !== null && (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>Falta 100% (Q)</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: kpiTotal.faltaOps === 0 ? '#10b981' : '#f87171' }}>{Math.round(kpiTotal.faltaOps || 0)}</div>
                              </>
                            )}
                          </div>
                        </div>

                       </div>

                       <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

                       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
                         <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
                           {CONFIG.MESES_NOMBRES[mesPrev - 1]} al día {kpiTotal.diaCorte}
                         </div>
                         <div>
                           <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>Ventas (K)</div>
                           <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                             <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capitalAntFecha)}</div>
                             {kpiTotal.varCapitalFecha !== null && (
                               <span style={{ fontSize: 12, fontWeight: 800, color: kpiTotal.varCapitalFecha >= 0 ? '#10b981' : '#f87171' }}>
                                 {kpiTotal.varCapitalFecha >= 0 ? '▲' : '▼'} {Math.abs(kpiTotal.varCapitalFecha).toFixed(2)}%
                               </span>
                             )}
                           </div>
                         </div>
                         <div>
                           <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>Operaciones (Q)</div>
                           <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                             <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{kpiTotal.opsAntFecha}</div>
                             {kpiTotal.varOpsFecha !== null && (
                               <span style={{ fontSize: 12, fontWeight: 800, color: kpiTotal.varOpsFecha >= 0 ? '#10b981' : '#f87171' }}>
                                 {kpiTotal.varOpsFecha >= 0 ? '▲' : '▼'} {Math.abs(kpiTotal.varOpsFecha).toFixed(2)}%
                               </span>
                             )}
                           </div>
                         </div>
                       </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '24px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 }}>Progreso vs Ideal</div>
                    <div style={{ flex: 1, minHeight: 220, position: 'relative', width: '100%' }}>
                      {chartsLoaded ? (
                        <Line data={chartProgreso} options={chartProgresoOptions as any} plugins={[lineShadowPlugin]} />
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                </div>
                </>
              </div>

          {/* ── SECCIÓN 2: GRÁFICOS ── */}
          <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            {sectionHeader(2, '2. Gráficos', <BarChart3 size={15} color="#a78bfa" />)}
              <>
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
                        {chartsLoaded ? (
                          <Bar data={chartCumplimiento as any} options={baseChartOpts('%', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                        ) : (
                          <ChartShimmer />
                        )}
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
                        {chartsLoaded ? (
                          <Bar data={chartVariacion} options={baseChartOpts('%', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                        ) : (
                          <ChartShimmer />
                        )}
                      </div>
                    </div>

                    {/* 3. Embudo */}
                    {/* 3. Acuerdos por Analista */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                          Distribución de Acuerdos
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setPeriodoAcuerdos('mensual')}
                            style={{
                              padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                              fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                              background: periodoAcuerdos === 'mensual' ? '#fb923c' : 'transparent',
                              color: periodoAcuerdos === 'mensual' ? '#000' : '#666',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            MES
                          </button>
                          <button
                            onClick={() => setPeriodoAcuerdos('total')}
                            style={{
                              padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                              fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                              background: periodoAcuerdos === 'total' ? '#fb923c' : 'transparent',
                              color: periodoAcuerdos === 'total' ? '#000' : '#666',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            TOTAL
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const regs = periodoAcuerdos === 'mensual' ? ventasMes.filter(isVenta) : registros;
                        
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

                        return chartsLoaded ? (
                          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <ModernDoughnut data={chartData} label="Acuerdos" value={`${total} Ops`} padding={36} height="220px" width="220px" labelSize={8} valueSize={15} />
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
                        ) : (
                          <ChartShimmer style={{ height: 280 }} />
                        );
                      })()}
                    </div>

                    {/* 4. Empleo */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 3, height: 12, background: '#34d399', borderRadius: 2 }} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                            % Empleo Público / Privado
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setPeriodoEmpleo('mensual')}
                            style={{
                              padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                              fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                              background: periodoEmpleo === 'mensual' ? '#fb923c' : 'transparent',
                              color: periodoEmpleo === 'mensual' ? '#000' : '#666',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            MES
                          </button>
                          <button
                            onClick={() => setPeriodoEmpleo('total')}
                            style={{
                              padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                              fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                              background: periodoEmpleo === 'total' ? '#fb923c' : 'transparent',
                              color: periodoEmpleo === 'total' ? '#000' : '#666',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            TOTAL
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const counts = chartEmpleoPublPriv.datasets[0].data as number[];
                        const total = counts.reduce((s, v) => s + v, 0);
                        
                        return chartsLoaded ? (
                          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <ModernDoughnut data={chartEmpleoPublPriv} label="Total" value={`${total} Ops`} padding={36} height="220px" width="220px" labelSize={8} valueSize={15} />
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
                        ) : (
                          <ChartShimmer style={{ height: 280 }} />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </>
          </div>

          {/* ── SECCIÓN 3: VENTAS POR CATEGORÍA ── */}
          <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <div style={{ flex: 1 }}>{sectionHeader(3, '3. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>
                  {periodoSec3 === 'mensual'
                    ? (() => {
                        const v = ventasMes.filter(isVenta);
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
                        padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
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
            </div>
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
                    <DistBlock theme="elevated" titulo="Acuerdo" icon={<PieChart size={12} color="#f97316" />} datos={ac} color="#f97316" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={cu} color="#60a5fa" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={re} color="#34d399" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={sx} color="#f472b6" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={em} color="#fbbf24" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={lo} color="#a78bfa" totalMes={base} />
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── SECCIÓN 4 Y SHEETS: GRID ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 32 }}>
            <div className="data-card" style={{ margin: 0, height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 12, userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChart size={15} color="#4ade80" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>4. Distribucion por Estado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CustomSelect
                    value={sec4Mes}
                    onChange={val => setSec4Mes(String(val))}
                    options={[{ label: 'Todos', value: '' }, ...CONFIG.MESES_NOMBRES.map((m, i) => ({ label: m, value: String(i + 1).padStart(2, '0') }))]}
                    width="140px"
                    bg="#1a1a1a"
                  />
                  <CustomSelect
                    value={sec4Anio}
                    onChange={val => setSec4Anio(Number(val))}
                    options={[2024, 2025, 2026].map(y => ({ label: String(y), value: y }))}
                    width="100px"
                    bg="#1a1a1a"
                  />
                </div>
              </div>
              <MetricasTab hideSelector mesStr={sec4Mes} anioNum={sec4Anio} registros={registros} analista={analista} analistas={analistasDefault} />
            </div>
            <NuevaSeccionSheets analista={analista} />
          </div>

          {/* ── SECCIÓN 5: CÁLCULO DE INCENTIVOS ── */}
          {['luciana', 'victoria'].includes(analista.toLowerCase()) && (
            <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            {sectionHeader(5, '5. Cálculo de Incentivos', <Calculator size={15} color="#a78bfa" />)}
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
                    <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>
                      * El tope máximo para Ventas (K + Q) es de $200,000.<br/>
                      * El tope máximo para Cobranzas es de $50,000 (Tope total: $250,000).
                    </div>
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
                          { a: '80% y 99.99%', c: '20%' },
                          { a: '>= 100%', c: '30%' },
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
                            style={{ width: '100%', background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '6px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
                            placeholder="0%"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>TR 120</div>
                          <input 
                            type="number" 
                            value={manualCobranzas.pctTr120 || ''} 
                            onChange={(e) => handleManualCobChange('pctTr120', e.target.value)}
                            style={{ width: '100%', background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '6px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
                            placeholder="0%"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>REFIN</div>
                          <input 
                            type="number" 
                            value={manualCobranzas.pctRefin || ''} 
                            onChange={(e) => handleManualCobChange('pctRefin', e.target.value)}
                            style={{ width: '100%', background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '6px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
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
                        <th style={{ textAlign: 'right', padding: '16px 15px', fontSize: 11, fontWeight: 900, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Total Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiCards.filter(k => k.analista === 'PDV' || ['luciana', 'victoria'].includes(k.analista.toLowerCase())).map((k, idx) => (
                        <tr key={k.analista} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '18px 15px', fontSize: 13, fontWeight: 800, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {k.analista === 'PDV' ? 'TOTAL GENERAL' : (analista === 'PDV' ? k.analista.toUpperCase() : 'INDIVIDUAL')}
                          </td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#eee', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency(k.capital)}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: k.cumplCapital && k.cumplCapital >= 75 ? '#10b981' : '#f87171', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{k.cumplCapital?.toFixed(1)}%</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency(k.incentivoCap)}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: k.cumplOps && k.cumplOps >= 80 ? '#10b981' : '#f87171', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{k.cumplOps?.toFixed(1)}%</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency(k.incentivoOps)}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{formatCurrency((k.incentivoCobTr90 || 0) + (k.incentivoCobTr120 || 0) + (k.incentivoCobRefin || 0))}</td>
                          <td style={{ padding: '18px 15px', textAlign: 'right', fontSize: 15, color: '#fff', fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                              {k.topeKQAplicado && (
                                <span
                                  title={`Tope $250.000 aplicado. Excedente sin pagar: ${formatCurrency(k.topeKQExcedente || 0)}`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 6,
                                    fontSize: 10, fontWeight: 800,
                                    background: 'rgba(251,191,36,0.15)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(251,191,36,0.35)',
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                  }}
                                >
                                  TOPE
                                </span>
                              )}
                              {formatCurrency(k.incentivoTotal)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        )}
      </div>

      {rendimiento12MOpen && (
        <div
          onClick={() => setRendimiento12MOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18,
              padding: 24,
              width: 'min(1480px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Rendimiento por Año {analista !== 'PDV' && `— ${analista}`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 4, marginRight: 16, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 8 }}>
                    {['OBJETIVO', 'ALCANCE', 'VAR.', 'CUMPL.'].map(col => {
                      const isHidden = hiddenCols.includes(col);
                      return (
                        <button
                          key={col}
                          onClick={() => setHiddenCols(prev => isHidden ? prev.filter(c => c !== col) : [...prev, col])}
                          style={{
                            background: isHidden ? 'transparent' : 'rgba(255,255,255,0.1)',
                            color: isHidden ? '#555' : '#aaa',
                            border: 'none', borderRadius: 6, padding: '4px 8px',
                            fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                            textDecoration: isHidden ? 'line-through' : 'none'
                          }}
                          title={isHidden ? `Mostrar columna ${col}` : `Ocultar columna ${col}`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isAdmin && (
                  <CustomSelect
                    value={mesRendimiento}
                    onChange={raw => {
                      const val = raw === 'TODOS' ? 'TODOS' : Number(raw);
                      setMesRendimiento(val);
                      if (val !== 'TODOS') setAnioRendimiento('TODOS');
                    }}
                    options={[{ label: 'Todos los Meses', value: 'TODOS' }, ...CONFIG.MESES_NOMBRES.map((m: string, i: number) => ({ label: m, value: i }))]}
                    width="150px"
                  />
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (anioRendimiento === 'TODOS') return;
                    const idx = aniosDisponiblesRendimiento.indexOf(anioRendimiento as number);
                    const next = aniosDisponiblesRendimiento[idx + 1];
                    if (next !== undefined) setAnioRendimiento(next);
                  }}
                  disabled={anioRendimiento === 'TODOS' || aniosDisponiblesRendimiento.indexOf(anioRendimiento as number) >= aniosDisponiblesRendimiento.length - 1}
                  style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#aaa', cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <CustomSelect
                  value={anioRendimiento}
                  onChange={raw => setAnioRendimiento(raw === 'TODOS' ? 'TODOS' : Number(raw))}
                  options={[
                    ...(isAdmin ? [{ label: 'Todos los Años', value: 'TODOS' }] : []),
                    ...aniosDisponiblesRendimiento.map(a => ({ label: String(a), value: a })),
                  ]}
                  width="120px"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (anioRendimiento === 'TODOS') return;
                    const idx = aniosDisponiblesRendimiento.indexOf(anioRendimiento as number);
                    const prev = aniosDisponiblesRendimiento[idx - 1];
                    if (prev !== undefined) setAnioRendimiento(prev);
                  }}
                  disabled={anioRendimiento === 'TODOS' || aniosDisponiblesRendimiento.indexOf(anioRendimiento as number) <= 0}
                  style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#aaa', cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setRendimiento12MOpen(false)}
                  style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#aaa', cursor: 'pointer', marginLeft: 8,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {anioRendimiento === 'TODOS' && mesRendimiento === 'TODOS' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {aniosDisponiblesRendimiento.slice().sort((a,b) => b - a).map(anio => {
                  const bucketsYear = mesesAnioKQ.filter(b => b.anio === anio);
                  if (bucketsYear.length === 0) return null;
                  return (
                    <div key={anio}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 4, height: 16, background: '#a78bfa', borderRadius: 4 }} />
                        AÑO {anio}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Mini12Table
                          label="CAPITAL"
                          total={formatCurrency(bucketsYear.reduce((s, b) => s + b.monto, 0))}
                          buckets={bucketsYear}
                          accessor={b => b.monto}
                          metaAccessor={b => b.metaK}
                          formatValue={v => formatCurrency(v)}
                          hiddenCols={hiddenCols}
                        />
                        <Mini12Table
                          label="OPERACIONES"
                          total={String(bucketsYear.reduce((s, b) => s + b.ops, 0))}
                          buckets={bucketsYear}
                          accessor={b => b.ops}
                          metaAccessor={b => b.metaQ}
                          formatValue={v => String(v)}
                          hiddenCols={hiddenCols}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Mini12Table
                  label="CAPITAL"
                  total={formatCurrency(mesesAnioKQ.reduce((s, b) => s + b.monto, 0))}
                  buckets={mesesAnioKQ}
                  accessor={b => b.monto}
                  metaAccessor={b => b.metaK}
                  formatValue={v => formatCurrency(v)}
                  hiddenCols={hiddenCols}
                />
                <Mini12Table
                  label="OPERACIONES"
                  total={String(mesesAnioKQ.reduce((s, b) => s + b.ops, 0))}
                  buckets={mesesAnioKQ}
                  accessor={b => b.ops}
                  metaAccessor={b => b.metaQ}
                  formatValue={v => String(v)}
                  hiddenCols={hiddenCols}
                />
              </div>
            )}
          </div>
        </div>
      )}
              </>
            )}
    </div>
  );
}

type Bucket12 = { key: string; label: string; monto: number; ops: number; metaK: number; metaQ: number };

function Mini12Table({ label, total, buckets, accessor, metaAccessor, formatValue, hiddenCols = [] }: {
  label: string;
  total: string;
  buckets: Bucket12[];
  accessor: (b: Bucket12) => number;
  metaAccessor?: (b: Bucket12) => number;
  formatValue?: (v: number) => string;
  hiddenCols?: string[];
}) {
  const fmt = formatValue || ((v: number) => String(v));
  const dotColor = (pct: number | null) => {
    if (pct === null) return '#555';
    if (pct >= 100) return '#4ade80';
    if (pct >= 75)  return '#fbbf24';
    return '#f87171';
  };
  const th: React.CSSProperties = {
    padding: '10px 12px', fontSize: 10, fontWeight: 800,
    color: '#666', textTransform: 'uppercase', letterSpacing: '1px',
    borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left',
  };
  const td: React.CSSProperties = {
    padding: '11px 12px', fontSize: 13, color: '#ccc',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <div style={{
      background: '#111111',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 11, color: '#555', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>{total}</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>MES</th>
            {!hiddenCols.includes('OBJETIVO') && <th style={{ ...th, textAlign: 'center' }}>OBJETIVO</th>}
            {!hiddenCols.includes('ALCANCE') && <th style={{ ...th, textAlign: 'center' }}>ALCANCE</th>}
            {!hiddenCols.includes('VAR.') && <th style={{ ...th, textAlign: 'center' }}>VAR.</th>}
            {!hiddenCols.includes('CUMPL.') && <th style={{ ...th, textAlign: 'right' }}>CUMPL.</th>}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => {
            const v = accessor(b);
            const meta = metaAccessor ? metaAccessor(b) : 0;
            const pct = meta > 0 ? (v / meta) * 100 : null;
            const prev = i > 0 ? accessor(buckets[i - 1]) : null;
            const variacion = v > 0 && prev !== null && prev > 0 ? ((v - prev) / prev) * 100 : null;
            const varColor = variacion === null ? '#64748b' : Math.abs(variacion) < 0.5 ? '#8f929d' : variacion > 0 ? '#4ade80' : '#f87171';
            const varBg = variacion === null ? 'transparent' : Math.abs(variacion) < 0.5 ? 'rgba(255,255,255,0.04)' : variacion > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)';
            return (
              <tr key={b.key}>
                <td style={{ ...td, color: '#8f929d', fontWeight: 600 }}>{b.label}</td>
                {!hiddenCols.includes('OBJETIVO') && <td style={{ ...td, textAlign: 'center', color: '#8f929d' }}>{meta > 0 ? fmt(meta) : '—'}</td>}
                {!hiddenCols.includes('ALCANCE') && <td style={{ ...td, textAlign: 'center', color: '#fff', fontWeight: 700 }}>{fmt(v)}</td>}
                {!hiddenCols.includes('VAR.') && <td style={{ ...td, textAlign: 'center' }}>
                  {variacion !== null ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6,
                      fontSize: 11, fontWeight: 700,
                      color: varColor, background: varBg,
                    }}>
                      {Math.abs(variacion) < 0.5 ? '—' : variacion > 0 ? '▲' : '▼'} {variacion >= 0 ? '+' : ''}{variacion.toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ color: '#444' }}>—</span>
                  )}
                </td>}
                {!hiddenCols.includes('CUMPL.') && <td style={{ ...td, textAlign: 'right' }}>
                  {pct !== null ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: 11, fontWeight: 700,
                      color: '#e5e5e5',
                      background: '#141414',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: dotColor(pct),
                        boxShadow: `0 0 6px ${dotColor(pct)}`,
                      }} />
                      {pct.toFixed(2)}%
                    </span>
                  ) : (
                    <span style={{ color: '#444' }}>—</span>
                  )}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
