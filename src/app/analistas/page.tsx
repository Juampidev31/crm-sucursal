'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency, calcularComisiones, calcularDiasHabilesAutomaticos } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { CONFIG } from '@/types';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  Activity,
  TrendingUp,
  Zap,
  Target,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  ChevronDown,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

// PDV = vista combinada de TODOS los analistas (no es un analista real en la DB)
const PDV = '__pdv__';

const numFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toFixed(1)}%`;
const mesStr = (anio: number, mes: number) => `${anio}-${String(mes + 1).padStart(2, '0')}`;
const esVenta = (estado: string) =>
  estado.toLowerCase() === 'venta' || estado.toLowerCase().includes('aprobado cc');

interface Reg { analista: string; estado: string; monto: number; fecha: string | null; }
interface DiasConfig { analista: string; dias_habiles: number; dias_transcurridos: number; }

const ESTADOS_RESUMEN = [
  { key: 'proyeccion', label: 'PROYECCIONES' },
  { key: 'en seguimiento', label: 'EN SEGUIMIENTO' },
  { key: 'score bajo', label: 'SCORE BAJO' },
  { key: 'afectaciones', label: 'AFECTACIONES' },
  { key: 'derivado / aprobado cc', label: 'DERIVADO APROBADO CC' },
  { key: 'derivado / rechazado cc', label: 'DERIVADO RECHAZADO CC' },
];

export default function AnalistasPage() {
  const now = new Date();
  const [analista, setAnalista] = useState<string>(PDV);
  const [mes, setMes] = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());

  const { registros: rawRegs, objetivos: todosObjs, diasConfig: diasCfg, loading } = useData();
  const todosRegs = rawRegs as unknown as Reg[];
  const [analistasSel, setAnalistasSel] = useState<string[]>([]);

  useEffect(() => {
    if (todosRegs.length === 0) return;
    const esAnalistaValido = (a: string) =>
      a && a !== 'Column 5' && a !== 'Column5' &&
      !a.startsWith('$') && !a.includes('%') && !/^\d/.test(a.trim());
    const set = new Set(todosRegs.map(r => r.analista).filter(esAnalistaValido));
    setAnalistasSel(Array.from(set) as string[]);
  }, [todosRegs]);

  // Registros del analista seleccionado
  // PDV = todos, individual = filtrado
  const regs = useMemo(
    () => analista === PDV ? todosRegs : todosRegs.filter(r => r.analista === analista),
    [todosRegs, analista]
  );

  // Objetivos indexados por "anio-mes"
  // PDV = suma de todos los analistas, individual = solo el suyo
  const objMap = useMemo(() => {
    const map: Record<string, { meta_ventas: number; meta_operaciones: number }> = {};
    for (const o of todosObjs) {
      const k = mesStr(o.anio, o.mes);
      if (!map[k]) map[k] = { meta_ventas: 0, meta_operaciones: 0 };
      if (analista === PDV ? o.analista === 'PDV' : o.analista === analista) {
        map[k].meta_ventas += Number(o.meta_ventas) || 0;
        map[k].meta_operaciones += Number(o.meta_operaciones) || 0;
      }
    }
    return map;
  }, [todosObjs, analista]);

  // Días hábiles: la config manual solo aplica al mes actual.
  // Para meses pasados/futuros se calcula automáticamente
  // (en meses pasados dt = dh → proyectado = alcance)
  const diasInfo = useMemo(() => {
    const esMesActual = mes === now.getMonth() && anio === now.getFullYear();
    if (esMesActual) {
      const cfgKey = analista === PDV ? 'Todos' : analista;
      const cfg = diasCfg.find(d => d.analista === cfgKey);
      if (cfg && cfg.dias_habiles > 0) {
        return { diasHabiles: cfg.dias_habiles, diasTranscurridos: cfg.dias_transcurridos };
      }
    }
    return calcularDiasHabilesAutomaticos(mes, anio);
  }, [diasCfg, analista, mes, anio, now]);

  // ── KPIs del mes seleccionado ──────────────────────────────────────
  const kpis = useMemo(() => {
    const key = mesStr(anio, mes);
    const obj = objMap[key] || { meta_ventas: 0, meta_operaciones: 0 };

    const ventasMes = regs.filter(r => r.fecha?.slice(0, 7) === key && esVenta(r.estado || ''));
    const alcanceCapital = ventasMes.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const alcanceOps = ventasMes.length;

    // Mes anterior para tendencia
    let pMes = mes - 1; let pAnio = anio;
    if (pMes < 0) { pMes = 11; pAnio--; }
    const prevKey = mesStr(pAnio, pMes);
    const ventasPrev = regs.filter(r => r.fecha?.slice(0, 7) === prevKey && esVenta(r.estado || ''));
    const alcancePrev = ventasPrev.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const prevOpsPrev = ventasPrev.length;

    const { diasHabiles: dh, diasTranscurridos: dt } = diasInfo;

    // Para meses pasados completos, proyectado = alcance real (todos los días ya transcurrieron)
    const esMesPasado = anio < now.getFullYear() || (anio === now.getFullYear() && mes < now.getMonth());

    // Proyección: misma fórmula que el GAS original: (alcance / dt) * dh
    // Si el mes ya terminó, se fuerza proyectado = alcance para evitar distorsiones
    const proyCapital = esMesPasado ? alcanceCapital : (dt > 0 ? (alcanceCapital / dt) * dh : 0);
    const proyOpsRaw  = esMesPasado ? alcanceOps     : (dt > 0 ? (alcanceOps / dt) * dh : 0);
    const proyOps     = esMesPasado ? alcanceOps     : Math.round(proyOpsRaw);

    const cumplReal      = obj.meta_ventas > 0 ? (alcanceCapital / obj.meta_ventas) * 100 : 0;
    const cumplProy      = obj.meta_ventas > 0 ? (proyCapital / obj.meta_ventas) * 100 : 0;
    const cumplRealOps   = obj.meta_operaciones > 0 ? (alcanceOps / obj.meta_operaciones) * 100 : 0;
    const cumplProyOps   = obj.meta_operaciones > 0 ? (proyOpsRaw / obj.meta_operaciones) * 100 : 0;

    const tendPct  = alcancePrev > 0 ? ((alcanceCapital - alcancePrev) / alcancePrev) * 100 : 0;
    const tendPctOps = prevOpsPrev > 0 ? ((alcanceOps - prevOpsPrev) / prevOpsPrev) * 100 : 0;

    const comisiones = calcularComisiones(alcanceCapital, alcanceOps, obj.meta_ventas, obj.meta_operaciones);

    return {
      obj, alcanceCapital, alcanceOps,
      alcancePrev, prevOpsPrev, tendPct, tendPctOps,
      proyCapital, proyOps,
      cumplReal, cumplProy, cumplRealOps, cumplProyOps,
      dh, dt, comisiones, pMes, pAnio,
    };
  }, [regs, objMap, diasInfo, mes, anio]);

  // ── Curva de crecimiento (acumulado diario) ──────────────────────
  const curva = useMemo(() => {
    const lastDay = new Date(anio, mes + 1, 0).getDate();
    const key = mesStr(anio, mes);
    const ventasMes = regs.filter(r => r.fecha?.slice(0, 7) === key && esVenta(r.estado || ''));
    let acum = 0;
    let lastAcum = 0;
    const stats = Array.from({ length: lastDay }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      const v = ventasMes.filter(r => r.fecha?.slice(8, 10) === d)
        .reduce((s, r) => s + (Number(r.monto) || 0), 0);
      acum += v;
      const hasSale = v > 0;
      const data = { acum, hasSale, day: i + 1 };
      lastAcum = acum;
      return data;
    });

    const hoyStr = mesStr(now.getFullYear(), now.getMonth());
    const diaHoy = key === hoyStr ? now.getDate() : lastDay;
    const objetivo = kpis.obj.meta_ventas;
    const referencias = Array.from({ length: lastDay }, (_, i) =>
      Math.round((objetivo / lastDay) * (i + 1))
    );

    return { 
      dias: Array.from({ length: lastDay }, (_, i) => i + 1), 
      stats, 
      referencias, 
      diaHoy,
      objetivo 
    };
  }, [regs, mes, anio, kpis.obj.meta_ventas, now]);

  // ── Histórico 12 meses ────────────────────────────────────────────
  const historico = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      let m = mes - (11 - i); let a = anio;
      while (m < 0) { m += 12; a--; }
      const k = mesStr(a, m);
      const v = regs.filter(r => r.fecha?.slice(0, 7) === k && esVenta(r.estado || ''));
      const alcance = v.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const obj = objMap[k]?.meta_ventas || 0;
      return {
        label: CONFIG.MESES_NOMBRES[m].substring(0, 3),
        alcance, objetivo: obj,
        cumplimiento: obj > 0 ? (alcance / obj) * 100 : 0,
      };
    });
  }, [regs, objMap, mes, anio]);

  // ── Alertas y resumen de gestión ─────────────────────────────────
  const alertas = useMemo(() => ({
    proyeccion:    regs.filter(r => r.estado?.toLowerCase() === 'proyeccion').length,
    seguimiento:   regs.filter(r => r.estado?.toLowerCase() === 'en seguimiento').length,
    afectaciones:  regs.filter(r => r.estado?.toLowerCase() === 'afectaciones').length,
  }), [regs]);

  const resumenGestion = useMemo(() =>
    ESTADOS_RESUMEN.map(g => {
      const items = regs.filter(r => r.estado?.toLowerCase() === g.key);
      return { label: g.label, ops: items.length, monto: items.reduce((s, r) => s + (Number(r.monto) || 0), 0) };
    }).filter(g => g.ops > 0),
    [regs]
  );

  // ── Chart data ────────────────────────────────────────────────────
  const curvaChart = {
    labels: curva.dias.map(String),
    datasets: [
      {
        label: 'Venta Real',
        data: curva.stats.map(s => s.acum),
        borderColor: '#fff', 
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(255,255,255,0.15)');
          gradient.addColorStop(1, 'rgba(255,255,255,0.01)');
          return gradient;
        },
        fill: true, 
        tension: 0.3, 
        borderWidth: 3,
        pointRadius: curva.dias.map(d => d <= curva.diaHoy ? 4 : 0),
        pointBackgroundColor: curva.stats.map(s => s.hasSale ? '#4ade80' : '#f87171'),
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
      },
      {
        label: 'Venta Ideal',
        data: curva.referencias,
        borderColor: 'rgba(255,255,255,0.25)', 
        borderDash: [5, 5],
        fill: false, 
        tension: 0, 
        pointRadius: 0, 
        borderWidth: 1.5,
      },
    ],
  };

  const curvaOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        titleFont: { family: 'Outfit', size: 14, weight: 'bold' as const },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (items: any[]) => `Día ${items[0].label}`,
          label: (context: any) => {
            const val = context.parsed.y;
            const isIdeal = context.datasetIndex === 1;
            const dayIdx = context.dataIndex;
            const idealVal = curva.referencias[dayIdx];
            
            if (isIdeal) return ` VENTA IDEAL: ${formatCurrency(val)}`;
            
            const diff = idealVal > 0 ? ((val - idealVal) / idealVal) * 100 : 0;
            const diffStr = diff >= 0 ? `(+${diff.toFixed(1)}% vs ideal)` : `(${diff.toFixed(1)}% vs ideal)`;
            return ` VENTA REAL: ${formatCurrency(val)} ${diffStr}`;
          }
        }
      }
    },
    scales: {
      x: { 
        title: { display: true, text: 'Día Calendario', color: '#444', font: { size: 10 } },
        ticks: { color: '#666', font: { size: 10 } }, 
        grid: { display: false } 
      },
      y: { 
        ticks: { 
          color: '#666', 
          font: { size: 10 },
          callback: (v: any) => `$${numFmt.format(Number(v) / 1000000)}M` 
        }, 
        grid: { color: 'rgba(255,255,255,0.03)' } 
      },
    },
  };

  const histChart = {
    labels: historico.map(h => h.label),
    datasets: [
      { type: 'bar' as const, label: 'Objetivo', data: historico.map(h => h.objetivo), backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, yAxisID: 'y' },
      { type: 'bar' as const, label: 'Alcance', data: historico.map(h => h.alcance), backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, yAxisID: 'y' },
      {
        type: 'line' as const, label: 'Cumpl. %',
        data: historico.map(h => h.cumplimiento),
        borderColor: '#fff', backgroundColor: 'transparent',
        pointRadius: 4, borderWidth: 1.5, tension: 0.4, yAxisID: 'y2',
        pointBackgroundColor: historico.map(h => h.cumplimiento >= 100 ? '#4ade80' : h.cumplimiento >= 75 ? '#fbbf24' : '#f87171'),
      },
    ],
  };

  const histOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#888', font: { family: 'Outfit', size: 11 as const }, boxWidth: 12, padding: 16 } },
      tooltip: { callbacks: { label: (c: { dataset: { type?: string; label?: string }; parsed: { y: number } }) => c.dataset.type === 'line' ? ` ${pct(c.parsed.y)}` : ` ${formatCurrency(c.parsed.y)}` } },
    },
    scales: {
      x: { ticks: { color: '#555' }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#555', callback: (v: string | number) => `$${numFmt.format(Number(v) / 1000000)}M` }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y2: { position: 'right' as const, ticks: { color: '#555', callback: (v: string | number) => `${v}%` }, grid: { display: false } },
    },
  };

  // ── Estilos ──────────────────────────────────────────────────────
  const sel: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#fff', fontSize: '13px',
    padding: '6px 30px 6px 10px', outline: 'none',
    fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
    WebkitAppearance: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  };

  const box: React.CSSProperties = {
    flex: 1, 
    background: 'linear-gradient(145deg, #0d0d0d, #050505)', 
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px', 
    padding: '20px', 
    minWidth: '220px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    position: 'relative',
    overflow: 'hidden',
  };

  const lbl: React.CSSProperties = { 
    fontSize: '11px', 
    color: '#888', 
    fontWeight: 700, 
    textTransform: 'uppercase', 
    letterSpacing: '1px', 
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const val: React.CSSProperties = { 
    fontSize: '24px', 
    fontWeight: 900, 
    color: '#fff', 
    lineHeight: 1,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.5px'
  };

  const sub: React.CSSProperties = { 
    fontSize: '12px', 
    color: '#555', 
    marginTop: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  const card: React.CSSProperties = {
    background: '#070707', 
    border: '1px solid rgba(255,255,255,0.04)', 
    borderRadius: '20px', 
    padding: '24px',
  };

  const prevMesLabel = CONFIG.MESES_NOMBRES[kpis.pMes].substring(0, 3).toUpperCase();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div className="dashboard-container">

      {/* ── Topbar ── */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px', padding: '16px 24px', flexWrap: 'wrap' }}>
        
        {/* Icono Estilo Imagen */}
        <div style={{ 
          width: '42px', 
          height: '42px', 
          background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(74, 222, 128, 0.25)',
          flexShrink: 0
        }}>
          <Activity size={22} color="#fff" />
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ 
            fontSize: '15px', 
            fontWeight: 900, 
            color: '#fff', 
            textTransform: 'uppercase', 
            letterSpacing: '0.8px', 
            lineHeight: 1.2,
            marginBottom: '2px'
          }}>
            PANEL DE CONTROL — {analista === PDV ? 'TOTAL GENERAL' : analista.toUpperCase()}
          </div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 800, 
            color: '#444', 
            textTransform: 'uppercase', 
            letterSpacing: '1px' 
          }}>
            PERIODO SELECCIONADO: {mes === now.getMonth() && anio === now.getFullYear() ? `MES ACTUAL ${anio}` : `${CONFIG.MESES_NOMBRES[mes].toUpperCase()} ${anio}`}
          </div>
        </div>

        {/* Selector analista */}
        <select style={sel} value={analista} onChange={e => setAnalista(e.target.value)}>
          <option value={PDV}>PDV</option>
          {analistasSel.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Selector mes + año */}
        <select style={sel} value={`${anio}-${mes}`} onChange={e => {
          const [a, m] = e.target.value.split('-');
          setAnio(Number(a)); setMes(Number(m));
        }}>
          {Array.from({ length: 18 }, (_, i) => {
            let m = now.getMonth() - i; let a = now.getFullYear();
            while (m < 0) { m += 12; a--; }
            return (
              <option key={`${a}-${m}`} value={`${a}-${m}`}>
                {m === now.getMonth() && a === now.getFullYear() ? 'Mes Actual' : `${CONFIG.MESES_NOMBRES[m].substring(0, 3)} ${a}`}
              </option>
            );
          })}
        </select>

        <select style={sel} value={anio} onChange={e => setAnio(Number(e.target.value))}>
          {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* ── KPI Capital ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginLeft: '4px' }}>
          <div style={{ width: 4, height: 16, background: '#fff', borderRadius: 2 }} />
          <div style={{ fontSize: '11px', color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>KPI CAPITAL TRANSACCIONAL</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={box}>
            <div style={lbl}><Target size={14} color="#666" /> OBJETIVO</div>
            <div style={val}>{formatCurrency(kpis.obj.meta_ventas)}</div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#fff" /> ALCANCE ACTUAL</div>
            <div style={val}>{formatCurrency(kpis.alcanceCapital)}</div>
            <div style={{ ...sub, color: kpis.tendPct >= 0 ? '#4ade80' : '#f87171' }}>
               {kpis.tendPct >= 0 ? '↑' : '↓'} {Math.abs(kpis.tendPct).toFixed(1)}% vs {prevMesLabel}
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><Zap size={14} color={kpis.cumplReal >= 100 ? '#4ade80' : '#fbbf24'} /> CUMPLIMIENTO</div>
            <div style={{ ...val, color: kpis.cumplReal >= 100 ? '#4ade80' : kpis.cumplReal >= 75 ? '#fbbf24' : '#f87171' }}>
              {pct(kpis.cumplReal)}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, kpis.cumplReal)}%`, height: '100%', background: kpis.cumplReal >= 100 ? '#4ade80' : kpis.cumplReal >= 75 ? '#fbbf24' : '#f87171' }} />
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#666" /> PROYECTADO FIN MES</div>
            <div style={val}>{formatCurrency(kpis.proyCapital)}</div>
            <div style={sub}>Días: {kpis.dt}/{kpis.dh} ({pct((kpis.dt/kpis.dh)*100)} del mes)</div>
          </div>
        </div>
      </div>

      {/* ── KPI Operaciones ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginLeft: '4px' }}>
          <div style={{ width: 4, height: 16, background: '#4ade80', borderRadius: 2 }} />
          <div style={{ fontSize: '11px', color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>KPI OPERACIONES LOGRADAS</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={box}>
            <div style={lbl}><Target size={14} color="#666" /> OBJETIVO</div>
            <div style={val}>{kpis.obj.meta_operaciones} <span style={{ fontSize: 13, color: '#444' }}>OPS</span></div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#fff" /> ALCANCE ACTUAL</div>
            <div style={val}>{kpis.alcanceOps} <span style={{ fontSize: 13, color: '#444' }}>OPS</span></div>
            <div style={{ ...sub, color: kpis.tendPctOps >= 0 ? '#4ade80' : '#f87171' }}>
               {kpis.tendPctOps >= 0 ? '↑' : '↓'} {Math.abs(kpis.tendPctOps).toFixed(1)}% vs {prevMesLabel}
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><Zap size={14} color={kpis.cumplRealOps >= 100 ? '#4ade80' : '#fbbf24'} /> CUMPLIMIENTO</div>
            <div style={{ ...val, color: kpis.cumplRealOps >= 100 ? '#4ade80' : kpis.cumplRealOps >= 75 ? '#fbbf24' : '#f87171' }}>
              {pct(kpis.cumplRealOps)}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, kpis.cumplRealOps)}%`, height: '100%', background: kpis.cumplRealOps >= 100 ? '#4ade80' : kpis.cumplRealOps >= 75 ? '#fbbf24' : '#f87171' }} />
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#666" /> PROYECTADO FIN MES</div>
            <div style={val}>{kpis.proyOps} <span style={{ fontSize: 13, color: '#444' }}>OPS</span></div>
            <div style={sub}>Misma tendencia ({pct(kpis.cumplProyOps)})</div>
          </div>
        </div>
      </div>

      {/* ── Alertas + Curva ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', marginBottom: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Alertas Premium */}
          <div style={card}>
            <div style={{ ...lbl, marginBottom: '20px' }}><AlertTriangle size={14} color="#f87171" /> ALERTAS DE GESTIÓN</div>
            {[
              { id: 'proy', label: 'PROYECCIÓN', count: alertas.proyeccion, icon: <TrendingUp size={16} />, color: '#fff', status: alertas.proyeccion > 20 ? 'URGENTE' : 'OK' },
              { id: 'seg', label: 'SEGUIMIENTO', count: alertas.seguimiento, icon: <Clock size={16} />, color: '#fbbf24', status: alertas.seguimiento > 5 ? 'REVISAR' : 'OK' },
              { id: 'afect', label: 'AFECTACIONES', count: alertas.afectaciones, icon: <ShieldAlert size={16} />, color: '#f87171', status: alertas.afectaciones > 0 ? 'URGENTE' : 'OK' },
            ].map(a => (
              <div key={a.id} style={{ 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '12px', 
                padding: '12px', 
                marginBottom: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: '#666' }}>
                    {a.icon} {a.label}
                  </div>
                  <div style={{ 
                    fontSize: '9px', 
                    fontWeight: 900, 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    background: a.status === 'OK' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    color: a.status === 'OK' ? '#4ade80' : '#f87171',
                    letterSpacing: '0.5px'
                  }}>
                    {a.status}
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                  {a.count} <span style={{ fontSize: '11px', color: '#444', fontWeight: 400 }}>Registros</span>
                </div>
              </div>
            ))}
          </div>

          {/* Reportes Anuales Refinado */}
          <div style={card}>
            <div style={{ ...lbl, marginBottom: '16px' }}><Users size={14} /> EQUIPO DE TRABAJO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[{ key: PDV, label: 'VISTA GLOBAL (PDV)' }, ...analistasSel.map(a => ({ key: a, label: a }))].map(a => (
                <div key={a.key} onClick={() => setAnalista(a.key)}
                  className="analista-item"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '10px 14px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    background: a.key === analista ? 'rgba(255,255,255,0.07)' : 'transparent',
                    border: `1px solid ${a.key === analista ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' 
                  }}>
                  <div style={{ 
                    width: 8, height: 8, borderRadius: '50%', 
                    background: a.key === analista ? '#4ade80' : '#444',
                    boxShadow: a.key === analista ? '0 0 10px rgba(74,222,128,0.5)' : 'none'
                  }} />
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: a.key === analista ? 700 : 500, 
                    color: a.key === analista ? '#fff' : '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Curva de crecimiento — MÁS ALTA */}
        <div style={{ ...card, height: '100%', minHeight: '620px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <Activity size={20} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>DINÁMICA DE CRECIMIENTO</div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                  Cumplimiento acumulado vs. Proyección ideal ({formatCurrency(curva.objetivo)})
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '10px', fontWeight: 900, letterSpacing: '1px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.3)' }} />
                <span style={{ color: '#888' }}>VENTA REAL</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 8px rgba(248,113,113,0.3)' }} />
                <span style={{ color: '#888' }}>SIN VENTAS</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '450px' }}>
            <Line data={curvaChart} options={curvaOpts} />
          </div>
        </div>
      </div>

      {/* ── Histórico 12 meses ── */}
      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>HISTÓRICO 12 MESES</div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '16px' }}>
          {historico[0]?.label} — {historico[11]?.label} {anio}
        </div>
        <div style={{ height: '260px' }}>
          <Bar data={histChart as any} options={histOpts as any} />
        </div>
      </div>

      {/* ── Comisiones + Resumen ── */}
      {analista !== PDV && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>$ COMISIONES</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ ...box, flex: 1 }}>
              <div style={lbl}>CAPITAL</div>
              <div style={{ ...val, fontSize: '16px' }}>{formatCurrency(kpis.comisiones.comisionCapital)}</div>
            </div>
            <div style={{ ...box, flex: 1 }}>
              <div style={lbl}>OPERACIONES</div>
              <div style={{ ...val, fontSize: '16px' }}>{formatCurrency(kpis.comisiones.comisionOperaciones)}</div>
            </div>
          </div>
          <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#555', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>TOTAL COMISIÓN</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#4ade80' }}>{formatCurrency(kpis.comisiones.comisionTotal)}</div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>≡ RESUMEN DE GESTIÓN</div>
          {resumenGestion.length === 0
            ? <div style={{ color: '#555', fontSize: '13px' }}>Sin registros activos</div>
            : resumenGestion.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '11px', color: '#555', fontWeight: 700 }}>{r.label}</div>
                <div>
                  <span style={{ fontSize: '12px', color: '#888' }}>{r.ops} | </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{formatCurrency(r.monto)}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>}
    </div>
  );
}
