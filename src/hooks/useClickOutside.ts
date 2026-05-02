'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Detects clicks outside a ref element and calls the handler.
 * Extracted from CustomSelect & SelectReporte to eliminate duplication.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}
