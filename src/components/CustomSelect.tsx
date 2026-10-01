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
  /** Color de fondo del control cerrado. */
  bg?: string;
  /** Altura máxima del menú; permite mostrar listas completas cuando hay espacio. */
  menuMaxHeight?: string;
}

export default function CustomSelect({ options, value, onChange, width = '180px', bg = '#ffffff', menuMaxHeight = '300px' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, closeDropdown);

  return (
    <div ref={containerRef} className="custom-select" style={{ '--custom-select-width': width, '--custom-select-bg': bg, '--custom-select-menu-max-height': menuMaxHeight } as React.CSSProperties}>
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
        className={`custom-select__trigger${isOpen ? ' is-open' : ''}`}
      >
        <span className="custom-select__value">
          {selectedOption.label}
        </span>
        <ChevronDown size={14} className={`custom-select__chevron${isOpen ? ' is-open' : ''}`} />
      </div>

      {isOpen && (
        <div className="custom-select__menu" role="listbox">
          {options.map(opt => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`custom-select__option${opt.value === value ? ' is-selected' : ''}${opt.disabled ? ' is-disabled' : ''}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
