'use client';

import React, { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import ModalPortal from '@/components/ModalPortal';

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

// ── TagBadge ──────────────────────────────────────────────────────────────────

export function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const s = getTagStyle(tag);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700,
        padding: '2px 7px', borderRadius: 999,
        background: s.bg, color: s.color,
        border: `1px solid ${s.border}`,
        letterSpacing: '0.3px',
      }}
    >
      {s.label}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', padding: 0, marginLeft: 2, opacity: 0.6,
            display: 'flex', alignItems: 'center', lineHeight: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        >
          <X style={{ width: 10, height: 10 }} />
        </button>
      )}
    </span>
  );
}

// ── EtiquetasSelector ─────────────────────────────────────────────────────────

interface EtiquetasSelectorProps {
  etiquetas: string[];
  onChange: (nuevasEtiquetas: string[]) => void;
}

const PRESET_TAGS = ['Presupuestado'];

export function EtiquetasSelector({ etiquetas = [], onChange }: EtiquetasSelectorProps) {
  const [customTag, setCustomTag] = useState('');
  const [showInput, setShowInput] = useState(false);

  const removeTag = (tag: string) => {
    onChange(etiquetas.filter(t => t !== tag));
  };

  const toggleTag = (tag: string) => {
    if (etiquetas.includes(tag)) {
      removeTag(tag);
    } else {
      onChange([...etiquetas, tag]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = customTag.trim();
    if (tag && !etiquetas.includes(tag)) {
      onChange([...etiquetas, tag]);
      setCustomTag('');
      setShowInput(false);
    }
  };

  // Combinar etiquetas predefinidas y las asignadas al lead
  const allTags = Array.from(new Set([...PRESET_TAGS, ...etiquetas]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {allTags.map(t => {
          const isSelected = etiquetas.includes(t);
          const s = getTagStyle(t);
          return (
            <div
              key={t}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 600,
                padding: '5px 10px', borderRadius: 8,
                background: isSelected ? s.bg : 'rgba(255,255,255,0.04)',
                color: isSelected ? s.color : 'var(--fg-muted)',
                border: `1px solid ${isSelected ? s.border : 'rgba(255,255,255,0.1)'}`,
                transition: 'all 0.15s',
              }}
            >
              <button
                type="button"
                onClick={() => toggleTag(t)}
                style={{
                  background: 'none', border: 'none', color: 'inherit',
                  font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                }}
              >
                {isSelected && <Check style={{ width: 12, height: 12 }} />}
                {t}
              </button>

              {/* Botón de eliminar (X) para etiquetas seleccionadas */}
              {isSelected && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    removeTag(t);
                  }}
                  title={`Eliminar etiqueta "${t}"`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'inherit', opacity: 0.6, display: 'flex', alignItems: 'center',
                    padding: '2px', marginLeft: 2, borderRadius: 4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showInput ? (
        <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={customTag}
            onChange={e => setCustomTag(e.target.value)}
            placeholder="Nueva etiqueta..."
            autoFocus
            style={{
              flex: 1, padding: '7px 10px', fontSize: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, color: '#fff', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!customTag.trim()}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 700,
              background: 'var(--green)', color: '#000',
              border: 'none', borderRadius: 8,
              cursor: customTag.trim() ? 'pointer' : 'not-allowed',
              opacity: customTag.trim() ? 1 : 0.5,
              letterSpacing: '0.3px',
            }}
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => setShowInput(false)}
            style={{
              padding: '7px 10px', fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.05)', color: 'var(--fg-muted)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 500, color: 'var(--fg-muted)',
            padding: '2px 0',
            transition: 'color 0.15s',
            width: 'fit-content',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--green)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
        >
          <Plus style={{ width: 13, height: 13 }} />
          Crear etiqueta personalizada
        </button>
      )}
    </div>
  );
}

// ── EtiquetasModal ────────────────────────────────────────────────────────────

export function EtiquetasModal({
  registro,
  isOpen,
  onClose,
  onSave,
}: {
  registro: { id: string; nombre?: string; etiquetas?: string[] } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (registroId: string, nuevasEtiquetas: string[]) => void;
}) {
  if (!isOpen || !registro) return null;

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '20px 22px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            width: '100%', maxWidth: 360,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            marginBottom: 16, paddingBottom: 14,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <div style={{ fontWeight: 800, color: '#fff', fontSize: 13, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Etiquetas
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3 }}>
                {registro.nombre}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--fg-muted)', padding: 4, borderRadius: 6, display: 'flex',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <EtiquetasSelector
            etiquetas={registro.etiquetas || []}
            onChange={nuevas => onSave(registro.id, nuevas)}
          />
        </div>
      </div>
    </ModalPortal>
  );
}
