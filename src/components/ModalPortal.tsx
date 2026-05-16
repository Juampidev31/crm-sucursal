'use client';
import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza children dentro de document.body para escapar stacking contexts
 * rotos por ancestros con transform/will-change/filter (ZoomWrapper, motion.div).
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
