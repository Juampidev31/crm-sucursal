'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ExternalLink, Layout, Maximize2, RefreshCw } from 'lucide-react';

interface SplitLayoutProps {
  leftPath: string;
  rightPath: string;
  onClose: () => void;
  onPathsChange: (left: string, right: string) => void;
}

const AVAILABLE_ROUTES = [
  { path: '/registros', label: 'Registros' },
  { path: '/ajustes', label: 'Ajustes' },
  { path: '/proyeccion', label: 'Proyección' },
  { path: '/analistas', label: 'Analistas' },
  { path: '/recordatorios', label: 'Recordatorios' },
];

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

  const NavControl = ({ side, currentPath }: { side: 'left' | 'right', currentPath: string }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      background: 'linear-gradient(to bottom, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      justifyContent: 'space-between',
      height: '46px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layout size={14} color="#8f929d" />
        </div>
        <select 
          value={currentPath}
          onChange={(e) => handleSelect(side, e.target.value)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            outline: 'none',
            padding: '4px 8px 4px 0',
            fontFamily: 'inherit'
          }}
        >
          {AVAILABLE_ROUTES.map(r => (
            <option key={r.path} value={r.path} style={{ background: '#0c0c0c', color: '#fff' }}>{r.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          onClick={() => reloadIframe(side)}
          title="Recargar panel"
          style={{ background: 'none', border: 'none', color: '#8f929d', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8f929d'; e.currentTarget.style.background = 'transparent'; }}
        >
          <RefreshCw size={14} />
        </button>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
        <a 
          href={currentPath} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Abrir en pestaña nueva"
          style={{ background: 'none', border: 'none', color: '#8f929d', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8f929d'; e.currentTarget.style.background = 'transparent'; }}
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      width: '100%', 
      background: '#050505',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Overlay to prevent iframe capturing mouse events during drag */}
      {isDragging && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'col-resize' }} />
      )}

      {/* Header del Split View */}
      <div style={{
        height: '44px',
        width: '100%',
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.05))',
            border: '1px solid rgba(167,139,250,0.2)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 900,
            color: '#a78bfa',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Maximize2 size={12} />
            ADMIN MULTI-VIEW PRO
          </div>
          <div style={{ fontSize: '11px', color: 'var(--fg-muted)', fontWeight: 600 }}>
            {splitRatio.toFixed(0)}% / {(100 - splitRatio).toFixed(0)}%
          </div>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '6px 14px',
            color: '#ff3366',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#ff5f5f'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ff3366'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.1)'; }}
        >
          SALIR DEL MODO SPLIT
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Contenido Dividido */}
      <div 
        ref={containerRef}
        style={{ 
        flex: 1, 
        display: 'flex', 
        width: '100%', 
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Panel Izquierdo */}
        <div style={{ 
          width: `${splitRatio}%`,
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 0,
          background: '#0c0c0c'
        }}>
          <NavControl side="left" currentPath={leftPath} />
          <iframe 
            key={`left-${keyLeft}`}
            src={`${leftPath}${leftPath.includes('?') ? '&' : '?'}minimal=true`}
            style={{ 
              flex: 1, 
              width: '100%', 
              border: 'none',
              background: '#050505',
              boxShadow: 'inset -10px 0 20px rgba(0,0,0,0.2)'
            }}
          />
        </div>

        {/* Resizer Handle */}
        <div 
          onMouseDown={startDrag}
          style={{
            width: '10px',
            background: isDragging ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.02)',
            cursor: 'col-resize',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
          onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
        >
          <div style={{ 
            width: '4px', 
            height: '32px', 
            background: isDragging ? '#a78bfa' : 'rgba(255,255,255,0.3)', 
            borderRadius: '4px',
            boxShadow: isDragging ? '0 0 8px rgba(167,139,250,0.8)' : 'none',
            transition: 'all 0.2s'
          }} />
        </div>

        {/* Panel Derecho */}
        <div style={{ 
          width: `calc(${100 - splitRatio}% - 10px)`,
          display: 'flex', 
          flexDirection: 'column',
          minWidth: 0,
          background: '#0c0c0c'
        }}>
          <NavControl side="right" currentPath={rightPath} />
          <iframe 
            key={`right-${keyRight}`}
            src={`${rightPath}${rightPath.includes('?') ? '&' : '?'}minimal=true`}
            style={{ 
              flex: 1, 
              width: '100%', 
              border: 'none',
              background: '#050505',
              boxShadow: 'inset 10px 0 20px rgba(0,0,0,0.2)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
