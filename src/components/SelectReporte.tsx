'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown, Calendar, User } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';

interface Option {
  label: string;
  value: string | number;
}

interface SelectReporteProps {
  options: Option[];
  value: string | number;
  onChange: (val: string | number) => void;
  icon?: 'user' | 'calendar';
  width?: string;
}

export default function SelectReporte({ options, value, onChange, icon, width = '200px' }: SelectReporteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0];

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, closeDropdown);

  return (
    <div ref={containerRef} style={{ position: 'relative', width }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'linear-gradient(145deg, #0f0f0f 0%, #050505 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          userSelect: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '42px',
          boxShadow: isOpen 
            ? '0 0 20px rgba(255,255,255,0.03), inset 0 0 10px rgba(255,255,255,0.02)' 
            : '0 4px 12px rgba(0,0,0,0.5)',
          borderColor: isOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
          textTransform: 'uppercase'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.background = 'linear-gradient(145deg, #141414 0%, #080808 100%)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.background = 'linear-gradient(145deg, #0f0f0f 0%, #050505 100%)';
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          {icon === 'user' && <User size={14} style={{ opacity: 0.5 }} />}
          {icon === 'calendar' && <Calendar size={14} style={{ opacity: 0.5 }} />}
          <span style={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            background: 'linear-gradient(90deg, #fff 0%, #aaa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {selectedOption?.label || 'Seleccionar'}
          </span>
        </div>
        <ChevronDown size={14} style={{
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          color: '#666',
          flexShrink: 0
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 'max-content',
          minWidth: '100%',
          background: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          zIndex: 1000,
          boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
          padding: '8px',
          maxHeight: '400px',
          overflowY: 'auto',
          animation: 'elegantIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          scrollbarWidth: 'none'
        }}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                color: String(opt.value) === String(value) ? '#fff' : 'rgba(255,255,255,0.5)',
                background: String(opt.value) === String(value) ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: 'all 0.2s',
                marginBottom: i === options.length - 1 ? 0 : '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={e => {
                if (String(opt.value) !== String(value)) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                if (String(opt.value) !== String(value)) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                }
              }}
            >
              {String(opt.value) === String(value) && (
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff' }} />
              )}
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
