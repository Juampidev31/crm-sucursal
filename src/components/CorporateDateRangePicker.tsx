'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type DateRange = { from: string; to: string };

type CorporateDateRangePickerProps = {
  fromValue: string;
  toValue: string;
  onChange: (range: DateRange) => void;
  compact?: boolean;
  placeholder?: string;
};

const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const CorporateDateRangePicker = memo(({
  fromValue,
  toValue,
  onChange,
  compact = false,
  placeholder = 'Desde — Hasta',
}: CorporateDateRangePickerProps) => {
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parseDate = useCallback((iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : new Date();
  }, []);

  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(fromValue || toValue));

  useEffect(() => {
    if (fromValue || toValue) setVisibleMonth(parseDate(fromValue || toValue));
  }, [fromValue, toValue, parseDate]);

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
  const todayIso = toIso(new Date());

  const label = fromValue && toValue
    ? fromValue === toValue ? formatDate(fromValue) : `${formatDate(fromValue)} — ${formatDate(toValue)}`
    : fromValue ? `Desde ${formatDate(fromValue)} · Elegí hasta`
      : toValue ? `Hasta ${formatDate(toValue)}`
        : placeholder;

  const toggle = () => {
    setOpen(current => {
      const next = !current;
      if (next) setSelectingEnd(Boolean(fromValue && !toValue));
      return next;
    });
  };

  const selectDay = (iso: string) => {
    if (!selectingEnd || !fromValue || toValue) {
      onChange({ from: iso, to: '' });
      setSelectingEnd(true);
      return;
    }

    const from = iso < fromValue ? iso : fromValue;
    const to = iso < fromValue ? fromValue : iso;
    onChange({ from, to });
    setSelectingEnd(false);
    setOpen(false);
  };

  const clear = () => {
    onChange({ from: '', to: '' });
    setSelectingEnd(false);
    setOpen(false);
  };

  const selectToday = () => {
    onChange({ from: todayIso, to: todayIso });
    setSelectingEnd(false);
    setOpen(false);
  };

  return (
    <div className={`corporate-date-picker corporate-date-range-picker${compact ? ' is-compact' : ''}${fromValue || toValue ? ' has-value' : ''}`} ref={ref}>
      <button type="button" className="corporate-date-trigger" onClick={toggle} aria-expanded={open} aria-label={label}>
        <CalendarRange size={compact ? 17 : 15} />
        {fromValue || toValue ? (
          <span className="corporate-date-range-trigger__values" aria-hidden="true">
            <span>
              <small>Desde</small>
              <strong>{fromValue ? formatDate(fromValue) : 'Elegir'}</strong>
            </span>
            <i>→</i>
            <span>
              <small>Hasta</small>
              <strong>{toValue ? formatDate(toValue) : 'Elegir'}</strong>
            </span>
          </span>
        ) : <span>{placeholder}</span>}
        <ChevronDown size={14} />
      </button>
      {(fromValue || toValue) && (
        <button type="button" className="corporate-date-range-clear" onClick={clear} aria-label="Limpiar rango de fechas" title="Limpiar fechas">
          <X size={13} />
        </button>
      )}
      {open && (
        <div className="corporate-calendar corporate-range-calendar" role="dialog" aria-label="Seleccionar rango de fechas">
          <div className="corporate-range-calendar__selection" aria-live="polite">
            <span className={!selectingEnd ? 'is-active' : undefined}>
              <small>Desde</small>
              <strong>{fromValue ? formatDate(fromValue) : 'Elegir fecha'}</strong>
            </span>
            <i aria-hidden="true">→</i>
            <span className={selectingEnd ? 'is-active' : undefined}>
              <small>Hasta</small>
              <strong>{toValue ? formatDate(toValue) : selectingEnd ? 'Elegir fecha' : '—'}</strong>
            </span>
          </div>
          <div className="corporate-calendar__header">
            <button type="button" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
            <strong>{new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(visibleMonth)}</strong>
            <button type="button" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
          </div>
          <div className="corporate-calendar__weekdays">{['L','M','M','J','V','S','D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="corporate-calendar__days">
            {days.map(day => {
              const iso = toIso(day);
              const isInRange = Boolean(fromValue && toValue && iso > fromValue && iso < toValue);
              const className = [
                day.getMonth() !== month ? 'is-outside' : '',
                iso === todayIso ? 'is-today' : '',
                isInRange ? 'is-in-range' : '',
                iso === fromValue ? 'is-range-start' : '',
                iso === toValue ? 'is-range-end' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  type="button"
                  key={iso}
                  className={className}
                  aria-label={new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(day)}
                  aria-pressed={iso === fromValue || iso === toValue}
                  onClick={() => selectDay(iso)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <p className="corporate-range-calendar__hint">
            {selectingEnd ? 'Ahora elegí la fecha final del período.' : 'Elegí la fecha inicial del período.'}
          </p>
          <div className="corporate-calendar__footer">
            <button type="button" onClick={clear}>Limpiar</button>
            <button type="button" onClick={selectToday}>Solo hoy</button>
          </div>
        </div>
      )}
    </div>
  );
});

CorporateDateRangePicker.displayName = 'CorporateDateRangePicker';
