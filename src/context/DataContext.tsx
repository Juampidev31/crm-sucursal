'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro } from '@/types';

export interface Objetivo {
  id?: string;
  analista: string;
  mes: number;
  anio: number;
  meta_ventas: number;
  meta_operaciones: number;
}

export interface DiasConfig {
  analista: string;
  dias_habiles: number;
  dias_transcurridos: number;
}

interface DataCtx {
  registros: Registro[];
  objetivos: Objetivo[];
  diasConfig: DiasConfig[];
  loading: boolean;
  pendingReminders: number;
  setRegistros: React.Dispatch<React.SetStateAction<Registro[]>>;
  setPendingReminders: React.Dispatch<React.SetStateAction<number>>;
  refresh: (silent?: boolean) => void;
}

const DataContext = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingReminders, setPendingReminders] = useState(0);
  const initialized = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: regs }, { data: objs }, { data: dias }, { count }] = await Promise.all([
      supabase.from('registros').select('*').order('fecha', { ascending: false }).limit(2000),
      supabase.from('objetivos').select('*'),
      supabase.from('dias_habiles_config').select('analista, dias_habiles, dias_transcurridos'),
      supabase.from('recordatorios').select('*', { count: 'exact', head: true }).eq('mostrado', false),
    ]);
    if (regs) setRegistros(regs as Registro[]);
    if (objs) setObjetivos(objs as Objetivo[]);
    if (dias) setDiasConfig(dias as DiasConfig[]);
    setPendingReminders(count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      refresh();
    }
  }, [refresh]);

  return (
    <DataContext.Provider value={{ registros, objetivos, diasConfig, loading, pendingReminders, setRegistros, setPendingReminders, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
