'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ExternalLink, Layout, Maximize2, RefreshCw } from 'lucide-react';
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

const NavControl = ({ side, currentPath, onSelect, onReload }: {
  side: 'left' | 'right';
  currentPath: string;
  onSelect: (side: 'left' | 'right', path: string) => void;
  onReload: (side: 'left' | 'right') => void;
}) => (
  <div className="split-view__nav">
    <div className="split-view__nav-group">
      <div className="split-view__nav-icon">
        <Layout size={14} color="#8f929d" />
      </div>
      <CustomSelect
        value={currentPath}
        onChange={val => onSelect(side, String(val))}
        options={AVAILABLE_ROUTES.map(r => ({ label: r.label, value: r.path }))}
        width="160px"
      />
    </div>
    <div className="split-view__nav-actions">
      <button
        onClick={() => onReload(side)}
        title="Recargar panel"
        className="split-view__icon-button"
      >
        <RefreshCw size={14} />
      </button>
      <div className="split-view__nav-divider" />
      <a
        href={currentPath}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir en pestaña nueva"
        className="split-view__icon-button"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  </div>
);

export default function SplitLayout({ leftPath, rightPath, onClose, onPathsChange }: SplitLayoutProps) {
  const [splitRatio, setSplitRatio] = useState(50); // percentage 0-100
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [keyLeft, setKeyLeft] = useState(0);
  const [keyRight, setKeyRight] = useState(0);

  const startDrag = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const newRatio = ((e.clientX - left) / width) * 100;
    if (newRatio > 20 && newRatio < 80) { // limits to prevent panels from disappearing
      setSplitRatio(newRatio);
    }
  }, [isDragging]);

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

  return (
    <div className="split-view">
      {/* Overlay to prevent iframe capturing mouse events during drag */}
      {isDragging && (
        <div className="split-view__drag-overlay" />
      )}

      {/* Header del Split View */}
      <div className="split-view__header">
        <div className="split-view__header-meta">
          <div className="split-view__badge">
            <Maximize2 size={12} />
            ADMIN MULTI-VIEW PRO
          </div>
          <div className="split-view__ratio">
            {splitRatio.toFixed(0)}% / {(100 - splitRatio).toFixed(0)}%
          </div>
        </div>

        <button 
          onClick={onClose}
          className="split-view__exit"
        >
          SALIR DEL MODO SPLIT
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Contenido Dividido */}
      <div 
        ref={containerRef}
        className="split-view__content"
        style={{ '--split-left': `${splitRatio}%`, '--split-right': `${100 - splitRatio}%` } as React.CSSProperties}
      >
        {/* Panel Izquierdo */}
        <div className="split-view__panel split-view__panel--left">
          <NavControl side="left" currentPath={leftPath} onSelect={handleSelect} onReload={reloadIframe} />
          <iframe 
            key={`left-${keyLeft}`}
            src={`${leftPath}${leftPath.includes('?') ? '&' : '?'}minimal=true`}
            className="split-view__frame split-view__frame--left"
          />
        </div>

        {/* Resizer Handle */}
        <div 
          onMouseDown={startDrag}
          className={`split-view__resizer${isDragging ? ' is-dragging' : ''}`}
        >
          <div className="split-view__resizer-grip" />
        </div>

        {/* Panel Derecho */}
        <div className="split-view__panel split-view__panel--right">
          <NavControl side="right" currentPath={rightPath} onSelect={handleSelect} onReload={reloadIframe} />
          <iframe 
            key={`right-${keyRight}`}
            src={`${rightPath}${rightPath.includes('?') ? '&' : '?'}minimal=true`}
            className="split-view__frame split-view__frame--right"
          />
        </div>
      </div>
    </div>
  );
}
