'use client';

import React from 'react';
import { X } from 'lucide-react';

// ── Tag color configs ─────────────────────────────────────────────────────────

interface TagColorConfig {
  label: string;
  bg: string;
  color: string;
  border: string;
}
export const TAG_CONFIGS: Record<string, TagColorConfig> = {
  VIP:            { label: 'VIP',            bg: 'rgba(168,85,247,0.15)',  color: '#c084fc', border: 'rgba(168,85,247,0.35)' },
  Urgente:        { label: 'Urgente',        bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
  'Sin Respuesta':{ label: 'Sin Respuesta',  bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.35)' },
  Caliente:       { label: 'Caliente',       bg: 'rgba(249,115,22,0.15)',  color: '#fdba74', border: 'rgba(249,115,22,0.35)' },
  Presupuestado:  { label: 'Presupuestado',  bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: 'rgba(16,185,129,0.35)' },
};

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(234, 179, 8, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}
export function getTagStyle(tag: string): TagColorConfig {
  if (!tag) return { label: '', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.35)' };

  let name = tag;
  let colorHex = '';

  if (tag.includes('|')) {
    const parts = tag.split('|');
    name = parts[0];
    colorHex = parts[1];
  }

  if (colorHex && colorHex.startsWith('#')) {
    return {
      label: name,
      bg: hexToRgba(colorHex, 0.18),
      color: colorHex,
      border: hexToRgba(colorHex, 0.4),
    };
  }

  if (TAG_CONFIGS[name]) {
    return TAG_CONFIGS[name];
  }

  // Keyword check
  const lower = name.toLowerCase();
  if (lower.includes('amarillo') || lower.includes('yellow') || lower.includes('duda') || lower.includes('pend')) {
    return { label: name, bg: 'rgba(234,179,8,0.18)', color: '#eab308', border: 'rgba(234,179,8,0.4)' };
  }
  if (lower.includes('rojo') || lower.includes('red') || lower.includes('urg') || lower.includes('canc')) {
    return { label: name, bg: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: 'rgba(239,68,68,0.4)' };
  }
  if (lower.includes('verde') || lower.includes('green') || lower.includes('ok') || lower.includes('ganad')) {
    return { label: name, bg: 'rgba(34,197,94,0.18)', color: '#4ade80', border: 'rgba(34,197,94,0.4)' };
  }
  if (lower.includes('azul') || lower.includes('blue') || lower.includes('info')) {
    return { label: name, bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.4)' };
  }
  if (lower.includes('violeta') || lower.includes('purp') || lower.includes('vip')) {
    return { label: name, bg: 'rgba(168,85,247,0.18)', color: '#c084fc', border: 'rgba(168,85,247,0.4)' };
  }
  if (lower.includes('rosa') || lower.includes('pink')) {
    return { label: name, bg: 'rgba(236,72,153,0.18)', color: '#f472b6', border: 'rgba(236,72,153,0.4)' };
  }

  // Deterministic color hash mapping for non-preset custom tags
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { bg: 'rgba(234,179,8,0.18)', color: '#eab308', border: 'rgba(234,179,8,0.4)' },
    { bg: 'rgba(168,85,247,0.18)', color: '#c084fc', border: 'rgba(168,85,247,0.4)' },
    { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
    { bg: 'rgba(34,197,94,0.18)', color: '#4ade80', border: 'rgba(34,197,94,0.4)' },
    { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: 'rgba(239,68,68,0.4)' },
    { bg: 'rgba(236,72,153,0.18)', color: '#f472b6', border: 'rgba(236,72,153,0.4)' },
    { bg: 'rgba(20,184,166,0.18)', color: '#2dd4bf', border: 'rgba(20,184,166,0.4)' },
  ];
  return {
    label: name,
    ...colors[Math.abs(hash) % colors.length]
  };
}

type TagBadgeStyle = React.CSSProperties & {
  '--tag-bg': string;
  '--tag-color': string;
  '--tag-border': string;
};

// ── TagBadge ──────────────────────────────────────────────────────────────────

export function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const s = getTagStyle(tag);
  return (
    <span
      className="tag-badge"
      style={{
        '--tag-bg': s.bg,
        '--tag-color': s.color,
        '--tag-border': s.border,
      } as TagBadgeStyle}
    >
      {s.label}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="tag-badge__remove"
        >
          <X className="tag-badge__icon" />
        </button>
      )}
    </span>
  );
}
