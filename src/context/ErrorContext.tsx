'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export interface DataErrorState {
  scope: string;
  message: string;
  ts: number;
}

interface ErrorCtx {
  lastError: DataErrorState | null;
  reportError: (scope: string, err: unknown) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorCtx | null>(null);

// Provider central de errores: DataContext y future feature providers reportan
// aca, y AppShell tiene un solo toast que los muestra.
export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [lastError, setLastError] = useState<DataErrorState | null>(null);

  const reportError = useCallback((scope: string, err: unknown) => {
    const e = (err && typeof err === 'object') ? err as {
      message?: string; details?: string; hint?: string; code?: string;
    } : null;
    const message = err instanceof Error
      ? err.message
      : (e?.message || e?.details || e?.hint || e?.code || 'Error desconocido');
    // JSON.stringify con getOwnPropertyNames captura props no-enumerables (PostgrestError)
    let dump = '';
    try {
      dump = err && typeof err === 'object'
        ? JSON.stringify(err, Object.getOwnPropertyNames(err as object))
        : String(err);
    } catch { dump = String(err); }
    console.error(`[ErrorContext/${scope}] type=${typeof err} ctor=${(err as { constructor?: { name?: string } })?.constructor?.name ?? '?'} dump=${dump}`);
    setLastError({ scope, message, ts: Date.now() });
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  return (
    <ErrorContext.Provider value={{ lastError, reportError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useDataError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useDataError must be used within ErrorProvider');
  return ctx;
}
