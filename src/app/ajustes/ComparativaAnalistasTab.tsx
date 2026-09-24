'use client';

import React, { useState, useMemo } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { formatCurrency } from '@/lib/utils';
import { filterByMonth, isVenta, emptyTiposAcuerdo, matchTipoAcuerdo, buildDistEmpleador, cumplColor } from '@/lib/registro-stats';
import { tasaCierrePct, conversionTotalPct } from '@/lib/kpi-cierre';
import { CONFIG, Registro } from '@/types';
import CustomSelect from '@/components/CustomSelect';
import DistBlock from '@/components/charts/DistBlock';
import ModernDoughnut from '@/components/charts/ModernDoughnut';
import {
  Users, BarChart3, TrendingUp, PieChart,
  Shield, Tag, CheckCircle2
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, ArcElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement);

// ── Plugin inline: data labels on bars (idéntico a analistas/page.tsx) ────
const labelsPlugin: any = {
  id: 'comparativaLabelsPlugin',
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

// ── Helper: degradado para barras (idéntico a analistas/page.tsx) ─────────
const getGradient = (context: any, colorStart: string, colorEnd: string) => {
  const chart = context.chart;
  const { ctx, chartArea } = chart;
  if (!chartArea) return null;
  const horizontal = chart.config.options.indexAxis === 'y';
  const gradient = horizontal
    ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
    : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
};

const now = new Date();

export default function ComparativaAnalistasTab() {
  const { registros, loading: loadingRegs } = useRegistros();
  const { objetivos } = useObjetivos();
  const { nombres, analistasAll } = useAnalistas();

  const [selectedAnio, setSelectedAnio] = useState<number | 'TODOS'>(now.getFullYear());
  const [selectedMes, setSelectedMes] = useState<number | 'TODOS'>(now.getMonth() + 1);
  const [modoOp, setModoOp] = useState<'ventas' | 'todos'>('ventas');
  const [selectedAnalista, setSelectedAnalista] = useState<string | null>(null);

  // Años disponibles
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const r of registros) {
      const y = r.fecha?.slice(0, 4);
      if (y && !isNaN(Number(y))) set.add(Number(y));
    }
    for (const o of objetivos) set.add(o.anio);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [registros, objetivos]);

  // Filtrado temporal
  const regsPeriodo = useMemo(() => {
    if (selectedAnio === 'TODOS') return registros;
    if (selectedMes === 'TODOS') {
      const prefix = `${selectedAnio}-`;
      return registros.filter(r => r.fecha?.startsWith(prefix));
    }
    return filterByMonth(registros, selectedMes, selectedAnio);
  }, [registros, selectedAnio, selectedMes]);

  const analistasActivos = useMemo(() => {
    return nombres.length > 0 ? nombres : ['Luciana', 'Victoria'];
  }, [nombres]);

  // Color map
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    analistasAll.forEach(a => map.set(a.nombre, a.color || '#3b82f6'));
    return map;
  }, [analistasAll]);

  // Paleta estética de gráficos coherente con analistas/page.tsx
  const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#38bdf8', '#fb923c'];

  // Métricas por analista y Total PDV
  const filas = useMemo(() => {
    const porAnalista = analistasActivos.map((analista, idx) => {
      const regsA = regsPeriodo.filter(r => r.analista === analista);
      const ventas = regsA.filter(isVenta);
      const ventasQ = ventas.length;
      const capitalK = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const ticket = ventasQ > 0 ? capitalK / ventasQ : 0;
      const tasaCierre = tasaCierrePct(regsA);
      const conversionTotal = conversionTotalPct(regsA);
      const renovQ = ventas.filter(r => r.es_re).length;
      const pctRenov = ventasQ > 0 ? (renovQ / ventasQ) * 100 : 0;

      // Metas según período seleccionado
      let metaCapital = 0;
      let metaOps = 0;
      if (selectedAnio !== 'TODOS' && selectedMes !== 'TODOS') {
        const obj = objetivos.find(o => o.analista === analista && o.mes === (selectedMes as number) - 1 && o.anio === selectedAnio);
        metaCapital = obj?.meta_ventas ?? 0;
        metaOps = obj?.meta_operaciones ?? 0;
      } else if (selectedAnio !== 'TODOS' && selectedMes === 'TODOS') {
        const objs = objetivos.filter(o => o.analista === analista && o.anio === selectedAnio);
        metaCapital = objs.reduce((s, o) => s + (o.meta_ventas || 0), 0);
        metaOps = objs.reduce((s, o) => s + (o.meta_operaciones || 0), 0);
      } else {
        const objs = objetivos.filter(o => o.analista === analista);
        metaCapital = objs.reduce((s, o) => s + (o.meta_ventas || 0), 0);
        metaOps = objs.reduce((s, o) => s + (o.meta_operaciones || 0), 0);
      }

      const cumplCapital = metaCapital > 0 ? (capitalK / metaCapital) * 100 : null;
      const cumplOps = metaOps > 0 ? (ventasQ / metaOps) * 100 : null;

      return {
        analista,
        color: colorMap.get(analista) || palette[idx % palette.length],
        ingresados: regsA.length,
        ventasQ,
        capitalK,
        ticket,
        tasaCierre,
        conversionTotal,
        pctRenov,
        metaCapital,
        metaOps,
        cumplCapital,
        cumplOps,
      };
    });

    // Fila Total PDV
    const ventasPDV = regsPeriodo.filter(isVenta);
    const totalVentasQ = ventasPDV.length;
    const totalCapitalK = ventasPDV.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const totalTicket = totalVentasQ > 0 ? totalCapitalK / totalVentasQ : 0;
    const totalTasaCierre = tasaCierrePct(regsPeriodo);
    const totalConversionTotal = conversionTotalPct(regsPeriodo);
    const totalRenovQ = ventasPDV.filter(r => r.es_re).length;
    const totalPctRenov = totalVentasQ > 0 ? (totalRenovQ / totalVentasQ) * 100 : 0;

    const totalMetaCapital = porAnalista.reduce((s, a) => s + a.metaCapital, 0);
    const totalMetaOps = porAnalista.reduce((s, a) => s + a.metaOps, 0);
    const totalCumplCapital = totalMetaCapital > 0 ? (totalCapitalK / totalMetaCapital) * 100 : null;
    const totalCumplOps = totalMetaOps > 0 ? (totalVentasQ / totalMetaOps) * 100 : null;

    const total = {
      analista: 'PDV',
      color: '#10b981',
      ingresados: regsPeriodo.length,
      ventasQ: totalVentasQ,
      capitalK: totalCapitalK,
      ticket: totalTicket,
      tasaCierre: totalTasaCierre,
      conversionTotal: totalConversionTotal,
      pctRenov: totalPctRenov,
      metaCapital: totalMetaCapital,
      metaOps: totalMetaOps,
      cumplCapital: totalCumplCapital,
      cumplOps: totalCumplOps,
    };

    return { porAnalista, total };
  }, [analistasActivos, regsPeriodo, objetivos, selectedAnio, selectedMes, colorMap]);

  // Ranking y líderes
  const liderCapital = useMemo(() => {
    if (filas.porAnalista.length === 0) return null;
    return [...filas.porAnalista].sort((a, b) => b.capitalK - a.capitalK)[0];
  }, [filas.porAnalista]);

  const liderEfectividad = useMemo(() => {
    if (filas.porAnalista.length === 0) return null;
    return [...filas.porAnalista].sort((a, b) => (b.tasaCierre ?? 0) - (a.tasaCierre ?? 0))[0];
  }, [filas.porAnalista]);

  // Opciones de gráfico base
  const chartOpts = (yLabel = '$') => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 30, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 13, weight: 900, family: "'Outfit', sans-serif" },
        titleAlign: 'center' as const,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 12, weight: 600, family: "'Outfit', sans-serif" },
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            if (yLabel === '$') return ` ${ctx.dataset.label}: ${formatCurrency(val)}`;
            return ` ${ctx.dataset.label}: ${val} ops`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8f929d', font: { size: 11, weight: 700, family: "'Outfit', sans-serif" } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#555', font: { size: 10, family: "'Outfit', sans-serif" },
          callback: (v: any) => {
            if (yLabel === '$') {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
              return `$${v}`;
            }
            return v;
          },
        },
      },
    },
  });

  // Gráfico 1: Capital Vendido vs Meta
  const chartCapitalData = useMemo(() => {
    const labels = filas.porAnalista.map(a => a.analista);
    const capitales = filas.porAnalista.map(a => a.capitalK);
    const metas = filas.porAnalista.map(a => a.metaCapital);

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Capital Vendido',
          data: capitales,
          backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'),
          borderColor: '#10b981',
          borderWidth: 0,
          borderRadius: 4,
          order: 2,
          maxBarThickness: 60,
        },
        {
          type: 'line' as const,
          label: 'Meta Capital',
          data: metas,
          borderColor: '#f87171',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: '#f87171',
          fill: false,
          order: 1,
        },
      ],
    };
  }, [filas.porAnalista]);

  // Gráfico 2: Operaciones vs Meta
  const chartOpsData = useMemo(() => {
    const labels = filas.porAnalista.map(a => a.analista);
    const ops = filas.porAnalista.map(a => a.ventasQ);
    const metas = filas.porAnalista.map(a => a.metaOps);

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Operaciones Cerradas',
          data: ops,
          backgroundColor: (context: any) => getGradient(context, 'rgba(96, 165, 250, 0.05)', 'rgba(96, 165, 250, 0.85)'),
          borderColor: '#60a5fa',
          borderWidth: 0,
          borderRadius: 4,
          order: 2,
          maxBarThickness: 60,
        },
        {
          type: 'line' as const,
          label: 'Meta Operaciones',
          data: metas,
          borderColor: '#fb923c',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: '#fb923c',
          fill: false,
          order: 1,
        },
      ],
    };
  }, [filas.porAnalista]);

  // Gráfico 3: ModernDoughnut Share
  const doughnutShareData = useMemo(() => {
    const labels = filas.porAnalista.map(a => a.analista);
    const data = filas.porAnalista.map(a => a.capitalK);
    const bgColors = filas.porAnalista.map(a => a.color);

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 10,
        borderRadius: 4,
        spacing: 4,
      }],
    };
  }, [filas.porAnalista]);

  // Desglose de categoría del analista seleccionado o PDV
  const targetAnalista = selectedAnalista || 'PDV';
  const fuenteRegistros = useMemo(() => {
    const base = targetAnalista === 'PDV' ? regsPeriodo : regsPeriodo.filter(r => r.analista === targetAnalista);
    return modoOp === 'ventas' ? base.filter(isVenta) : base;
  }, [regsPeriodo, targetAnalista, modoOp]);

  const totalBase = useMemo(() => {
    return fuenteRegistros.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  }, [fuenteRegistros]);

  const distAcuerdo = useMemo(() => {
    const acc = emptyTiposAcuerdo();
    const isV = modoOp === 'ventas';
    for (const r of fuenteRegistros) {
      const match = matchTipoAcuerdo(r.acuerdo_precios || '', r.estado || '', isV);
      if (match && acc[match]) {
        acc[match].monto += Number(r.monto) || 0;
        acc[match].cantidad += 1;
      }
    }
    return Object.entries(acc).map(([label, d]) => ({ label, ...d }));
  }, [fuenteRegistros, modoOp]);

  const distCuotas = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuenteRegistros) {
      const c = r.cuotas ? `${r.cuotas} cuotas` : 'No especificado';
      const prev = map.get(c) || { monto: 0, cantidad: 0 };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      map.set(c, prev);
    }
    return Array.from(map.entries()).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
  }, [fuenteRegistros]);

  const distRango = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuenteRegistros) {
      const re = r.rango_etario || 'No especificado';
      const prev = map.get(re) || { monto: 0, cantidad: 0 };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      map.set(re, prev);
    }
    return Array.from(map.entries()).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
  }, [fuenteRegistros]);

  const distSexo = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuenteRegistros) {
      const s = r.sexo ? (r.sexo.toUpperCase() === 'M' ? 'Masculino' : r.sexo.toUpperCase() === 'F' ? 'Femenino' : r.sexo) : 'No especificado';
      const prev = map.get(s) || { monto: 0, cantidad: 0 };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      map.set(s, prev);
    }
    return Array.from(map.entries()).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
  }, [fuenteRegistros]);

  const distEmpleador = useMemo(() => buildDistEmpleador(fuenteRegistros), [fuenteRegistros]);

  // Encabezado de sección unificado idéntico a analistas/page.tsx
  const sectionHeader = (title: string, icon: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)',
      gap: 12, userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {title}
        </span>
        {extra}
      </div>
    </div>
  );

  if (loadingRegs) {
    return (
      <div className="loading-container" style={{ minHeight: '350px' }}>
        <div className="spinner" />
        <span style={{ color: '#555', marginTop: 12 }}>Cargando métricas de analistas...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Toolbar Superior (idéntica a analistas/page.tsx) ── */}
      <div style={{
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '16px',
        padding: '12px 24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.02)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <BarChart3 size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                Comparativa de Analistas
              </div>
              <div style={{ fontSize: 13, color: '#8f929d', marginTop: 2 }}>
                Rendimiento y Cartera Cruzada
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CustomSelect
              value={selectedMes}
              onChange={val => setSelectedMes(val === 'TODOS' ? 'TODOS' : Number(val))}
              options={[{ label: 'Todo el año', value: 'TODOS' }, ...CONFIG.MESES_NOMBRES.map((m, i) => ({ label: m, value: i + 1 }))]}
              width="150px"
            />
            <CustomSelect
              value={selectedAnio}
              onChange={val => setSelectedAnio(val === 'TODOS' ? 'TODOS' : Number(val))}
              options={[{ label: 'Histórico', value: 'TODOS' }, ...aniosDisponibles.map(a => ({ label: String(a), value: a }))]}
              width="110px"
            />
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1: TABLERO (KPI Cards) ── */}
      <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        {sectionHeader('1. Tablero de Rendimiento', <BarChart3 size={15} color="#60a5fa" />)}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Card 1: Capital Vendido Total */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Capital Vendido (PDV)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{formatCurrency(filas.total.capitalK)}</div>
            <div style={{ fontSize: 12, color: '#8f929d', marginBottom: 2 }}>
              Meta: {filas.total.metaCapital > 0 ? formatCurrency(filas.total.metaCapital) : '—'}
            </div>
            {filas.total.cumplCapital !== null && (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                <span style={{ color: cumplColor(filas.total.cumplCapital), marginRight: 4 }}>●</span>
                {filas.total.cumplCapital.toFixed(1)}% Cumplimiento
              </div>
            )}
          </div>

          {/* Card 2: Operaciones Totales */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Operaciones Cerradas</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{filas.total.ventasQ} ops</div>
            <div style={{ fontSize: 12, color: '#8f929d', marginBottom: 2 }}>
              Meta: {filas.total.metaOps > 0 ? `${filas.total.metaOps} ops` : '—'}
            </div>
            {filas.total.cumplOps !== null && (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                <span style={{ color: cumplColor(filas.total.cumplOps), marginRight: 4 }}>●</span>
                {filas.total.cumplOps.toFixed(1)}% Cumplimiento
              </div>
            )}
          </div>

          {/* Card 3: Líder en Capital */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Líder en Ventas</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', marginBottom: 4 }}>{liderCapital ? liderCapital.analista : '—'}</div>
            <div style={{ fontSize: 12, color: '#8f929d', marginBottom: 2 }}>
              {liderCapital ? formatCurrency(liderCapital.capitalK) : '$0'}
            </div>
            {liderCapital?.cumplCapital !== null && liderCapital?.cumplCapital !== undefined && (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                <span style={{ color: cumplColor(liderCapital.cumplCapital), marginRight: 4 }}>●</span>
                {liderCapital.cumplCapital.toFixed(1)}% de su meta
              </div>
            )}
          </div>

          {/* Card 4: Mayor Efectividad */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Mayor Efectividad de Cierre</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399', marginBottom: 4 }}>
              {liderEfectividad?.tasaCierre ? `${liderEfectividad.tasaCierre.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#8f929d', marginBottom: 2 }}>
              Analista: <strong style={{ color: '#fff' }}>{liderEfectividad ? liderEfectividad.analista : '—'}</strong>
            </div>
            <div style={{ fontSize: 12, color: '#8f929d' }}>
              Conversión embudo: {liderEfectividad?.conversionTotal ? `${liderEfectividad.conversionTotal.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2: GRÁFICOS COMPARATIVOS ── */}
      <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        {sectionHeader('2. Gráficos Comparativos', <BarChart3 size={15} color="#a78bfa" />)}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Gráfico 1: Capital Vendido vs Meta */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Capital Vendido vs Meta ($)
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>Vendido</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 2, background: '#f87171' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>Meta</span>
                </div>
              </div>
            </div>
            <div style={{ height: 280 }}>
              <Bar data={chartCapitalData as any} options={chartOpts('$') as any} plugins={[labelsPlugin]} />
            </div>
          </div>

          {/* Gráfico 2: Operaciones vs Meta */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Operaciones Cerradas vs Meta
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>Ops</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 2, background: '#fb923c' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#8f929d', textTransform: 'uppercase' }}>Meta</span>
                </div>
              </div>
            </div>
            <div style={{ height: 280 }}>
              <Bar data={chartOpsData as any} options={chartOpts('ops') as any} plugins={[labelsPlugin]} />
            </div>
          </div>

          {/* Gráfico 3: Participación en Ventas */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Distribución de Ventas (% Capital)
              </div>
            </div>
            <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ModernDoughnut
                data={doughnutShareData}
                label="Total PDV"
                value={formatCurrency(filas.total.capitalK)}
                padding={36}
                height="220px"
                width="220px"
                labelSize={8}
                valueSize={15}
              />
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {filas.porAnalista.map(a => {
                  const pct = filas.total.capitalK > 0 ? ((a.capitalK / filas.total.capitalK) * 100).toFixed(1) : '0';
                  return (
                    <div key={a.analista} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.color }} />
                      <span style={{ fontSize: 9, color: '#8f929d', fontWeight: 700, textTransform: 'uppercase' }}>
                        {a.analista} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: TABLA DE RENDIMIENTO POR ANALISTA (idéntica a analistas/page.tsx) ── */}
      <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={15} color="#38bdf8" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>
              3. Rendimiento por Analista
            </span>
          </div>
          {selectedAnalista && (
            <button
              onClick={() => setSelectedAnalista(null)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Restablecer a PDV
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)', padding: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Analista</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Ingresados</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Vendido ($)</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Meta ($)</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Cumpl. ($)</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Ventas (Q)</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Meta (Q)</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Cumpl. (Q)</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Ticket Prom.</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Tasa Cierre</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>Conv. Total</th>
                <th style={{ textAlign: 'right', padding: '14px 14px', fontSize: 11, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>% Renov.</th>
              </tr>
            </thead>
            <tbody>
              {filas.porAnalista.map((k, idx) => {
                const isSelected = selectedAnalista === k.analista;
                return (
                  <tr
                    key={k.analista}
                    onClick={() => setSelectedAnalista(k.analista)}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'),
                      cursor: 'pointer',
                      boxShadow: isSelected ? `inset 3px 0 0 ${k.color}` : 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                    }}
                  >
                    <td style={{ padding: '16px 14px', fontSize: 13, fontWeight: 800, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.color }} />
                      {k.analista.toUpperCase()}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#ccc', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.ingresados}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#eee', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {formatCurrency(k.capitalK)}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#888', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.metaCapital > 0 ? formatCurrency(k.metaCapital) : '—'}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(k.cumplCapital), fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.cumplCapital !== null ? `${k.cumplCapital.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#60a5fa', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.ventasQ}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#888', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.metaOps > 0 ? k.metaOps : '—'}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(k.cumplOps), fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.cumplOps !== null ? `${k.cumplOps.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#eee', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {formatCurrency(k.ticket)}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(k.tasaCierre), fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.tasaCierre !== null ? `${k.tasaCierre.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(k.conversionTotal), fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.conversionTotal !== null ? `${k.conversionTotal.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#888', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {k.pctRenov.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}

              {/* Fila TOTAL GENERAL */}
              <tr
                onClick={() => setSelectedAnalista('PDV')}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderTop: '2px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                <td style={{ padding: '16px 14px', fontSize: 13, fontWeight: 900, color: '#10b981', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  TOTAL GENERAL
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.ingresados}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 14, color: '#10b981', fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {formatCurrency(filas.total.capitalK)}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.metaCapital > 0 ? formatCurrency(filas.total.metaCapital) : '—'}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(filas.total.cumplCapital), fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.cumplCapital !== null ? `${filas.total.cumplCapital.toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 14, color: '#60a5fa', fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.ventasQ}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.metaOps > 0 ? filas.total.metaOps : '—'}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(filas.total.cumplOps), fontWeight: 900, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.cumplOps !== null ? `${filas.total.cumplOps.toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {formatCurrency(filas.total.ticket)}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(filas.total.tasaCierre), fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.tasaCierre !== null ? `${filas.total.tasaCierre.toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: cumplColor(filas.total.conversionTotal), fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.conversionTotal !== null ? `${filas.total.conversionTotal.toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '16px 14px', textAlign: 'right', fontSize: 13, color: '#ccc', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {filas.total.pctRenov.toFixed(0)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECCIÓN 4: COMPOSICIÓN DE CARTERA (idéntica a analistas/page.tsx) ── */}
      <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag size={15} color="#fb923c" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>
              4. Composición de Cartera — <strong style={{ color: '#fff' }}>{targetAnalista === 'PDV' ? 'PDV (General)' : targetAnalista}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>
              {fuenteRegistros.length} ops · {formatCurrency(totalBase)}
            </span>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 3 }}>
              <button
                onClick={() => setModoOp('ventas')}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                  background: modoOp === 'ventas' ? '#fb923c' : 'transparent',
                  color: modoOp === 'ventas' ? '#000' : '#888',
                  transition: 'all 0.2s ease',
                }}
              >
                Ventas
              </button>
              <button
                onClick={() => setModoOp('todos')}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                  background: modoOp === 'todos' ? '#fb923c' : 'transparent',
                  color: modoOp === 'todos' ? '#000' : '#888',
                  transition: 'all 0.2s ease',
                }}
              >
                Todos
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <DistBlock titulo="Acuerdo de Precios" icon={<PieChart size={12} color="#f97316" />} datos={distAcuerdo} color="#f97316" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={distCuotas} color="#60a5fa" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={distRango} color="#34d399" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={distSexo} color="#f472b6" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={distEmpleador} color="#fbbf24" totalMes={totalBase} theme="elevated" />
        </div>
      </div>
    </div>
  );
}
