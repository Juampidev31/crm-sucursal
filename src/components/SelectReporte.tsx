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
  variant?: 'dark' | 'light';
}

export default function SelectReporte({ options, value, onChange, icon, width = '200px', variant = 'light' }: SelectReporteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0];

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, closeDropdown);

  return (
    <div ref={containerRef} className="report-select" style={{ '--report-select-width': width } as React.CSSProperties}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(open => !open);
          }
        }}
        className={`report-select__trigger is-${variant}${isOpen ? ' is-open' : ''}`}
      >
        <div className="report-select__value-wrap">
          {icon === 'user' && <User size={14} />}
          {icon === 'calendar' && <Calendar size={14} />}
          <span className="report-select__value">
            {selectedOption?.label || 'Seleccionar'}
          </span>
        </div>
        <ChevronDown size={14} className="report-select__chevron" />
      </div>

      {isOpen && (
        <div className={`report-select__menu is-${variant}`} role="listbox">
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={String(opt.value) === String(value)}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`report-select__option${String(opt.value) === String(value) ? ' is-selected' : ''}`}
            >
              {String(opt.value) === String(value) && (
                <div className="report-select__dot" />
              )}
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
