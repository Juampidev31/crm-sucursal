'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';

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
  const [openUpward, setOpenUpward] = useState(false);
  const [search, setSearch] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 250);
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

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

      {isOpen && (
        <div className={`premium-select-dropdown${openUpward ? ' opens-upward' : ''}`}>
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
            '--premium-max-height': maxHeight !== undefined ? maxHeight : (isSearchable ? '300px' : 'none'),
            '--premium-overflow-y': (maxHeight !== undefined ? maxHeight !== 'none' : isSearchable) ? 'auto' : 'visible',
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
        </div>
      )}
      {/* selectFade animation is in globals.css */}
    </div>
  );
};
