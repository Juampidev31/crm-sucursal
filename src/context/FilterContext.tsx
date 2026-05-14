'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

export const ESTADOS = [
  'proyeccion', 'venta', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc'
];

export const ANALISTAS = ['Luciana', 'Victoria'];

interface FilterState {
  search: string;
  estado: string;
  estados: string[];
  analista: string;
  fechaDesde: string;
  fechaHasta: string;
  montoMin: string;
  montoMax: string;
  scoreMin: string;
  scoreMax: string;
  esRe: string;
  soloAlertasVencidas: boolean;
  acuerdoPrecios: string[];
}

const initialState: FilterState = {
  search: '',
  estado: '',
  estados: [],
  analista: '',
  fechaDesde: '',
  fechaHasta: '',
  montoMin: '',
  montoMax: '',
  scoreMin: '',
  scoreMax: '',
  esRe: '',
  soloAlertasVencidas: false,
  acuerdoPrecios: [],
};

interface FilterCtx {
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: FilterState[keyof FilterState]) => void;
  toggleEstado: (estado: string) => void;
  toggleAcuerdoPrecios: (acuerdo: string) => void;
  limpiarFiltros: () => void;
  hayFiltros: boolean;
  isCreationModalOpen: boolean;
  setIsCreationModalOpen: (val: boolean) => void;
  pageSize: number;
  setPageSize: (val: number) => void;
  currentPage: number;
  setCurrentPage: (val: number | ((p: number) => number)) => void;
  totalResults: number;
  setTotalResults: (val: number) => void;
  showFilters: boolean;
  setShowFilters: (val: boolean | ((v: boolean) => boolean)) => void;
}

export const FilterContext = createContext<FilterCtx | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialState);
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleEstado = useCallback((estado: string) => {
    setFilters(prev => {
      const cur = prev.estados;
      return { ...prev, estados: cur.includes(estado) ? cur.filter(e => e !== estado) : [...cur, estado] };
    });
  }, []);

  const toggleAcuerdoPrecios = useCallback((acuerdo: string) => {
    setFilters(prev => {
      const cur = prev.acuerdoPrecios;
      return { ...prev, acuerdoPrecios: cur.includes(acuerdo) ? cur.filter(a => a !== acuerdo) : [...cur, acuerdo] };
    });
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFilters(initialState);
  }, []);

  const hayFiltros = useMemo(() => {
    return Object.entries(filters).some(([k, v]) => {
      if (k === 'estados') return (v as string[]).length > 0;
      if (k === 'acuerdoPrecios') return (v as string[]).length > 0;
      if (typeof v === 'boolean') return v === true;
      return v !== '';
    });
  }, [filters]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  return (
    <FilterContext.Provider value={{
      filters, setFilter, toggleEstado, toggleAcuerdoPrecios, limpiarFiltros, hayFiltros,
      isCreationModalOpen, setIsCreationModalOpen,
      pageSize, setPageSize,
      currentPage, setCurrentPage, totalResults, setTotalResults,
      showFilters, setShowFilters,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
