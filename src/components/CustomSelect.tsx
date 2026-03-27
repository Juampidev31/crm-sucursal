'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  options: Option[];
  value: string | number;
  onChange: (val: any) => void;
  width?: string;
}

export default function CustomSelect({ options, value, onChange, width = '180px' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#000000',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          userSelect: 'none',
          transition: 'border-color 0.2s',
          height: '38px',
          borderColor: isOpen ? 'var(--azul)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption.label}
        </span>
        <ChevronDown size={14} style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'none', 
          transition: 'transform 0.2s',
          color: '#666'
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          width: '100%',
          background: '#000000',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '4px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
          padding: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
          animation: 'dropdownIn 0.15s ease-out'
        }}>
          {options.map(opt => (
            <div 
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 10px',
                borderRadius: '3px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                color: opt.value === value ? 'var(--azul)' : '#999',
                background: opt.value === value ? 'rgba(0,120,212,0.1)' : 'transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#999';
                }
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
      <style jsx>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
