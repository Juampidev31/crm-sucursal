'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { calcularPosicionDropdown, type PosicionDropdown } from '@/lib/dropdown-position';

export const PremiumSelect = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  isSearchable = false,
  groups,
  onAddCustom,
  error,
  disabled = false,
  maxHeight,
}: {
  value: string;
  onChange: (val: string) => void;
  options?: string[];
  placeholder?: string;
  isSearchable?: boolean;
  groups?: { label: string; items: string[] }[];
  onAddCustom?: () => void;
  error?: string;
  disabled?: boolean;
  maxHeight?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<PosicionDropdown | null>(null);
  const [enModal, setEnModal] = useState(false);

  // El panel se dibuja en un portal sobre <body>, así que sus coordenadas se
  // calculan contra la pantalla a partir del trigger.
  const reposicionar = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPosicion(calcularPosicionDropdown(
      { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
      { ancho: window.innerWidth, alto: window.innerHeight },
      { conBuscador: isSearchable },
    ));
  }, [isSearchable]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      reposicionar();
      setEnModal(!!ref.current?.closest('.modal-content'));
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;   // el panel vive fuera del root
      setIsOpen(false);
    };
    // `true` para enterarse también del scroll de los contenedores internos
    // (el cuerpo del modal), que es lo que mueve al trigger.
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
    };
  }, [isOpen, reposicionar]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options || [];
    const q = search.toLowerCase();
    return (options || []).filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  const filteredGroups = useMemo(() => {
    if (!groups) return null;
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.map(g => ({
      ...g,
      items: g.items.filter(item => item.toLowerCase().includes(q))
    })).filter(g => g.items.length > 0);
  }, [groups, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  const addCustomBtn = onAddCustom && (
    <div
      className="premium-select-add"
      onClick={(e) => { e.stopPropagation(); onAddCustom(); setIsOpen(false); }}
    >
      <Plus size={14} /> {search ? `Agregar "${search}"...` : 'Agregar otro...'}
    </div>
  );

  return (
    <div ref={ref} className={`premium-select-root${isOpen ? ' is-open' : ''}`}>
      <div
        className={`form-select premium-select-trigger${disabled ? ' is-disabled' : ''}${error ? ' has-error' : ''}${value ? ' has-value' : ''}`}
        role="button"
        aria-expanded={isOpen}
        tabIndex={disabled ? -1 : 0}
        onClick={toggleOpen}
        onKeyDown={e => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleOpen();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setIsOpen(false);
          }
        }}
      >
        <span className="premium-select-value">
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`premium-select-chevron${isOpen ? ' is-open' : ''}`} />
      </div>

      {isOpen && posicion && createPortal(
        <div
          ref={panelRef}
          className={`premium-select-dropdown is-portaled${posicion.haciaArriba ? ' opens-upward' : ''}${enModal ? ' is-in-modal' : ''}`}
          style={{
            top: posicion.top,
            left: posicion.left,
            width: posicion.width,
            transform: posicion.haciaArriba ? 'translateY(-100%)' : undefined,
          }}
        >
          {isSearchable && (
            <div className="premium-select-search">
              <div className="premium-select-search__field">
                <Search size={12} />
                <input
                  autoFocus
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="premium-select-options" style={{
            // El tope de la pantalla manda siempre: si el que pide el componente
            // no entra, se recorta al espacio real y la lista scrollea.
            '--premium-max-height': `${Math.min(
              posicion.maxAlto,
              maxHeight !== undefined && maxHeight !== 'none' ? Number.parseFloat(maxHeight) || posicion.maxAlto
                : (isSearchable ? 300 : posicion.maxAlto),
            )}px`,
            '--premium-overflow-y': 'auto',
          } as React.CSSProperties}>
            {!search && (
              <div
                className="premium-select-empty-option"
                onClick={(e) => { e.stopPropagation(); handleSelect(""); }}
              >
                <X size={12} /> Sin especificar
              </div>
            )}
            {groups ? (
              <>
                {filteredGroups?.map((g, idx) => (
                  <div key={idx}>
                    <div className="premium-select-group-label">{g.label}</div>
                    {g.items.map(opt => (
                      <div
                        key={opt}
                        onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                        className={`premium-select-option${value === opt ? ' is-selected' : ''}`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                ))}
                {addCustomBtn}
              </>
            ) : (
              <>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map(opt => (
                    <div
                      key={opt}
                      onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                      className={`premium-select-option${value === opt ? ' is-selected' : ''}`}
                    >
                      {opt}
                    </div>
                  ))
                ) : !onAddCustom && (
                  <div className="premium-select-no-results">
                    Sin resultados
                  </div>
                )}
                {addCustomBtn}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
      {/* selectFade animation is in globals.css */}
    </div>
  );
};
