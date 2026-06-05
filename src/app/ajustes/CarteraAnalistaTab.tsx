'use client';

import React, { useMemo, useState } from 'react';
import { Registro, CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { formatCurrency } from '@/lib/utils';
import { Briefcase, Users, Filter, PieChart, BarChart3, Shield, FileText, ChevronDown } from 'lucide-react';

// ── Clasificadores de estado ──────────────────────────────────────────────
const low = (s?: string | null) => (s ?? '').toLowerCase().trim();
const isVentaPura  = (r: Registro) => low(r.estado) === 'venta';
const isAprobCC    = (r: Registro) => low(r.estado).includes('aprobado cc');
const isAprobado   = (r: Registro) => isVentaPura(r) || isAprobCC(r);
const isEnSeg      = (r: Registro) => low(r.estado) === 'en seguimiento';
const isCerrado    = (r: Registro) => {
  const e = low(r.estado);
  return e !== 'proyeccion' && e !== 'en seguimiento' && e !== '';
};

const sumMonto = (regs: Registro[]) => regs.reduce((s, r) => s + (Number(r.monto) || 0), 0);

type Metrics = {
  ingresados: number;
  aprobadosQ: number; aprobadosK: number;
  ventasQ: number; ventasK: number;
  aprobCCQ: number;
  enSegQ: number; enSegMonto: number;
  cerrados: number;
  ticket: number;
  tasaCierre: number | null;
  conversionGlobal: number | null;
  scorePromedio: number;
  pctRenov: number;
};

function computeMetrics(regs: Registro[]): Metrics {
  const ingresados = regs.length;
  const aprobados = regs.filter(isAprobado);
  const ventas = regs.filter(isVentaPura);
  const aprobCC = regs.filter(isAprobCC);
  const enSeg = regs.filter(isEnSeg);
  const cerrados = regs.filter(isCerrado).length;
  const aprobadosK = sumMonto(aprobados);
  const aprobadosQ = aprobados.length;
  const conScore = regs.filter(r => (Number(r.puntaje) || 0) > 0);
  const scorePromedio = conScore.length > 0 ? conScore.reduce((s, r) => s + (Number(r.puntaje) || 0), 0) / conScore.length : 0;
  const renovQ = regs.filter(r => r.es_re).length;

  return {
    ingresados,
    aprobadosQ, aprobadosK,
    ventasQ: ventas.length, ventasK: sumMonto(ventas),
    aprobCCQ: aprobCC.length,
    enSegQ: enSeg.length, enSegMonto: sumMonto(enSeg),
    cerrados,
    ticket: aprobadosQ > 0 ? aprobadosK / aprobadosQ : 0,
    tasaCierre: cerrados > 0 ? (aprobadosQ / cerrados) * 100 : null,
    conversionGlobal: ingresados > 0 ? (aprobadosQ / ingresados) * 100 : null,
    scorePromedio,
    pctRenov: ingresados > 0 ? (renovQ / ingresados) * 100 : 0,
  };
}

// ── Distribuciones (replicadas de /analistas › Ventas por Categoría) ───────
type DistItem = { label: string; monto: number; cantidad: number };

const distPor = (regs: Registro[], campo: keyof Registro): DistItem[] => {
  const map = new Map<string, { monto: number; cantidad: number }>();
  for (const r of regs) {
    const val = (r[campo] as string | undefined)?.trim() || 'No especificado';
    const prev = map.get(val) ?? { monto: 0, cantidad: 0 };
    map.set(val, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([label, d]) => ({ label, ...d }));
};

const normalizarEmpleador = (nombre: string): string => {
  if (!nombre) return 'No especificado';
  let n = nombre.toUpperCase().trim();
  n = n.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
  n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
  n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
  n = n.replace(/\s+/g, ' ').trim();
  return n || 'No especificado';
};

const distEmpleador = (regs: Registro[]): DistItem[] => {
  const map = new Map<string, { monto: number; cantidad: number; variantes: Map<string, number>; displayLabel: string }>();
  for (const r of regs) {
    const raw = (r.empleador ?? '').trim();
    const key = normalizarEmpleador(raw);
    const prev = map.get(key) ?? { monto: 0, cantidad: 0, variantes: new Map<string, number>(), displayLabel: raw };
    prev.monto += Number(r.monto) || 0;
    prev.cantidad += 1;
    if (raw) {
      prev.variantes.set(raw, (prev.variantes.get(raw) || 0) + 1);
      let maxCount = 0, maxVariant = raw;
      for (const [v, c] of prev.variantes) if (c > maxCount) { maxCount = c; maxVariant = v; }
      prev.displayLabel = maxVariant;
    }
    map.set(key, prev);
  }
  return Array.from(map.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .map(d => ({ label: d.displayLabel || 'No especificado', monto: d.monto, cantidad: d.cantidad }));
};

const matchTipoAcuerdo = (acuerdo: string, estado: string, isV: boolean): string | null => {
  const ac = low(acuerdo), es = low(estado);
  const esRechazo = ac.includes('no califica') || ac === 'n/c' ||
    es.includes('no califica') || es.includes('bajo') || es.includes('afectaciones') || es.includes('rechazado');
  if (esRechazo) return isV ? 'No califica/Excepcion' : 'No califica';
  if (ac.includes('bajo')) return 'Riesgo BAJO';
  if (ac.includes('medio')) return 'Riesgo MEDIO';
  if (ac.includes('premium')) return 'PREMIUM';
  return null;
};

const distAcuerdos = (regs: Registro[]): DistItem[] => {
  const tipos: Record<string, { monto: number; cantidad: number }> = {
    'PREMIUM': { monto: 0, cantidad: 0 }, 'Riesgo MEDIO': { monto: 0, cantidad: 0 },
    'Riesgo BAJO': { monto: 0, cantidad: 0 }, 'No califica/Excepcion': { monto: 0, cantidad: 0 },
    'No califica': { monto: 0, cantidad: 0 },
  };
  for (const r of regs) {
    const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', isAprobado(r));
    if (matched) { tipos[matched].monto += Number(r.monto) || 0; tipos[matched].cantidad += 1; }
  }
  return Object.entries(tipos).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
};

// ── DistBlock (replica exacta del diseño de /analistas) ────────────────────
const DistBlock: React.FC<{
  titulo: string; icon: React.ReactNode; datos: DistItem[]; color: string; totalMes: number; maxItems?: number;
}> = ({ titulo, icon, datos, color, totalMes, maxItems = 5 }) => {
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
    <div style={{ flex: 1, minWidth: 240, maxHeight: expanded ? 'none' : 320, display: 'flex', flexDirection: 'column', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</span>
      </div>
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)',
        borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        overflowX: 'hidden', overflowY: 'hidden', display: 'flex', flexDirection: 'column', flex: 1,
        maxHeight: expanded ? 'none' : 280, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{ flex: 1, overflowX: 'hidden', overflowY: 'hidden' }}>
          {displayData.map((d, i) => {
            const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
            const pctMonto = totalMes > 0 ? (d.monto / totalMes) * 100 : 0;
            return (
              <div key={i} style={{ padding: '9px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#8f929d', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label?.trim()}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#8f929d' }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
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

        {noEspData && noEspData.cantidad > 0 && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: '#8f929d', fontWeight: 700, fontStyle: 'italic' }}>* {noEspData.cantidad} sin especificar</span>
            <span style={{ fontSize: 9, color: '#8f929d', fontWeight: 600 }}>{formatCurrency(noEspData.monto)}</span>
          </div>
        )}

        {hasMore && (
          <button onClick={() => setExpanded(!expanded)} style={{
            width: '100%', padding: '12px', background: 'rgba(255,255,255,0.04)', border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.06)', color, fontSize: 10, fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0,
          }}>
            {expanded ? 'Ver menos' : `Ver todos (${validData.length})`}
            <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
          </button>
        )}
      </div>
    </div>
  );
};

const now = new Date();

export default function CarteraAnalistaTab() {
  const { registros } = useRegistros();

  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const r of registros) {
      const y = r.fecha?.slice(0, 4);
      if (y) set.add(Number(y));
    }
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [registros]);

  const [anio, setAnio] = useState<number | 'TODOS'>(now.getFullYear());
  const [mes, setMes] = useState<number | 'TODOS'>('TODOS');
  const [selected, setSelected] = useState<string>('PDV');
  const [fuenteTipo, setFuenteTipo] = useState<'ventas' | 'todos'>('ventas');

  const regsPeriodo = useMemo(() => registros.filter(r => {
    if (!r.fecha) return anio === 'TODOS';
    if (anio !== 'TODOS' && r.fecha.slice(0, 4) !== String(anio)) return false;
    if (mes !== 'TODOS' && r.fecha.slice(5, 7) !== String(mes).padStart(2, '0')) return false;
    return true;
  }), [registros, anio, mes]);

  const filas = useMemo(() => ({
    porAnalista: CONFIG.ANALISTAS_DEFAULT.map(a => ({ analista: a, metrics: computeMetrics(regsPeriodo.filter(r => r.analista === a)) })),
    total: { analista: 'PDV', metrics: computeMetrics(regsPeriodo) },
  }), [regsPeriodo]);

  const regsSel = useMemo(() =>
    selected === 'PDV' ? regsPeriodo : regsPeriodo.filter(r => r.analista === selected),
    [regsPeriodo, selected]);

  // Fuente de las distribuciones según el toggle
  const fuente = useMemo(() => fuenteTipo === 'ventas' ? regsSel.filter(isAprobado) : regsSel, [regsSel, fuenteTipo]);
  const base = useMemo(() => sumMonto(fuente), [fuente]);

  const dAcuerdo = useMemo(() => distAcuerdos(fuente), [fuente]);
  const dCuotas = useMemo(() => distPor(fuente, 'cuotas'), [fuente]);
  const dRango = useMemo(() => distPor(fuente, 'rango_etario'), [fuente]);
  const dSexo = useMemo(() => distPor(fuente, 'sexo'), [fuente]);
  const dEmpleador = useMemo(() => distEmpleador(fuente), [fuente]);
  const dLocalidad = useMemo(() => distPor(fuente, 'localidad'), [fuente]);

  const periodoLabel = `${mes === 'TODOS' ? 'Todo el año' : CONFIG.MESES_NOMBRES[(mes as number) - 1]} · ${anio === 'TODOS' ? 'Histórico' : anio}`;

  return (
    <div className="data-card" style={{ background: '#111111' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Briefcase size={20} color="#fff" />
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Cartera por Analista</h3>
            <p style={{ fontSize: 13, color: 'var(--gris)', marginTop: 4 }}>Composición del libro de cada analista · {periodoLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="var(--gris)" />
          <select value={String(anio)} onChange={e => setAnio(e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value))} style={selectStyle}>
            <option value="TODOS" style={optStyle}>Histórico</option>
            {aniosDisponibles.map(y => <option key={y} value={y} style={optStyle}>{y}</option>)}
          </select>
          <select value={String(mes)} onChange={e => setMes(e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value))} style={selectStyle}>
            <option value="TODOS" style={optStyle}>Todo el año</option>
            {CONFIG.MESES_NOMBRES.map((m, i) => <option key={m} value={i + 1} style={optStyle}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* ── SECCIÓN 1: Tabla comparativa ── */}
      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Analista', 'Ingresados', 'Ventas (Q)', 'Capital (K)', 'Ticket', 'En seguim. (Q)', 'En seguim. ($)', 'Aprob. CC (Q)', 'Tasa cierre', 'Conv. global', 'Score prom.', '% Renov.'].map((h, i) => (
                <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...filas.porAnalista, filas.total].map(({ analista, metrics: m }) => {
              const isTotal = analista === 'PDV';
              const isSel = selected === analista;
              return (
                <tr key={analista} onClick={() => setSelected(analista)} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  background: isSel ? 'rgba(255,255,255,0.07)' : (isTotal ? 'rgba(255,255,255,0.03)' : 'transparent'),
                  boxShadow: isSel ? 'inset 3px 0 0 rgba(255,255,255,0.35)' : 'none',
                  fontWeight: isTotal ? 800 : 500,
                }}>
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#fff', fontWeight: isTotal ? 800 : 700 }}>{isTotal ? 'TOTAL (PDV)' : analista}</td>
                  <td style={tdStyle}>{m.ingresados}</td>
                  <td style={tdStyle}>{m.ventasQ}</td>
                  <td style={tdStyle}>{formatCurrency(m.ventasK)}</td>
                  <td style={tdStyle}>{formatCurrency(m.ticket)}</td>
                  <td style={tdStyle}>{m.enSegQ}</td>
                  <td style={tdStyle}>{formatCurrency(m.enSegMonto)}</td>
                  <td style={tdStyle}>{m.aprobCCQ}</td>
                  <td style={{ ...tdStyle, color: cumplColor(m.tasaCierre) }}>{m.tasaCierre === null ? '—' : `${m.tasaCierre.toFixed(0)}%`}</td>
                  <td style={{ ...tdStyle, color: cumplColor(m.conversionGlobal) }}>{m.conversionGlobal === null ? '—' : `${m.conversionGlobal.toFixed(0)}%`}</td>
                  <td style={tdStyle}>{m.scorePromedio ? Math.round(m.scorePromedio) : '—'}</td>
                  <td style={tdStyle}>{m.pctRenov.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: '#555', marginTop: 8, fontStyle: 'italic' }}>Tocá una fila para ver la cartera del analista. Ventas = Venta + Aprobado CC.</p>
      </div>

      {/* ── SECCIÓN 2: Cartera por Categoría (réplica de /analistas) ── */}
      <div className="data-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <PieChart size={15} color="#fb923c" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>
              Cartera por Categoría — {selected === 'PDV' ? 'PDV' : selected}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>
              {fuenteTipo === 'ventas'
                ? `VENTAS: Venta y Aprob. CC (${fuente.length} ops · ${formatCurrency(base)})`
                : `TODOS: Todos los estados (${fuente.length} ops · ${formatCurrency(base)})`}
            </span>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 3 }}>
              {(['ventas', 'todos'] as const).map(p => (
                <button key={p} onClick={() => setFuenteTipo(p)} style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                  background: fuenteTipo === p ? '#fb923c' : 'transparent', color: fuenteTipo === p ? '#000' : '#555',
                  transition: 'all 0.2s ease',
                }}>{p === 'ventas' ? 'Ventas' : 'Todos'}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#f97316" />} datos={dAcuerdo} color="#f97316" totalMes={base} />
          <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={dCuotas} color="#60a5fa" totalMes={base} />
          <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={dRango} color="#34d399" totalMes={base} />
          <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={dSexo} color="#f472b6" totalMes={base} />
          <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={dEmpleador} color="#fbbf24" totalMes={base} />
          <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={dLocalidad} color="#a78bfa" totalMes={base} />
        </div>
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────
const cumplColor = (pct: number | null) =>
  pct === null ? '#64748b' : pct >= 60 ? '#34d399' : pct >= 35 ? '#fbbf24' : '#f87171';

const thStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 10, fontWeight: 800, color: '#8f929d', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'right', color: '#cbd0da', whiteSpace: 'nowrap' };
const selectStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', outline: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 };
const optStyle: React.CSSProperties = { background: '#111111' };
