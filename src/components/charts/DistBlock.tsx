'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// Unificación de las 3 copias de DistBlock (refactor cross-file de charts, fase 3):
// Tab y View eran idénticas (tema "dark"); analistas difiere solo en fondo/sombra/colores
// (tema "elevated"). La variante de la vista pública (ResumenHTML) es estructuralmente
// distinta y se mantiene aparte a propósito.
const THEMES = {
  dark: {
    cardBg: '#111111',
    boxShadow: undefined as string | undefined,
    labelColor: '#888',
    montoColor: '#444',
    cantidadColor: '#aaa',
    noEspColor: '#999',
    noEspMontoColor: '#888',
  },
  elevated: {
    cardBg: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)',
    boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)' as string | undefined,
    labelColor: '#8f929d',
    montoColor: '#8f929d',
    cantidadColor: '#fff',
    noEspColor: '#8f929d',
    noEspMontoColor: '#8f929d',
  },
};

const DistBlock = ({
  titulo, icon, datos, color, totalMes, maxItems = 5, theme = 'dark'
}: {
  titulo: string; icon: React.ReactNode;
  datos: { label: string; monto: number; cantidad: number }[];
  color: string; totalMes: number; maxItems?: number;
  theme?: keyof typeof THEMES;
}) => {
  const [expanded, setExpanded] = useState(false);
  const t = THEMES[theme];

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
        background: t.cardBg,
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: t.boxShadow,
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
              <div key={i} style={{ padding: '9px 14px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <span style={{ fontSize: 12, color: t.labelColor, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label?.trim()}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: t.montoColor }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: t.cantidadColor, background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
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
            <span style={{ fontSize: 10, color: t.noEspColor, fontWeight: 700, fontStyle: 'italic' }}>
              * {noEspData.cantidad} sin especificar
            </span>
            <span style={{ fontSize: 9, color: t.noEspMontoColor, fontWeight: 600 }}>{formatCurrency(noEspData.monto)}</span>
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

export default DistBlock;
