'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const CorporateDatePicker = memo(({ value, onChange, compact = false, placeholder = 'Seleccionar fecha' }: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parseDate = useCallback((iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : new Date();
  }, []);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(value));

  useEffect(() => {
    if (value) setVisibleMonth(parseDate(value));
  }, [value, parseDate]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(year, month, index - firstOffset + 1));
  const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayIso = toIso(new Date());
  const label = value ? formatDate(value) : placeholder;

  return (
    <div className={`corporate-date-picker${compact ? ' is-compact' : ''}`} ref={ref}>
      <button type="button" className="corporate-date-trigger" onClick={() => setOpen(current => !current)} aria-expanded={open}>
        <CalendarDays size={compact ? 17 : 15} />
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="corporate-calendar" role="dialog" aria-label="Seleccionar fecha">
          <div className="corporate-calendar__header">
            <button type="button" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
            <strong>{new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(visibleMonth)}</strong>
            <button type="button" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
          </div>
          <div className="corporate-calendar__weekdays">{['L','M','M','J','V','S','D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="corporate-calendar__days">
            {days.map(day => {
              const iso = toIso(day);
              return <button type="button" key={iso} className={`${day.getMonth() !== month ? 'is-outside ' : ''}${iso === value ? 'is-selected ' : ''}${iso === todayIso ? 'is-today' : ''}`} onClick={() => { onChange(iso); setOpen(false); }}>{day.getDate()}</button>;
            })}
          </div>
          <div className="corporate-calendar__footer">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}>Limpiar</button>
            <button type="button" onClick={() => { onChange(todayIso); setOpen(false); }}>Hoy</button>
          </div>
        </div>
      )}
    </div>
  );
});
CorporateDatePicker.displayName = 'CorporateDatePicker';
