'use client';

import { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  message: string;
  type: ToastType;
}

export function useToast(duration = 3500) {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  const showToast = useCallback((message: string, type: ToastType) =>
    setToast({ message, type }), []);

  const showSuccess = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const showError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);

  return { toast, showToast, showSuccess, showError };
}
