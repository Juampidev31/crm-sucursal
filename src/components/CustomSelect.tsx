'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';

interface Option {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface CustomSelectProps {
  options: Option[];
  value: string | number;
  onChange: (val: string | number) => void;
  width?: string;
  /** Color de fondo del control cerrado (default: 'var(--surface-canvas)'). */
  bg?: string;
}

export default function CustomSelect({ options, value, onChange, width = '180px', bg = 'var(--surface-canvas)' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, closeDropdown);

  return (
    <div ref={containerRef} style={{ position: 'relative', width }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: bg,
          border: '1px solid var(--neutral-06)',
          borderRadius: '10px',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'var(--text-strong)',
          fontSize: '13px',
          fontWeight: 600,
          userSelect: 'none',
          transition: 'border-color 0.2s',
          height: '38px',
          borderColor: isOpen ? 'var(--success-strong)' : 'var(--neutral-06)',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption.label}
        </span>
        <ChevronDown size={14} style={{
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          color: 'var(--text-muted)'
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          width: '100%',
          background: 'var(--surface-canvas)',
          border: '1px solid var(--neutral-03)',
          borderRadius: '10px',
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          padding: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
          animation: 'dropdownIn 0.15s ease-out'
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 10px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: opt.disabled ? 'default' : 'pointer',
                color: opt.disabled ? 'var(--text-subtle)' : (opt.value === value ? 'var(--success-strong)' : 'var(--text-muted)'),
                background: opt.value === value ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                transition: 'all 0.1s',
                pointerEvents: opt.disabled ? 'none' : 'auto',
              }}
              onMouseEnter={e => {
                if (opt.disabled) return;
                if (opt.value !== value) {
                  e.currentTarget.style.background = 'var(--neutral-02)';
                  e.currentTarget.style.color = 'var(--text-strong)';
                }
              }}
              onMouseLeave={e => {
                if (opt.disabled) return;
                if (opt.value !== value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
