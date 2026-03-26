'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, calcularComisiones, calcularDiasHabilesAutomaticos } from '@/lib/utils';
import { CONFIG } from '@/types';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

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
  const [loading, setLoading] = useState(true);

  // Datos crudos — cargados una sola vez
  const [todosRegs, setTodosRegs] = useState<Reg[]>([]);
  const [todosObjs, setTodosObjs] = useState<{ analista: string; mes: number; anio: number; meta_ventas: number; meta_operaciones: number }[]>([]);
  const [diasCfg, setDiasCfg] = useState<DiasConfig[]>([]);
  const [analistasSel, setAnalistasSel] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('registros').select('analista, estado, monto, fecha'),
      supabase.from('objetivos').select('*'),
      supabase.from('dias_habiles_config').select('analista, dias_habiles, dias_transcurridos'),
    ]).then(([{ data: regs }, { data: objs }, { data: dias }]) => {
      const regsArr = (regs || []) as Reg[];
      setTodosRegs(regsArr);
      setTodosObjs(objs || []);
      setDiasCfg((dias || []) as DiasConfig[]);

      // Analistas únicos, excluyendo "Column 5" (alias de PDV) y valores basura
      // (filas de totales del CSV que contienen $, %, o empiezan con número)
      const esAnalistaValido = (a: string) =>
        a && a !== 'Column 5' && a !== 'Column5' &&
        !a.startsWith('$') && !a.includes('%') && !/^\d/.test(a.trim());
      const set = new Set(
        regsArr
          .map(r => r.analista)
          .filter(esAnalistaValido)
      );
      setAnalistasSel(Array.from(set) as string[]);
      setLoading(false);
    });
  }, []);

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
    const acumulados = Array.from({ length: lastDay }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      const v = ventasMes.filter(r => r.fecha?.slice(8, 10) === d)
        .reduce((s, r) => s + (Number(r.monto) || 0), 0);
      acum += v;
      return acum;
    });

    const hoyStr = mesStr(now.getFullYear(), now.getMonth());
    const diaHoy = key === hoyStr ? now.getDate() : lastDay;
    const objetivo = kpis.obj.meta_ventas;
    const referencias = Array.from({ length: lastDay }, (_, i) =>
      Math.round((objetivo / lastDay) * (i + 1))
    );

    return { dias: Array.from({ length: lastDay }, (_, i) => i + 1), acumulados, referencias, diaHoy };
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
        label: 'Venta',
        data: curva.acumulados,
        borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.07)',
        fill: true, tension: 0.4, borderWidth: 2,
        pointRadius: curva.dias.map(d => d === curva.diaHoy ? 5 : 0),
        pointBackgroundColor: '#f87171',
      },
      {
        label: 'Referencia',
        data: curva.referencias,
        borderColor: 'rgba(255,255,255,0.2)', borderDash: [6, 4],
        fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5,
      },
    ],
  };

  const curvaOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } } },
    scales: {
      x: { ticks: { color: '#444', font: { size: 10 as const } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#444', callback: (v: string | number) => `$${numFmt.format(Number(v) / 1000000)}M` }, grid: { color: 'rgba(255,255,255,0.03)' } },
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
    flex: 1, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px', padding: '12px 16px', minWidth: '180px',
  };

  const lbl: React.CSSProperties = { fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' };
  const val: React.CSSProperties = { fontSize: '18px', fontWeight: 800, color: '#fff', lineHeight: 1 };
  const sub: React.CSSProperties = { fontSize: '11px', color: '#555', marginTop: '4px' };

  const card: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px',
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
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '12px 20px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', flex: 1, minWidth: 200 }}>
          PANEL DE CONTROL — {analista === PDV ? 'PDV' : analista.toUpperCase()}
        </div>
        <div style={{ fontSize: '11px', color: '#555' }}>
          Período: {mes === now.getMonth() && anio === now.getFullYear() ? 'Mes Actual' : `${CONFIG.MESES_NOMBRES[mes]} ${anio}`}
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
      <div style={{ ...card, marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>● CAPITAL ($K)</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={box}>
            <div style={lbl}>OBJETIVO</div>
            <div style={val}>{formatCurrency(kpis.obj.meta_ventas)}</div>
          </div>
          <div style={box}>
            <div style={lbl}>ALCANCE</div>
            <div style={val}>{formatCurrency(kpis.alcanceCapital)}</div>
            <div style={{ ...sub, color: kpis.tendPct >= 0 ? '#4ade80' : '#f87171' }}>
              {prevMesLabel}: {formatCurrency(kpis.alcancePrev)} ({kpis.tendPct >= 0 ? '+' : ''}{kpis.tendPct.toFixed(1)}%)
            </div>
          </div>
          <div style={box}>
            <div style={lbl}>CUMPLIMIENTO REAL</div>
            <div style={{ ...val, color: kpis.cumplReal >= 100 ? '#4ade80' : kpis.cumplReal >= 75 ? '#fbbf24' : '#f87171' }}>
              {pct(kpis.cumplReal)}
            </div>
          </div>
          <div style={box}>
            <div style={lbl}>PROYECTADO</div>
            <div style={val}>{formatCurrency(kpis.proyCapital)}</div>
            <div style={sub}>{kpis.dt} / {kpis.dh} días</div>
          </div>
          <div style={box}>
            <div style={lbl}>CUMPL. PROYECTADO</div>
            <div style={{ ...val, color: kpis.cumplProy >= 100 ? '#4ade80' : kpis.cumplProy >= 75 ? '#fbbf24' : '#f87171' }}>
              {pct(kpis.cumplProy)}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Operaciones ── */}
      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>● OPERACIONES (N)</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={box}>
            <div style={lbl}>OBJETIVO</div>
            <div style={val}>{kpis.obj.meta_operaciones}</div>
          </div>
          <div style={box}>
            <div style={lbl}>ALCANCE</div>
            <div style={val}>{kpis.alcanceOps}</div>
            <div style={{ ...sub, color: kpis.tendPctOps >= 0 ? '#4ade80' : '#f87171' }}>
              {prevMesLabel}: {kpis.prevOpsPrev} ({kpis.tendPctOps >= 0 ? '+' : ''}{kpis.tendPctOps.toFixed(1)}%)
            </div>
          </div>
          <div style={box}>
            <div style={lbl}>CUMPLIMIENTO REAL</div>
            <div style={{ ...val, color: kpis.cumplRealOps >= 100 ? '#4ade80' : kpis.cumplRealOps >= 75 ? '#fbbf24' : '#f87171' }}>
              {pct(kpis.cumplRealOps)}
            </div>
          </div>
          <div style={box}>
            <div style={lbl}>PROYECTADO</div>
            <div style={val}>{kpis.proyOps}</div>
          </div>
          <div style={box}>
            <div style={lbl}>CUMPL. PROYECTADO</div>
            <div style={{ ...val, color: kpis.cumplProyOps >= 100 ? '#4ade80' : kpis.cumplProyOps >= 75 ? '#fbbf24' : '#f87171' }}>
              {pct(kpis.cumplProyOps)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertas + Curva ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Alertas */}
          <div style={card}>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>ALERTAS DE GESTIÓN</div>
            {[
              { label: 'PROYECCIÓN', count: alertas.proyeccion, urgente: alertas.proyeccion > 20 },
              { label: 'EN SEGUIMIENTO', count: alertas.seguimiento, urgente: alertas.seguimiento > 5 },
              { label: 'AFECTACIONES', count: alertas.afectaciones, urgente: alertas.afectaciones > 0 },
            ].map(a => (
              <div key={a.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: '#555', fontWeight: 600 }}>{a.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{a.count}</span>
                  <span style={{ fontSize: '9px', color: a.count > 0 && a.urgente ? '#f87171' : a.count > 0 ? '#fbbf24' : '#4ade80', fontWeight: 700 }}>
                    {a.count === 0 ? 'OK' : a.urgente ? 'URGENTE' : 'REVISAR'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Reportes anuales */}
          <div style={card}>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>REPORTES ANUALES</div>
            {[{ key: PDV, label: 'PDV' }, ...analistasSel.map(a => ({ key: a, label: a }))].map(a => (
              <div key={a.key} onClick={() => setAnalista(a.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', background: a.key === analista ? 'rgba(255,255,255,0.07)' : 'transparent', transition: 'background 0.15s' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: a.key === analista ? 700 : 400, color: a.key === analista ? '#fff' : '#666' }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Curva de crecimiento */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CURVA DE CRECIMIENTO</div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                {CONFIG.MESES_NOMBRES[mes]} {anio} — día {kpis.dt}/{kpis.dh}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#555' }}>
              <span>● VENTA</span><span style={{ color: '#f87171' }}>- - REFERENCIA</span>
            </div>
          </div>
          <div style={{ height: '260px' }}>
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
