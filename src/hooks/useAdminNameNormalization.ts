'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'admin-normalize-person-names-v1';
const CHANGE_EVENT = 'crm:admin-name-normalization-change';

export function useAdminNameNormalization() {
  const { isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setEnabled(false);
      return;
    }

    const readPreference = () => setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'true');
    readPreference();
    window.addEventListener('storage', readPreference);
    window.addEventListener(CHANGE_EVENT, readPreference);
    return () => {
      window.removeEventListener('storage', readPreference);
      window.removeEventListener(CHANGE_EVENT, readPreference);
    };
  }, [isAdmin]);

  const toggle = useCallback(() => {
    if (!isAdmin) return;
    const next = !enabled;
    window.localStorage.setItem(STORAGE_KEY, String(next));
    setEnabled(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [enabled, isAdmin]);

  return { enabled: isAdmin && enabled, isAdmin, toggle };
}
