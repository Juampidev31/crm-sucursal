'use client';

import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement
} from 'chart.js';
import { formatCurrency } from '@/lib/utils';
import { CONFIG } from '@/types';
import { Users, TrendingUp, Shield, Briefcase, FileText, Activity, Target, BarChart3, Tag, PieChart, ChevronDown, ChevronRight } from 'lucide-react';
import MetricasTab from '../../ajustes/MetricasTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement);

const ModernDoughnut = ({ data, total, label, unit = '' }: { data: any, total: number | string, label: string, unit?: string }) => {
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
          {total}{unit}
        </div>
      </div>
    </div>
  );
};

const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden) return;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      meta.data.forEach((bar: any, idx: number) => {
        const val = ds.data[idx];
        if (!val) return;
        const v = Math.abs(val);
        let label = v >= 1000 ? (v/1000).toFixed(0) + 'K' : Math.round(v).toString();
        ctx.fillText(label, bar.x, bar.y - 7);
      });
      ctx.restore();
    });
  },
};

const baseChartOpts = (show = true) => ({
  responsive: true, maintainAspectRatio: false,
  layout: { padding: { top: show ? 50 : 20, bottom: 5 } },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111', titleColor: '#fff', bodyColor: '#aaa' } },
  categoryPercentage: 0.8, barPercentage: 0.7,
  scales: { x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
            y: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true } },
});

const cumplColor = (pct: number | null) => !pct ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

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

const sectionHeader = (title: string, icon: React.ReactNode) => (
  <div 
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12, 
      padding: '16px 20px',
      background: 'rgba(255,255,255,0.01)',
      userSelect: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
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

const TextView = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 260 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#ccc', fontSize: 13, padding: '12px 14px', whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
  </div>
);

