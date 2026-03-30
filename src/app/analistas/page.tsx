'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { logAudit } from '@/lib/audit';
import { formatCurrency, calcularComisiones, calcularDiasHabilesAutomaticos, getStatusLabel } from '@/lib/utils';
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
  TrendingDown,
  Zap,
  Target,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  ChevronDown,
  FileText,
  RotateCcw,
  Plus,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

// PDV = vista combinada de TODOS los analistas (no es un analista real en la DB)
const PDV = '__pdv__';

const numFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toFixed(1)}%`;
const mesStr = (anio: number, mes: number) => `${anio}-${String(mes + 1).padStart(2, '0')}`;
const esVenta = (estado: string) =>
  estado.toLowerCase() === 'venta' || estado.toLowerCase().includes('aprobado cc');

interface Reg { 
  analista: string; 
  estado: string; 
  monto: number; 
  fecha: string | null; 
  tipo_cliente?: string;
  es_re?: boolean;
  acuerdo_precios?: string;
}
interface DiasConfig { analista: string; dias_habiles: number; dias_transcurridos: number; }

const CHART_COLORS: Record<string, string> = {
  venta: '#ffffff',
  proyeccion: 'rgba(255,255,255,0.6)',
  'en seguimiento': 'rgba(255,255,255,0.4)',
  'score bajo': 'rgba(255,255,255,0.25)',
  afectaciones: 'rgba(248,113,113,0.4)',
  'derivado / aprobado cc': 'rgba(255,255,255,0.7)',
  'derivado / rechazado cc': 'rgba(248,113,113,0.3)',
};

const ESTADOS_METRICAS = [
  'venta', 'proyeccion', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc',
];

const ESTADOS_RESUMEN = [
  { key: 'proyeccion', label: 'PROYECCIONES' },
  { key: 'en seguimiento', label: 'EN SEGUIMIENTO' },
  { key: 'score bajo', label: 'SCORE BAJO' },
  { key: 'afectaciones', label: 'AFECTACIONES' },
  { key: 'derivado / aprobado cc', label: 'DERIVADO APROBADO CC' },
  { key: 'derivado / rechazado cc', label: 'DERIVADO RECHAZADO CC' },
];

interface MesData { mes: string; obj: string; real: string; cumpl: string; cumplPct: number | null; varIM: string; ops: string; alcance: string; cumplOps: string; cumplOpsPct: number | null; varIMOps: string; }
interface SeccionData { anio: number; meses: MesData[]; }
interface HistoricoData { secciones: SeccionData[]; }
interface PDVMes { mes: string; obj: string; real: string; cumpl: string; cumplPct: number | null; var: string; }
interface PDVData { years: number[]; yearData: Record<number, { capital: PDVMes[]; operaciones: PDVMes[] | null }>; }

function pctColor(v: number | null) { if (v === null) return '#333'; if (v >= 100) return '#34d399'; return '#f87171'; }
function varColor(_v: string) { return '#ffffff'; }

function PDVHistorico({ data }: { data: PDVData }) {
  const [anioSel, setAnioSel] = useState<number>(() => data.years[data.years.length - 1]);
  const yd = data.yearData[anioSel];
  const capitalRows: PDVMes[] = (yd?.capital ?? []) as PDVMes[];
  const opsRows: PDVMes[] | null = (yd?.operaciones ?? null) as PDVMes[] | null;

  const trimestres = [0,1,2,3].map(q => {
    const meses = capitalRows.slice(q * 3, q * 3 + 3).filter(m => m.cumplPct !== null);
    if (!meses.length) return null;
    return meses.reduce((s, m) => s + (m.cumplPct ?? 0), 0) / meses.length;
  });

  const th: React.CSSProperties = { padding: '8px 12px', color: '#444', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' };

  const MiniTable = ({ titulo, filas }: { titulo: string; filas: PDVMes[] }) => (
    <div style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', overflow: 'auto', flex: 1 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>{titulo}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead><tr>
          {['Mes','Objetivo','Alcance','Cumpl.','Var'].map(h => <th key={h} style={{ ...th, textAlign: 'center' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filas.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.mes}</td>
              <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.obj}</td>
              <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.real}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {r.cumplPct !== null ? <span style={{ color: pctColor(r.cumplPct), fontWeight: 800, fontSize: '11px', background: `${pctColor(r.cumplPct)}18`, padding: '2px 7px', borderRadius: '6px' }}>{r.cumpl}</span> : <span style={{ color: '#fff' }}>—</span>}
              </td>
              <td style={{ padding: '8px 12px', color: '#fff', textAlign: 'center' }}>{r.var !== '-' ? r.var : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '1px' }}>Histórico Anual — PDV</div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px', display: 'flex', gap: '2px' }}>
            {['Q1','Q2','Q3','Q4'].map((q, i) => (
              <div key={q} style={{ padding: '4px 12px', textAlign: 'center', minWidth: '50px' }}>
                <div style={{ fontSize: '8px', color: '#444', fontWeight: 800, letterSpacing: '1px' }}>{q}</div>
                <div style={{ fontSize: '12px', fontWeight: 900, color: pctColor(trimestres[i]) }}>{trimestres[i] !== null ? `${trimestres[i]!.toFixed(1)}%` : '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px', display: 'flex', gap: '2px' }}>
            {data.years.map(a => (
              <button key={a} onClick={() => setAnioSel(a)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: anioSel === a ? '#f7e479' : 'transparent', color: anioSel === a ? '#000' : '#555' }}>{a}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <MiniTable titulo="Capital" filas={capitalRows} />
        {opsRows && opsRows.length > 0 && <MiniTable titulo="Operaciones" filas={opsRows} />}
      </div>
    </div>
  );
}

function AnalistaHistorico({ data, nombre }: { data: HistoricoData; nombre: string }) {
  const [anioSel, setAnioSel] = useState<number>(() =>
    data.secciones.length ? data.secciones[data.secciones.length - 1].anio : new Date().getFullYear()
  );

  const seccion = data.secciones.find(s => s.anio === anioSel);
  const th: React.CSSProperties = { padding: '8px 12px', color: '#444', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' };

  // Calcular Q1-Q4 desde los meses del año seleccionado
  const trimestres = [0,1,2,3].map(q => {
    const meses = seccion?.meses.slice(q * 3, q * 3 + 3) ?? [];
    const validos = meses.filter(m => m.cumplPct !== null);
    if (!validos.length) return null;
    const avg = validos.reduce((s, m) => s + (m.cumplPct ?? 0), 0) / validos.length;
    return avg;
  });

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '1px' }}>Histórico Anual — {nombre}</div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Trimestrales en bloque similar a los años */}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px', display: 'flex', gap: '2px' }}>
            {['Q1','Q2','Q3','Q4'].map((q, i) => {
              const val = trimestres[i];
              return (
                <div key={q} style={{ padding: '4px 12px', textAlign: 'center', minWidth: '50px' }}>
                  <div style={{ fontSize: '8px', color: '#444', fontWeight: 800, letterSpacing: '1px' }}>{q}</div>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: pctColor(val) }}>{val !== null ? `${val.toFixed(1)}%` : '—'}</div>
                </div>
              );
            })}
          </div>
          {/* Selector año */}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px', display: 'flex', gap: '2px' }}>
            {data.secciones.map(s => (
              <button key={s.anio} onClick={() => setAnioSel(s.anio)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: anioSel === s.anio ? '#f7e479' : 'transparent', color: anioSel === s.anio ? '#000' : '#555' }}>{s.anio}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      {seccion && (
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'center' }}>Mes</th>
                <th style={{ ...th, textAlign: 'center' }}>Objetivo</th>
                <th style={{ ...th, textAlign: 'center' }}>Alcance</th>
                <th style={{ ...th, textAlign: 'center' }}>Cumpl.</th>
                <th style={{ ...th, textAlign: 'center' }}>Var.IM</th>
                <th style={{ ...th, textAlign: 'center' }}>Objetivo</th>
                <th style={{ ...th, textAlign: 'center' }}>Alcance</th>
                <th style={{ ...th, textAlign: 'center' }}>Cumpl.</th>
                <th style={{ ...th, textAlign: 'center' }}>Var.IM</th>
              </tr>
            </thead>
            <tbody>
              {seccion.meses.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.mes}</td>
                  <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.obj}</td>
                  <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.real}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    {r.cumplPct !== null ? <span style={{ color: pctColor(r.cumplPct), fontWeight: 800, fontSize: '11px', background: `${pctColor(r.cumplPct)}18`, padding: '2px 7px', borderRadius: '6px' }}>{r.cumpl}</span> : <span style={{ color: '#fff' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#fff', textAlign: 'center' }}>{r.varIM !== '-' ? r.varIM : '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.ops}</td>
                  <td style={{ padding: '8px 12px', color: '#444', textAlign: 'center' }}>{r.alcance}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    {r.cumplOpsPct !== null ? <span style={{ color: pctColor(r.cumplOpsPct), fontWeight: 800, fontSize: '11px', background: `${pctColor(r.cumplOpsPct)}18`, padding: '2px 7px', borderRadius: '6px' }}>{r.cumplOps}</span> : <span style={{ color: '#fff' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#fff', textAlign: 'center' }}>{r.varIMOps !== '-' ? r.varIMOps : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AnalistasPage() {
  const now = new Date();
  const [analista, setAnalista] = useState<string>(PDV);


  const [mes, setMes] = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());

  const { registros: rawRegs, objetivos: todosObjs, diasConfig: diasCfg, historicoVentas, loading } = useData();
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

  // ── Histórico Anual — calculado desde Supabase en tiempo real ────────────
  const historicoAnualData = useMemo(() => {
    const fmtK = (v: number) => v > 0 ? `$${numFmt.format(v)}` : '-';
    const fmtPct = (v: number) => `${v.toFixed(1)}%`;
    const fmtVar = (curr: number, prev: number) => {
      if (prev === 0) return '-';
      const p = ((curr - prev) / prev) * 100;
      return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
    };

    const aniosSet = new Set<number>();
    todosObjs.forEach(o => aniosSet.add(o.anio));
    historicoVentas.forEach(h => aniosSet.add(h.anio));
    aniosSet.add(new Date().getFullYear());
    const anios = Array.from(aniosSet).sort();

    const buildAnalistaHistorico = (analistaName: string): HistoricoData => {
      const secciones = anios.map(anio => {
        let prevMonto = 0, prevOps = 0;
        const meses: MesData[] = [];
        CONFIG.MESES_NOMBRES.forEach((mesNombre, mesIdx) => {
          const mesKey = mesStr(anio, mesIdx);
          const mesRegs = todosRegs.filter(r =>
            r.analista === analistaName &&
            r.fecha?.slice(0, 7) === mesKey &&
            esVenta(r.estado || '')
          );
          const regsCapital = mesRegs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
          const regsOps = mesRegs.length;
          const histEntry = historicoVentas.find(h => h.analista === analistaName && h.anio === anio && h.mes === mesIdx);
          const real = regsCapital > 0 ? regsCapital : (histEntry?.capital_real || 0);
          const opsReal = regsOps > 0 ? regsOps : (histEntry?.ops_real || 0);
          const obj = todosObjs.find(o => o.analista === analistaName && o.mes === mesIdx && o.anio === anio);
          const metaVentas = Number(obj?.meta_ventas) || 0;
          const metaOps = Number(obj?.meta_operaciones) || 0;
          const cumplPct = metaVentas > 0 ? (real / metaVentas) * 100 : null;
          const cumplOpsPct = metaOps > 0 ? (opsReal / metaOps) * 100 : null;
          const varIM = fmtVar(real, prevMonto);
          const varIMOps = fmtVar(opsReal, prevOps);
          prevMonto = real;
          prevOps = opsReal;
          if (metaVentas === 0 && real === 0) return;
          meses.push({
            mes: mesNombre,
            obj: metaVentas > 0 ? fmtK(metaVentas) : '-',
            real: real > 0 ? fmtK(real) : '-',
            cumpl: cumplPct !== null ? fmtPct(cumplPct) : '-',
            cumplPct,
            varIM,
            ops: metaOps > 0 ? String(metaOps) : '-',
            alcance: opsReal > 0 ? String(opsReal) : '-',
            cumplOps: cumplOpsPct !== null ? fmtPct(cumplOpsPct) : '-',
            cumplOpsPct,
            varIMOps,
          });
        });
        return { anio, meses };
      }).filter(s => s.meses.length > 0);
      return { secciones };
    };

    const buildPDVHistorico = (): PDVData => {
      const yearsData: PDVData['yearData'] = {};
      anios.forEach(anio => {
        let prevCapital = 0, prevOps = 0;
        const capitalRows: PDVMes[] = [];
        const opsRows: PDVMes[] = [];
        CONFIG.MESES_NOMBRES.forEach((mesNombre, mesIdx) => {
          const mesKey = mesStr(anio, mesIdx);
          const mesRegs = todosRegs.filter(r =>
            r.fecha?.slice(0, 7) === mesKey && esVenta(r.estado || '')
          );
          const regsCapital = mesRegs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
          const regsOps = mesRegs.length;
          const pdvHist = historicoVentas.filter(h => h.analista === 'PDV' && h.anio === anio && h.mes === mesIdx);
          const indivHist = historicoVentas.filter(h => h.analista !== 'PDV' && h.anio === anio && h.mes === mesIdx);
          const histSrc = pdvHist.length > 0 ? pdvHist : indivHist;
          const histSum = histSrc.reduce((s, h) => s + (h.capital_real || 0), 0);
          const histOpsSum = histSrc.reduce((s, h) => s + (h.ops_real || 0), 0);
          const real = regsCapital > 0 ? regsCapital : histSum;
          const opsReal = regsOps > 0 ? regsOps : histOpsSum;
          const pdvObjs = todosObjs.filter(o => o.mes === mesIdx && o.anio === anio && o.analista === 'PDV');
          const objsForMonth = pdvObjs.length > 0
            ? pdvObjs
            : todosObjs.filter(o => o.mes === mesIdx && o.anio === anio && CONFIG.ANALISTAS_DEFAULT.includes(o.analista));
          const metaVentas = objsForMonth.reduce((s, o) => s + (Number(o.meta_ventas) || 0), 0);
          const metaOps = objsForMonth.reduce((s, o) => s + (Number(o.meta_operaciones) || 0), 0);
          const cumplPct = metaVentas > 0 ? (real / metaVentas) * 100 : null;
          const cumplOpsPct = metaOps > 0 ? (opsReal / metaOps) * 100 : null;
          const varCapital = fmtVar(real, prevCapital);
          const varOps = fmtVar(opsReal, prevOps);
          prevCapital = real;
          prevOps = opsReal;
          if (metaVentas === 0 && real === 0) return;
          capitalRows.push({ mes: mesNombre, obj: metaVentas > 0 ? fmtK(metaVentas) : '-', real: real > 0 ? fmtK(real) : '-', cumpl: cumplPct !== null ? fmtPct(cumplPct) : '-', cumplPct, var: varCapital });
          opsRows.push({ mes: mesNombre, obj: metaOps > 0 ? String(metaOps) : '-', real: opsReal > 0 ? String(opsReal) : '-', cumpl: cumplOpsPct !== null ? fmtPct(cumplOpsPct) : '-', cumplPct: cumplOpsPct, var: varOps });
        });
        if (capitalRows.length > 0) yearsData[anio] = { capital: capitalRows, operaciones: opsRows.length > 0 ? opsRows : null };
      });
      const validYears = Object.keys(yearsData).map(Number).sort();
      return { years: validYears, yearData: yearsData };
    };

    return {
      analistaSel: analista !== PDV ? buildAnalistaHistorico(analista) : { secciones: [] as SeccionData[] },
      pdv: buildPDVHistorico(),
    };
  }, [todosRegs, todosObjs, analista, historicoVentas]);

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

    const aperturas = regs.filter(r => r.fecha?.slice(0, 7) === key && r.tipo_cliente === 'Apertura').length;
    const renovaciones = regs.filter(r => r.fecha?.slice(0, 7) === key && (r.tipo_cliente === 'Renovacion' || r.es_re)).length;
    
    // Desglose de acuerdos
    const acuerdosBajo = regs.filter(r => r.fecha?.slice(0, 7) === key && r.acuerdo_precios === 'Riesgo Bajo').length;
    const acuerdosMedio = regs.filter(r => r.fecha?.slice(0, 7) === key && r.acuerdo_precios === 'Riesgo Medio').length;
    const acuerdosPremium = regs.filter(r => r.fecha?.slice(0, 7) === key && r.acuerdo_precios === 'Premium').length;
    const acuerdos = acuerdosBajo + acuerdosMedio + acuerdosPremium;

    return {
      obj, alcanceCapital, alcanceOps,
      alcancePrev, prevOpsPrev, tendPct, tendPctOps,
      proyCapital, proyOps,
      cumplReal, cumplProy, cumplRealOps, cumplProyOps,
      dh, dt, comisiones, pMes, pAnio,
      aperturas, renovaciones, acuerdos,
      acuerdosBajo, acuerdosMedio, acuerdosPremium
    };
  }, [regs, objMap, diasInfo, mes, anio]);

  // ── Curva de crecimiento (acumulado diario) ──────────────────────
  const curva = useMemo(() => {
    const lastDay = new Date(anio, mes + 1, 0).getDate();
    const key = mesStr(anio, mes);
    const ventasMes = regs.filter(r => r.fecha?.slice(0, 7) === key && esVenta(r.estado || ''));
    let acum = 0;
    let lastAcum = 0;
    const stats = [
      { acum: 0, hasSale: false, day: 0 },
      ...Array.from({ length: lastDay }, (_, i) => {
        const d = String(i + 1).padStart(2, '0');
        const v = ventasMes.filter(r => r.fecha?.slice(8, 10) === d)
          .reduce((s, r) => s + (Number(r.monto) || 0), 0);
        acum += v;
        const hasSale = v > 0;
        const data = { acum, hasSale, day: i + 1 };
        lastAcum = acum;
        return data;
      })
    ];

    const hoyStr = mesStr(now.getFullYear(), now.getMonth());
    const diaHoy = key === hoyStr ? now.getDate() : lastDay;
    const objetivo = kpis.obj.meta_ventas;
    const referencias = [0, ...Array.from({ length: lastDay }, (_, i) =>
      Math.round((objetivo / lastDay) * (i + 1))
    )];

    return { 
      dias: [0, ...Array.from({ length: lastDay }, (_, i) => i + 1)], 
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

  const metricasEstados = useMemo(() => {
    const key = mesStr(anio, mes);
    const filtrados = regs.filter(r => r.fecha?.slice(0, 7) === key);
    return ESTADOS_METRICAS.map(st => {
      const match = filtrados.filter(r => r.estado?.toLowerCase() === st);
      return {
        key: st,
        label: getStatusLabel(st),
        monto: match.reduce((s, r) => s + (Number(r.monto) || 0), 0),
        ops: match.length,
        color: CHART_COLORS[st] || '#888',
      };
    });
  }, [regs, mes, anio]);

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
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.45)'); 
          gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
          return gradient;
        },
        fill: true, 
        tension: 0.4, 
        borderWidth: 2, 
        pointRadius: curva.dias.map(d => d <= curva.diaHoy ? 4 : 0), 
        pointBackgroundColor: '#fff', 
        pointBorderColor: '#000', 
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
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
        title: { display: true, text: 'Día Calendario', color: '#444', font: { size: 12 } },
        ticks: { color: '#666', font: { size: 11 } }, 
        grid: { display: false } 
      },
      y: { 
        ticks: { 
          color: '#666', 
          font: { size: 11 },
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
        type: 'line' as const,
        label: 'Meta 100%',
        data: historico.map(() => 100),
        borderColor: '#f87171',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        yAxisID: 'y2',
      },
      {
        type: 'line' as const, label: 'Cumpl. %',
        data: historico.map(h => h.cumplimiento),
        borderColor: '#fff', 
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'transparent';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          return gradient;
        },
        fill: true,
        pointRadius: 8,
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y2',
        pointBackgroundColor: historico.map(h => h.alcance > 0 ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 10,
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
      x: { ticks: { color: '#555', font: { family: 'Outfit', size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#555', font: { family: 'Outfit', size: 11 }, callback: (v: string | number) => `$${numFmt.format(Number(v) / 1000000)}M` }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y2: { 
        position: 'right' as const, 
        min: 0, suggestedMax: 120, 
        ticks: { color: '#555', font: { family: 'Outfit', size: 11 }, callback: (v: string | number) => `${v}%` }, 
        grid: { display: false } 
      },
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
    background: '#0a0a0a', 
    border: '1px solid rgba(255,255,255,0.02)',
    borderRadius: '16px', 
    padding: '16px', 
    minWidth: '220px',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)', 
    position: 'relative',
    overflow: 'hidden',
  };

  const lbl: React.CSSProperties = { 
    fontSize: '11px', 
    color: '#888', 
    fontWeight: 700, 
    textTransform: 'uppercase', 
    letterSpacing: '1px', 
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const val: React.CSSProperties = { 
    fontSize: '22px', 
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
    border: '1px solid rgba(255,255,255,0.02)', 
    borderRadius: '24px', 
    padding: '16px',
    boxShadow: '0 10px 50px rgba(0,0,0,0.5)', // Eliminado brillo excesivo
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
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ ...lbl, fontSize: '14px', borderLeft: '4px solid #fff', paddingLeft: '12px', marginBottom: 0, color: '#fff' }}>CAPITAL</div>

        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={box}>
            <div style={lbl}><Target size={14} color="#666" /> OBJETIVO</div>
            <div style={val}>{formatCurrency(kpis.obj.meta_ventas)}</div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#fff" /> ALCANCE ACTUAL</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '15px' }}>
              <div>
                <div style={val}>{formatCurrency(kpis.alcanceCapital)}</div>
                <div style={{ ...sub, color: kpis.tendPct >= 0 ? '#fff' : '#f87171' }}>
                  <div style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {kpis.tendPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(kpis.tendPct).toFixed(1)}% vs {prevMesLabel}
                  </div>
                </div>
              </div>
              {/* Sparkline (Mini Gráfico) */}
              <div style={{ width: '100px', height: '50px' }}>
                <Line 
                  data={{
                    labels: curva.stats.map(s => s.day),
                    datasets: [{
                      data: curva.stats.map(s => s.acum),
                      borderColor: kpis.tendPct >= 0 ? '#4ade80' : '#f87171',
                      backgroundColor: (context: any) => {
                        const canvas = context.chart.ctx;
                        const gradient = canvas.createLinearGradient(0, 0, 0, 50);
                        gradient.addColorStop(0, kpis.tendPct >= 0 ? 'rgba(74, 222, 128, 0.5)' : 'rgba(248, 113, 113, 0.5)');
                        gradient.addColorStop(0.7, kpis.tendPct >= 0 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)');
                        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Difuminado total al final
                        return gradient;
                      },
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.4,
                      fill: true,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: { x: { display: false }, y: { display: false } }
                  }}
                />
              </div>
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><Zap size={14} color={kpis.cumplReal >= 100 ? '#4ade80' : '#f87171'} /> CUMPLIMIENTO</div>
            <div style={{ ...val, color: '#fff' }}>
              {pct(kpis.cumplReal)}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, kpis.cumplReal)}%`, height: '100%', background: kpis.cumplReal >= 100 ? '#fff' : '#f87171' }} />
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#666" /> PROYECTADO FIN MES</div>
            <div style={val}>{formatCurrency(kpis.proyCapital)}</div>
            <div style={sub}>Tendencia actual ({pct(kpis.cumplProy)})</div>
          </div>
          <div style={box}>
            <div style={lbl}><Zap size={14} color={kpis.cumplProy >= 100 ? '#4ade80' : '#f87171'} /> CUMPL. PROYECTADO</div>
            <div style={{ ...val, color: '#fff' }}>
              {pct(kpis.cumplProy)}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, kpis.cumplProy)}%`, height: '100%', background: kpis.cumplProy >= 100 ? '#fff' : '#f87171' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Operaciones ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ ...lbl, fontSize: '14px', borderLeft: '4px solid #4ade80', paddingLeft: '12px', marginBottom: 0, color: '#fff' }}>OPERACIONES</div>

        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={box}>
            <div style={lbl}><Target size={14} color="#666" /> OBJETIVO</div>
            <div style={val}>{kpis.obj.meta_operaciones} <span style={{ fontSize: 13, color: '#444' }}>OPS</span></div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#fff" /> ALCANCE ACTUAL</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '15px' }}>
              <div>
                <div style={val}>{kpis.alcanceOps} <span style={{ fontSize: 13, color: '#444' }}>OPS</span></div>
                <div style={{ ...sub, color: kpis.tendPctOps >= 0 ? '#4ade80' : '#f87171' }}>
                  <div style={{ padding: '2px 6px', borderRadius: '4px', background: kpis.tendPctOps >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {kpis.tendPctOps >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(kpis.tendPctOps).toFixed(1)}% vs {prevMesLabel}
                  </div>
                </div>
              </div>
              {/* Sparkline Operaciones */}
              <div style={{ width: '100px', height: '50px' }}>
                <Line 
                  data={{
                    labels: curva.dias,
                    datasets: [{
                      data: curva.stats.map(s => s.acum > 0 ? (s.acum / 100000) : 0), // Simplificado para ops
                      borderColor: kpis.tendPctOps >= 0 ? '#4ade80' : '#f87171',
                      backgroundColor: (context: any) => {
                        const canvas = context.chart.ctx;
                        const gradient = canvas.createLinearGradient(0, 0, 0, 50);
                        gradient.addColorStop(0, kpis.tendPctOps >= 0 ? 'rgba(74, 222, 128, 0.5)' : 'rgba(248, 113, 113, 0.5)');
                        gradient.addColorStop(0.7, kpis.tendPctOps >= 0 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)');
                        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Difuminado total al final
                        return gradient;
                      },
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.4,
                      fill: true,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: { x: { display: false }, y: { display: false } }
                  }}
                />
              </div>
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><Zap size={14} color={kpis.cumplRealOps >= 100 ? '#4ade80' : '#f87171'} /> CUMPLIMIENTO</div>
            <div style={{ ...val, color: kpis.cumplRealOps >= 100 ? '#4ade80' : '#f87171' }}>
              {pct(kpis.cumplRealOps)}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, kpis.cumplRealOps)}%`, height: '100%', background: kpis.cumplRealOps >= 100 ? '#fff' : '#f87171' }} />
            </div>
          </div>
          <div style={box}>
            <div style={lbl}><TrendingUp size={14} color="#666" /> PROYECTADO FIN MES</div>
            <div style={val}>{kpis.proyOps} <span style={{ fontSize: 13, color: '#444' }}>OPS</span></div>
            <div style={sub}>Tendencia actual ({pct(kpis.cumplProyOps)})</div>
          </div>
          <div style={box}>
            <div style={lbl}><Zap size={14} color={kpis.cumplProyOps >= 100 ? '#4ade80' : '#f87171'} /> CUMPL. PROYECTADO</div>
            <div style={{ ...val, color: kpis.cumplProyOps >= 100 ? '#4ade80' : '#f87171' }}>
              {pct(kpis.cumplProyOps)}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, kpis.cumplProyOps)}%`, height: '100%', background: kpis.cumplProyOps >= 100 ? '#fff' : '#f87171' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertas + Curva ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
          
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
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                  {a.count} <span style={{ fontSize: '10px', color: '#444', fontWeight: 400 }}>Registros</span>
                </div>
              </div>
            ))}
          </div>

          {/* Reportes Anuales Refinado */}
          <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
              <div style={{ padding: '10px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                <Activity size={20} style={{ color: '#4ade80' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>DINÁMICA DE CRECIMIENTO</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                  Cumplimiento acumulado vs. Proyección ideal ({formatCurrency(curva.objetivo)})
                </div>
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
        <div style={{ height: '320px' }}>
          <Bar data={histChart as any} options={histOpts as any} />
        </div>
      </div>

      {/* ── Histórico anual ── */}
      {analista === PDV && historicoAnualData.pdv.years.length > 0 && (
        <div style={{ ...card, marginBottom: '16px' }}>
          <PDVHistorico data={historicoAnualData.pdv} />
        </div>
      )}
      {analista !== PDV && historicoAnualData.analistaSel.secciones.length > 0 && (
        <div style={{ ...card, marginBottom: '16px' }}>
          <AnalistaHistorico data={historicoAnualData.analistaSel} nombre={analista} />
        </div>
      )}

    </div>
  );
}
