'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';

export interface ProyeccionKpi {
  metaDiariaCapital: number | null;
  ventaPorDia: number | null;
  metaDiariaOps: number | null;
  opsPorDia: number | null;
  proyCapital: number | null;
  cumplProyCapital: number | null;
  proyOps: number | null;
  cumplProyOps: number | null;
  faltaCapital: number | null;
  faltaOps: number | null;
  ventaIdealFecha: number | null;
  capital: number;
  ops: number;
  metaCapital: number;
  metaOps: number;
  esMesActual: boolean;
  tieneDiasAdmin: boolean;
}

const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 };
const valueStyle: React.CSSProperties = { fontSize: 20, fontWeight: 900, color: '#fff' };
const ritmoStyle: React.CSSProperties = { fontSize: 10, color: '#555', fontWeight: 700, marginTop: 4 };
const divider: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,0.04)' };

export default function ProyeccionCard({ kpi, titulo }: { kpi: ProyeccionKpi; titulo: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 24, border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>{titulo}</div>
      {kpi.esMesActual && !kpi.tieneDiasAdmin ? (
        <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Cargá días hábiles en Ajustes para ver proyección
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Venta actual (K)</div>
              <div style={{ ...valueStyle, marginBottom: 14 }}>{formatCurrency(kpi.capital)}</div>
              {kpi.metaDiariaCapital !== null && (
                <>
                  <div style={labelStyle}>Venta / día ({kpi.esMesActual ? 'Necesario' : 'Meta'})</div>
                  <div style={valueStyle}>{formatCurrency(kpi.metaDiariaCapital)}</div>
                  {kpi.ventaPorDia !== null && <div style={ritmoStyle}>PROMEDIO: {formatCurrency(kpi.ventaPorDia)}</div>}
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Ops. actuales (Q)</div>
              <div style={{ ...valueStyle, marginBottom: 14 }}>{Math.round(kpi.ops)}</div>
              {kpi.metaDiariaOps !== null && (
                <>
                  <div style={labelStyle}>Ops. / día ({kpi.esMesActual ? 'Necesario' : 'Meta'})</div>
                  <div style={valueStyle}>{Math.round(kpi.metaDiariaOps)}</div>
                  {kpi.opsPorDia !== null && <div style={ritmoStyle}>PROMEDIO: {Math.round(kpi.opsPorDia)}</div>}
                </>
              )}
            </div>
          </div>

          {kpi.ventaIdealFecha !== null && (
            <>
              <div style={divider} />
              <div>
                <div style={labelStyle}>Venta ideal a la fecha (K)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={valueStyle}>{formatCurrency(kpi.ventaIdealFecha)}</div>
                  {(() => {
                    const diff = kpi.capital - kpi.ventaIdealFecha!;
                    return (
                      <span style={{ fontSize: 12, fontWeight: 800, color: diff >= 0 ? '#10b981' : '#f87171' }}>
                        {diff >= 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          <div style={divider} />

          <div style={{ fontSize: 11, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            {kpi.esMesActual ? 'Proyección fin de mes' : 'Cierre del mes'}
          </div>

          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              {kpi.proyCapital !== null && (
                <>
                  <div style={labelStyle}>{kpi.esMesActual ? 'Proy. fin mes (K)' : 'Final mes (K)'}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ ...valueStyle, color: kpi.proyCapital >= kpi.metaCapital ? '#10b981' : '#f87171' }}>{formatCurrency(kpi.proyCapital)}</div>
                    {kpi.cumplProyCapital !== null && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: kpi.cumplProyCapital >= 100 ? '#10b981' : '#f87171' }}>({kpi.cumplProyCapital.toFixed(2)}%)</span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {kpi.proyOps !== null && (
                <>
                  <div style={labelStyle}>{kpi.esMesActual ? 'Proy. fin mes (Q)' : 'Final mes (Q)'}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ ...valueStyle, color: kpi.proyOps >= kpi.metaOps ? '#10b981' : '#f87171' }}>{Math.round(kpi.proyOps)}</div>
                    {kpi.cumplProyOps !== null && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: kpi.cumplProyOps >= 100 ? '#10b981' : '#f87171' }}>({kpi.cumplProyOps.toFixed(2)}%)</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={divider} />

          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              {kpi.faltaCapital !== null && (
                <>
                  <div style={labelStyle}>Falta 100% (K)</div>
                  <div style={{ ...valueStyle, color: kpi.faltaCapital === 0 ? '#10b981' : '#f87171' }}>{formatCurrency(kpi.faltaCapital)}</div>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {kpi.faltaOps !== null && (
                <>
                  <div style={labelStyle}>Falta 100% (Q)</div>
                  <div style={{ ...valueStyle, color: kpi.faltaOps === 0 ? '#10b981' : '#f87171' }}>{Math.round(kpi.faltaOps || 0)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
