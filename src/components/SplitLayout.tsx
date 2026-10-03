'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ExternalLink, Columns3, PanelLeft, PanelRight, RefreshCw } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

interface SplitLayoutProps {
  leftPath: string;
  rightPath: string;
  onClose: () => void;
  onPathsChange: (left: string, right: string) => void;
}

const AVAILABLE_ROUTES = [
  { path: '/registros', label: 'Registros' },
  { path: '/ajustes', label: 'Ajustes' },
  { path: '/analistas', label: 'Analistas' },
];

const SPLIT_RATIO_STORAGE_KEY = 'admin_split_ratio';
const MIN_PANEL_RATIO = 30;
const MAX_PANEL_RATIO = 70;

const routeLabel = (path: string) => AVAILABLE_ROUTES.find(route => route.path === path)?.label ?? 'Panel';

const NavControl = ({ side, currentPath, onSelect, onReload }: {
  side: 'left' | 'right';
  currentPath: string;
  onSelect: (side: 'left' | 'right', path: string) => void;
  onReload: (side: 'left' | 'right') => void;
}) => (
  <div className="split-view__nav">
    <div className="split-view__nav-group">
      <div className="split-view__panel-identity">
        <span className="split-view__nav-icon" aria-hidden="true">
          {side === 'left' ? <PanelLeft size={15} /> : <PanelRight size={15} />}
        </span>
        <span className="split-view__panel-label">Panel {side === 'left' ? 'izquierdo' : 'derecho'}</span>
      </div>
      <CustomSelect
        value={currentPath}
        onChange={val => onSelect(side, String(val))}
        options={AVAILABLE_ROUTES.map(r => ({ label: r.label, value: r.path }))}
        width="clamp(118px, 14vw, 176px)"
      />
    </div>
    <div className="split-view__nav-actions">
      <button
        type="button"
        onClick={() => onReload(side)}
        title={`Recargar ${routeLabel(currentPath)}`}
        aria-label={`Recargar panel ${side === 'left' ? 'izquierdo' : 'derecho'}`}
        className="split-view__icon-button"
      >
        <RefreshCw size={14} />
      </button>
      <div className="split-view__nav-divider" />
      <a
        href={currentPath}
        target="_blank"
        rel="noopener noreferrer"
        title={`Abrir ${routeLabel(currentPath)} en una pestaña nueva`}
        aria-label={`Abrir ${routeLabel(currentPath)} en una pestaña nueva`}
        className="split-view__icon-button"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  </div>
);

export default function SplitLayout({ leftPath, rightPath, onClose, onPathsChange }: SplitLayoutProps) {
  const [splitRatio, setSplitRatio] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [keyLeft, setKeyLeft] = useState(0);
  const [keyRight, setKeyRight] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedRatio = Number.parseFloat(localStorage.getItem(SPLIT_RATIO_STORAGE_KEY) ?? '50');
      if (Number.isFinite(savedRatio)) {
        setSplitRatio(Math.min(MAX_PANEL_RATIO, Math.max(MIN_PANEL_RATIO, savedRatio)));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateSplitRatio = useCallback((ratio: number) => {
    const nextRatio = Math.min(MAX_PANEL_RATIO, Math.max(MIN_PANEL_RATIO, Math.round(ratio)));
    setSplitRatio(nextRatio);
    localStorage.setItem(SPLIT_RATIO_STORAGE_KEY, String(nextRatio));
  }, []);

  const startDrag = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const newRatio = ((e.clientX - left) / width) * 100;
    updateSplitRatio(newRatio);
  }, [isDragging, updateSplitRatio]);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
      return () => {
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', stopDrag);
      };
    }
  }, [isDragging, onDrag, stopDrag]);

  const handleSelect = (side: 'left' | 'right', path: string) => {
    if (side === 'left') {
      onPathsChange(path, rightPath);
    } else {
      onPathsChange(leftPath, path);
    }
  };

  const reloadIframe = (side: 'left' | 'right') => {
    if (side === 'left') setKeyLeft(prev => prev + 1);
    else setKeyRight(prev => prev + 1);
  };

  const handleResizerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updateSplitRatio(splitRatio - 5);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateSplitRatio(splitRatio + 5);
    } else if (event.key === 'Home') {
      event.preventDefault();
      updateSplitRatio(MIN_PANEL_RATIO);
    } else if (event.key === 'End') {
      event.preventDefault();
      updateSplitRatio(MAX_PANEL_RATIO);
    }
  };

  return (
    <div className="split-view">
      {/* Overlay to prevent iframe capturing mouse events during drag */}
      {isDragging && (
        <div className="split-view__drag-overlay" />
      )}

      <div className="split-view__header">
        <div className="split-view__header-meta">
          <div className="split-view__badge">
            <Columns3 size={14} />
            Vista dividida
          </div>
          <div className="split-view__presets" aria-label="Distribución de los paneles">
            {[35, 50, 65].map(ratio => (
              <button
                key={ratio}
                type="button"
                className={splitRatio === ratio ? 'is-active' : ''}
                onClick={() => updateSplitRatio(ratio)}
                aria-pressed={splitRatio === ratio}
              >
                {ratio}/{100 - ratio}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="split-view__exit"
        >
          Cerrar vista dividida
          <X size={15} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="split-view__content"
        style={{ gridTemplateColumns: `minmax(0, ${splitRatio}fr) 7px minmax(0, ${100 - splitRatio}fr)` }}
      >
        <div className="split-view__panel split-view__panel--left">
          <NavControl side="left" currentPath={leftPath} onSelect={handleSelect} onReload={reloadIframe} />
          <iframe 
            key={`left-${keyLeft}`}
            src={`${leftPath}${leftPath.includes('?') ? '&' : '?'}minimal=true`}
            className="split-view__frame split-view__frame--left"
            title={`Panel izquierdo: ${routeLabel(leftPath)}`}
          />
        </div>

        <div
          role="separator"
          aria-label="Cambiar el ancho de los paneles"
          aria-orientation="vertical"
          aria-valuemin={MIN_PANEL_RATIO}
          aria-valuemax={MAX_PANEL_RATIO}
          aria-valuenow={splitRatio}
          tabIndex={0}
          onMouseDown={startDrag}
          onKeyDown={handleResizerKeyDown}
          onDoubleClick={() => updateSplitRatio(50)}
          className={`split-view__resizer${isDragging ? ' is-dragging' : ''}`}
        >
          <div className="split-view__resizer-grip" />
        </div>

        <div className="split-view__panel split-view__panel--right">
          <NavControl side="right" currentPath={rightPath} onSelect={handleSelect} onReload={reloadIframe} />
          <iframe 
            key={`right-${keyRight}`}
            src={`${rightPath}${rightPath.includes('?') ? '&' : '?'}minimal=true`}
            className="split-view__frame split-view__frame--right"
            title={`Panel derecho: ${routeLabel(rightPath)}`}
          />
        </div>
      </div>
    </div>
  );
}
