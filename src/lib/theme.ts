'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

/**
 * Tema claro/oscuro. La fuente de verdad es `data-theme` en <html>: el CSS
 * resuelve cada color con light-dark() a partir del color-scheme que fija ese
 * atributo. Se aplica antes de hidratar con THEME_INIT_SCRIPT (layout) para
 * que no haya parpadeo, y se recuerda por dispositivo en localStorage.
 */
export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function setTheme(theme: Theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* modo privado */ }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'light');
}

/** Para colores que no pasan por CSS (canvas de Chart.js, atributos SVG). */
export function useIsDark() {
  return useTheme() === 'dark';
}