const DistBlock = ({ title, icon, data, color, total }: { title: string; icon: React.ReactNode; data: {label:string,monto:number,cantidad:number}[]; color: string; total: number }) => {
  const [expanded, setExpanded] = React.useState(false);
  const totalCant = data.reduce((s, d) => s + d.cantidad, 0);
  const displayData = expanded ? data : data.slice(0, 5);
  const hasMore = data.length > 5;

  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ background: '#0d0d0d', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', overflowX: 'hidden', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowX: 'hidden', overflowY: 'hidden' }}>
          {displayData.map((d: any, i: number) => {
            const pct = totalCant ? (d.cantidad/totalCant)*100 : 0;
            const pctM = total ? (d.monto/total)*100 : 0;
            return (
              <div key={i} style={{ padding: '9px 14px', borderBottom: i < displayData.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(d.label?.trim() === 'Sin dato' ? 'No especificado' : d.label?.trim()) || 'No especificado'}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#444' }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#aaa', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pctM+'%', background: color, opacity: 0.6, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: 'none',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              color: color,
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              flexShrink: 0
            }}
          >
            {expanded ? 'Ver menos' : `Ver todos (${data.length})`}
            <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default function ResumenHTML({ datos }: { datos: any }) {
  if (!datos?.kpiTotal) return <div style={{color:'#666'}}>Cargando...</div>;

  const { 
    kpiTotal, kpiPorAnalista, mesActual, mesAnterior, month, year, registros, 
    experienciaCliente, analisisComercial, operacionProcesos, gestionesRealizadas, 
    coordinacionSalidas, empresasEstrategicas, logros, desvios, accionesClave, 
    dotacion, ausentismo, capacitacion, evaluacionDesempeno, planAcciones, 
    distSexo, distCuotas, distRangoEtario, distLocalidad, distEmpleador, distAcuerdos, 
    chartConversionTotal, chartEmpleoPublPriv, chartAcuerdos, chartEmbudo 
  } = datos;

  const allAnalistas = kpiPorAnalista;
  const total = kpiTotal.capital;

  const chartCapital = {
    labels: [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'],
    datasets: [
      { label: `Capital ${mesActual}`, data: [...kpiPorAnalista.map((k: any)=>k.capital), kpiTotal.capital], backgroundColor: 'rgba(96,165,250,0.8)', borderRadius: 4 },
      { type: 'line' as const, label: 'Objetivo', data: [...kpiPorAnalista.map((k: any)=>k.metaCapital||0), kpiTotal.metaCapital||0], borderColor: '#f87171', borderWidth: 2, borderDash: [5,4], pointRadius: 4, fill: false },
    ],
  };

  const chartTicket = {
    labels: [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'],
    datasets: [{ label: `Ticket ${mesActual}`, data: [...kpiPorAnalista.map((k: any)=>k.ticket), kpiTotal.ticket], backgroundColor: 'rgba(52,211,153,0.8)', borderRadius: 4 }],
  };

  const chartVar = {
    labels: [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'],
    datasets: [
      { label: 'Var. Capital %', data: [...kpiPorAnalista.map((k: any)=>k.tendCapital??0), kpiTotal.tendCapital??0], backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 4 },
      { label: 'Var. Ops %', data: [...kpiPorAnalista.map((k: any)=>k.tendOps??0), kpiTotal.tendOps??0], backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 4 },
    ],
  };

  const chartCumpl = {
    labels: CONFIG.ANALISTAS_DEFAULT,
    datasets: [
      { label: 'Cumpl. Capital', data: kpiPorAnalista.map((k: any)=>k.cumplCapital??0), backgroundColor: 'rgba(96,165,250,0.7)', borderRadius: 4 },
      { label: 'Cumpl. Ops', data: kpiPorAnalista.map((k: any)=>k.cumplOps??0), backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 4 },
    ],
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      {/* 1. TABLERO */}
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('1. Tablero', <BarChart3 size={15} color="#60a5fa" />)}
        <div style={{padding:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:20,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',textTransform:'uppercase',marginBottom:8}}>Capital Vendido</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{fontSize:22,fontWeight:900,color:'#fff'}}>{formatCurrency(kpiTotal.capital)}</div>
              {tendBadge(kpiTotal.tendCapital)}
            </div>
            <div style={{fontSize:12,color:'#555',marginBottom:2}}>Meta: {kpiTotal.metaCapital?formatCurrency(kpiTotal.metaCapital):'/'}</div>
            {kpiTotal.cumplCapital && <div style={{fontSize:12,fontWeight:800,color:cumplColor(kpiTotal.cumplCapital)}}>{kpiTotal.cumplCapital.toFixed(1)}% Cumpl.</div>}
            <div style={{marginTop:24,height:180}}><Bar data={chartCapital as any} options={baseChartOpts(true)} plugins={[labelsPlugin]} /></div>
          </div>
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:20,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',textTransform:'uppercase',marginBottom:8}}>Operaciones</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{fontSize:22,fontWeight:900,color:'#fff'}}>{kpiTotal.ops}</div>
              {tendBadge(kpiTotal.tendOps)}
            </div>
            <div style={{fontSize:12,color:'#555',marginBottom:2}}>Meta: {kpiTotal.metaOps||'/'}</div>
            {kpiTotal.cumplOps && <div style={{fontSize:12,fontWeight:800,color:cumplColor(kpiTotal.cumplOps)}}>{kpiTotal.cumplOps.toFixed(1)}% Cumpl.</div>}
          </div>
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:20,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',textTransform:'uppercase',marginBottom:8}}>Ticket Promedio</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{fontSize:22,fontWeight:900,color:'#fff'}}>{formatCurrency(kpiTotal.ticket)}</div>
              {tendBadge(kpiTotal.tendTicket)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <div style={{fontSize:12,color:'#555'}}>Conversión: {kpiTotal.conversion.toFixed(1)}%</div>
              {tendBadge(kpiTotal.tendConversion)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <div style={{fontSize:11,color:'#444'}}>{kpiTotal.clientes} clientes</div>
              {tendBadge(kpiTotal.tendClientes)}
            </div>
            <div style={{marginTop:24,height:180}}><Bar data={chartTicket as any} options={baseChartOpts(true)} plugins={[labelsPlugin]} /></div>
          </div>
        </div>
      </div>
    </div>

      {/* 2. INDICADORES */}
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('2. Indicadores por Analista', <Users size={15} color="#a78bfa" />)}
        <div style={{padding:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginBottom:24}}>
          {allAnalistas.map((k: any, i: number) => {
            const isT = i === kpiPorAnalista.length;
            return (
              <div key={i} style={{background:isT?'rgba(167,139,250,0.06)':'rgba(255,255,255,0.02)',borderRadius:12,border:`1px solid ${isT?'rgba(167,139,250,0.2)':'rgba(255,255,255,0.05)'}`,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:28,height:28,borderRadius:8,background:isT?'rgba(167,139,250,0.15)':'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Users size={13} color={isT?'#a78bfa':'#666'} />
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:isT?'#a78bfa':'#ccc'}}>{k.analista}</span>
                </div>
                <div style={{padding:'14px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:'#444',textTransform:'uppercase',marginBottom:4}}>Capital</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{fontSize:16,fontWeight:900,color:'#fff'}}>{formatCurrency(k.capital)}</div>
                      {tendBadge(k.tendCapital)}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:'#444',textTransform:'uppercase',marginBottom:4}}>Ops</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{fontSize:16,fontWeight:900,color:'#fff'}}>{k.ops}</div>
                      {tendBadge(k.tendOps)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>
          {/* 1. Cumplimiento */}
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:14,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',marginBottom:10}}>% Cumplimiento vs {mesAnterior}</div>
            <div style={{height:280}}><Bar data={chartCumpl as any} options={baseChartOpts(true)} plugins={[labelsPlugin]} /></div>
          </div>
          {/* 2. Variación */}
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:14,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',marginBottom:10}}>Variación % vs {mesAnterior}</div>
            <div style={{height:280}}><Bar data={chartVar as any} options={baseChartOpts(true)} plugins={[labelsPlugin]} /></div>
          </div>
          {/* 3. Acuerdos por Analista (Dona) */}
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:14,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',marginBottom:10}}>Acuerdos por Analista</div>
            {(() => {
              const labels = CONFIG.ANALISTAS_DEFAULT;
              const data = chartAcuerdos.datasets.map((ds: any) => ds.data.reduce((s: number, v: number) => s + v, 0));
              const total = data.reduce((s: number, v: number) => s + v, 0);
              const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'];
              const cData = {
                labels,
                datasets: [{
                  data,
                  backgroundColor: colors,
                  borderWidth: 0,
                  hoverOffset: 10,
                  borderRadius: 4,
                  spacing: 4
                }]
              };
              return (
                <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <ModernDoughnut data={cData} total={total} label="Acuerdos" unit=" Ops" />
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                    {labels.map((l, i) => {
                      const pct = total > 0 ? (data[i] / total * 100).toFixed(1) : '0';
                      return (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors[i] }} />
                          <span style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{l} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
          {/* 4. Empleo (Dona) */}
          <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:14,border:'1px solid rgba(255,255,255,0.04)'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#444',marginBottom:10}}>% Empleo Público / Privado</div>
            {(() => {
              const colors = ['#10b981', '#3b82f6', 'rgba(100,100,100,0.5)'];
              const cData = {
                ...chartEmpleoPublPriv,
                datasets: [{
                  ...chartEmpleoPublPriv.datasets[0],
                  backgroundColor: chartEmpleoPublPriv.labels.map((l: string, i: number) => colors[i] || colors[0]),
                  borderWidth: 0,
                  hoverOffset: 10,
                  borderRadius: 4,
                  spacing: 4
                }]
              };
              return (
                <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <ModernDoughnut data={cData} total={kpiTotal.ops} label="Total" unit=" Ops" />
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                    {chartEmpleoPublPriv.labels.map((l: string, i: number) => {
                      const val = chartEmpleoPublPriv.datasets[0].data[i];
                      const pct = kpiTotal.ops > 0 ? (val / kpiTotal.ops * 100).toFixed(1) : '0';
                      return (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors[i] || colors[0] }} />
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
    </div>

      {/* 3. VENTAS POR CATEGORÍA */}
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20 }}>
            <Tag size={15} color="#fb923c" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#eee', textTransform: 'uppercase', letterSpacing: '1px', flex: 1 }}>3. Ventas por Categoría</span>
          <span style={{ fontSize: 11, color: '#444' }}>{kpiTotal.ops} ops · {formatCurrency(total)}</span>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
            <ChevronRight size={14} color="#555" />
          </div>
        </div>
        <div style={{padding:24}}>
          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            {distAcuerdos?.length && <DistBlock title="Acuerdo" icon={<PieChart size={12} color="#f97316" />} data={distAcuerdos} color="#f97316" total={total} />}
            {distCuotas?.length && <DistBlock title="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} data={distCuotas} color="#60a5fa" total={total} />}
            {distRangoEtario?.length && <DistBlock title="Rango Etario" icon={<Users size={12} color="#34d399" />} data={distRangoEtario} color="#34d399" total={total} />}
            {distSexo?.length && <DistBlock title="Sexo" icon={<Users size={12} color="#f472b6" />} data={distSexo} color="#f472b6" total={total} />}
            {distEmpleador?.length && <DistBlock title="Empleador" icon={<Shield size={12} color="#fbbf24" />} data={distEmpleador} color="#fbbf24" total={total} />}
            {distLocalidad?.length && <DistBlock title="Localidad" icon={<FileText size={12} color="#a78bfa" />} data={distLocalidad} color="#a78bfa" total={total} />}
          </div>
        </div>
      </div>


      {/* 4. RENDIMIENTO DISTRIBUIDO POR ANALISTA Y TOTAL GENERAL */}
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('4. Rendimiento distribuido por analista y total general', <PieChart size={15} color="#4ade80" />)}
        <div style={{padding:24}}>
          <MetricasTab selectedMes={month} selectedAnio={year} registros={registros} />
        </div>
      </div>

      {/* 5. ANÁLISIS COMERCIAL */}
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('5. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
        <div style={{padding:24}}>
          <TextView label="Interpretación del Período" value={analisisComercial||''} />
        </div>
      </div>
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('6. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
        <div style={{padding:24}}>
          <TextView label="Procedimientos" value={operacionProcesos||''} />
        </div>
      </div>
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('7. Gestión Comercial', <Briefcase size={15} color="#34d399" />)}
        <div style={{padding:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
            <TextView label="Gestiones Realizadas" value={gestionesRealizadas||''} />
            <TextView label="Coordinación de Salidas" value={coordinacionSalidas||''} />
            <TextView label="Empresas Estratégicas" value={empresasEstrategicas||''} />
          </div>
        </div>
      </div>
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('8. Experiencia del Cliente', <FileText size={15} color="#f472b6" />)}
        <div style={{padding:24}}>
          <TextView label="Reclamos y Satisfacción" value={experienciaCliente||''} />
        </div>
      </div>
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('9. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
        <div style={{padding:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
            <TextView label="Dotación Actual" value={dotacion||''} />
            <TextView label="Ausentismo" value={ausentismo||''} />
            <TextView label="Capacitación" value={capacitacion||''} />
            <TextView label="Evaluación" value={evaluacionDesempeno||''} />
          </div>
        </div>
      </div>
      <div style={{background:'#0a0a0a',padding:0,borderRadius:6,overflow:'hidden',border:'1px solid rgba(255,255,255,0.04)'}}>
        {sectionHeader('10. Plan de Acción', <Target size={15} color="#fb923c" />)}
        <div style={{padding:24}}>
          {planAcciones?.length ? (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr><th style={{padding:8,textAlign:'left',color:'#444',fontSize:10}}>Problema</th><th style={{padding:8,textAlign:'left',color:'#444',fontSize:10}}>Acción</th><th style={{padding:8,textAlign:'left',color:'#444',fontSize:10}}>Responsable</th><th style={{padding:8,textAlign:'left',color:'#444',fontSize:10}}>Fecha</th></tr></thead>
              <tbody>
                {planAcciones.map((f: any, i: number) => (
                  <tr key={i}><td style={{padding:6,color:'#ccc'}}>{f.problema}</td><td style={{padding:6,color:'#ccc'}}>{f.accion}</td><td style={{padding:6,color:'#ccc'}}>{f.responsable}</td><td style={{padding:6,color:'#ccc'}}>{f.fecha}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{color:'#444'}}>/</div>}
        </div>
      </div>
    </div>
  );
}