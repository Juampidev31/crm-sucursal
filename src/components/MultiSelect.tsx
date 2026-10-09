'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { calcularPosicionDropdown, type PosicionDropdown } from '@/lib/dropdown-position';
import styles from './MultiSelect.module.css';

type MultiSelectOption = string | { value: string; label: string };

export default function MultiSelect({
  values,
  onChange,
  options,
  placeholder,
  clearLabel,
  searchable = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder: string;
  clearLabel: string;
  searchable?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PosicionDropdown | null>(null);

  const reposition = useCallback(() => {
    if (!rootRef.current) return;
    const bounds = rootRef.current.getBoundingClientRect();
    setPosition(calcularPosicionDropdown(
      { top: bounds.top, bottom: bounds.bottom, left: bounds.left, width: bounds.width },
      { ancho: window.innerWidth, alto: window.innerHeight },
      { conBuscador: searchable },
    ));
  }, [searchable]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, reposition]);

  const normalizedOptions = useMemo(() => options.map(option =>
    typeof option === 'string' ? { value: option, label: option } : option
  ), [options]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return query ? normalizedOptions.filter(option => option.label.toLocaleLowerCase('es').includes(query)) : normalizedOptions;
  }, [normalizedOptions, search]);

  const selectedLabels = values.map(value => normalizedOptions.find(option => option.value === value)?.label ?? value);

  const label = values.length === 0
    ? placeholder
    : values.length === 1
      ? selectedLabels[0]
      : `${values.length} seleccionados`;

  const toggleOption = (option: string) => {
    onChange(values.includes(option) ? values.filter(value => value !== option) : [...values, option]);
  };

  return (
    <div ref={rootRef} className={`premium-select-root${isOpen ? ' is-open' : ''}`}>
      <div
        className={`form-select premium-select-trigger${values.length ? ' has-value' : ''}${isOpen ? ' is-open' : ''}`}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) reposition();
          setIsOpen(open => !open);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!isOpen) reposition();
            setIsOpen(open => !open);
          } else if (event.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
          }
        }}
      >
        <span className="premium-select-value">{label}</span>
        <ChevronDown size={14} className={`premium-select-chevron${isOpen ? ' is-open' : ''}`} />
      </div>

      {isOpen && position && createPortal(
        <div
          ref={panelRef}
          className={`premium-select-dropdown is-portaled${position.haciaArriba ? ' opens-upward' : ''}`}
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            transform: position.haciaArriba ? 'translateY(-100%)' : undefined,
          }}
        >
          {searchable && (
            <div className="premium-select-search">
              <div className="premium-select-search__field">
                <Search size={12} />
                <input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar…" />
              </div>
            </div>
          )}
          <div
            className="premium-select-options"
            role="listbox"
            aria-multiselectable="true"
            style={{ '--premium-max-height': `${position.maxAlto}px`, '--premium-overflow-y': 'auto' } as CSSProperties}
          >
            <div className="premium-select-empty-option" onClick={() => onChange([])}>
              <X size={12} /> {clearLabel}
            </div>
            {filteredOptions.map(option => {
              const selected = values.includes(option.value);
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  className={`premium-select-option${selected ? ' is-selected' : ''} ${styles.option}`}
                  onClick={() => toggleOption(option.value)}
                >
                  <span>{option.label}</span>
                  <span className={`${styles.check}${selected ? ` ${styles.checkSelected}` : ''}`} aria-hidden="true">
                    {selected && <Check size={12} />}
                  </span>
                </div>
              );
            })}
            {filteredOptions.length === 0 && <div className="premium-select-no-results">Sin resultados</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
