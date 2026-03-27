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
  analista: string;
  fechaDesde: string;
  fechaHasta: string;
  montoMin: string;
  montoMax: string;
  scoreMin: string;
  scoreMax: string;
  esRe: string;
}

const initialState: FilterState = {
  search: '',
  estado: '',
  analista: '',
  fechaDesde: '',
  fechaHasta: '',
  montoMin: '',
  montoMax: '',
  scoreMin: '',
  scoreMax: '',
  esRe: '',
};

interface FilterCtx {
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string) => void;
  limpiarFiltros: () => void;
  hayFiltros: boolean;
  isCreationModalOpen: boolean;
  setIsCreationModalOpen: (val: boolean) => void;
  pageSize: number;
  setPageSize: (val: number) => void;
  triggerExport: () => void;
  exportTick: number;
  currentPage: number;
  setCurrentPage: (val: number | ((p: number) => number)) => void;
  totalResults: number;
  setTotalResults: (val: number) => void;
}

const FilterContext = createContext<FilterCtx | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialState);
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [exportTick, setExportTick] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const setFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFilters(initialState);
  }, []);

  const hayFiltros = useMemo(() => {
    return Object.values(filters).some(v => v !== '');
  }, [filters]);

  const triggerExport = useCallback(() => {
    setExportTick(prev => prev + 1);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  // Escuchar tecla Escape para limpiar filtros o cerrar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreationModalOpen) {
          setIsCreationModalOpen(false);
          return;
        }
        if (hayFiltros) {
          limpiarFiltros();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hayFiltros, limpiarFiltros, isCreationModalOpen]);

  return (
    <FilterContext.Provider value={{
      filters, setFilter, limpiarFiltros, hayFiltros,
      isCreationModalOpen, setIsCreationModalOpen,
      pageSize, setPageSize, triggerExport, exportTick,
      currentPage, setCurrentPage, totalResults, setTotalResults
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
