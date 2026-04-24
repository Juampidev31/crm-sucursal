'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { HistoricoVenta, historicoVentaSchema, parseRows } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface HistoricoCtx {
  historicoVentas: HistoricoVenta[];
  mutateHistoricoVentas: (mapper: (prev: HistoricoVenta[]) => HistoricoVenta[]) => void;
  pushHistoricoChange: (type: ChangeType, historico: HistoricoVenta) => void;
}

const HistoricoContext = createContext<HistoricoCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const historicoChangeSchema = z.object({ type: changeType, historico: historicoVentaSchema });



export function HistoricoProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [historicoVentas, setHistoricoVentas] = useState<HistoricoVenta[]>([]);

  const fetchHistorico = useCallback(async () => {
    const { data, error } = await supabase
      .from('historico_ventas')
      .select('id,analista,anio,mes,capital_real,ops_real');
    if (error) { reportError('refresh:historico_ventas', error); return; }
    let dropped = 0;
    const parsed = parseRows(historicoVentaSchema, data, (i, err, row) => {
      dropped++;
      const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
      console.warn(`[HistoricoProvider] historico inválido [${i}] id=${rowId}:`, err.issues);
    });
    if (dropped > 0) reportError('refresh:historico_ventas', { message: `${dropped} fila(s) descartada(s) en historico_ventas — revisá consola` });
    setHistoricoVentas(parsed);
  }, [reportError]);

  const fetchRef = useRef(fetchHistorico);
  useEffect(() => { fetchRef.current = fetchHistorico; }, [fetchHistorico]);

  const broadcastRef = useRealtimeBroadcast('crm-broadcast', {
    historico_change: (payload) => {
      const data = validateBroadcast('historico_change', historicoChangeSchema, payload);
      if (!data) return;
      const { type, historico } = data;
      setHistoricoVentas(prev => {
        if (type === 'DELETE') {
          return prev.filter(h => !(h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes));
        }
        const exists = prev.some(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes);
        if (exists) return prev.map(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes ? historico : h);
        return [...prev, historico];
      });
    },
    bulk_refresh: () => { fetchRef.current(); },
  });

  const mutateHistoricoVentas = useCallback((mapper: (prev: HistoricoVenta[]) => HistoricoVenta[]) => {
    setHistoricoVentas(mapper);
  }, []);

  const pushHistoricoChange = useCallback((type: ChangeType, historico: HistoricoVenta) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'historico_change',
      payload: { type, historico },
    }).catch(() => { });
  }, [broadcastRef]);

  useEffect(() => { fetchHistorico(); }, [fetchHistorico]);

  const value = useMemo<HistoricoCtx>(() => ({
    historicoVentas, mutateHistoricoVentas, pushHistoricoChange,
  }), [historicoVentas, mutateHistoricoVentas, pushHistoricoChange]);

  return <HistoricoContext.Provider value={value}>{children}</HistoricoContext.Provider>;
}

export function useHistorico() {
  const ctx = useContext(HistoricoContext);
  if (!ctx) throw new Error('useHistorico must be used within HistoricoProvider');
  return ctx;
}
