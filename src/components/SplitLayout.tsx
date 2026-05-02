'use client';

import React from 'react';
import { X, ExternalLink, Layout } from 'lucide-react';

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
  
  const handleSelect = (side: 'left' | 'right', path: string) => {
    if (side === 'left') {
      onPathsChange(path, rightPath);
    } else {
      onPathsChange(leftPath, path);
    }
  };

  const NavControl = ({ side, currentPath }: { side: 'left' | 'right', currentPath: string }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      background: 'rgba(255,255,255,0.03)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layout size={12} color="#555" />
        <select 
          value={currentPath}
          onChange={(e) => handleSelect(side, e.target.value)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            outline: 'none',
            padding: '4px 0'
          }}
        >
          {AVAILABLE_ROUTES.map(r => (
            <option key={r.path} value={r.path} style={{ background: '#111', color: '#fff' }}>{r.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a 
          href={currentPath} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Abrir en pestaña nueva"
          style={{ color: '#444', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#444'}
        >
          <ExternalLink size={12} />
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
      background: '#000',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header del Split View */}
      <div style={{
        height: '40px',
        width: '100%',
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(167,139,250,0.1)',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 900,
            color: '#a78bfa',
            letterSpacing: '1px'
          }}>
            ADMIN MULTI-VIEW
          </div>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#ef4444',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ff5f5f'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
        >
          SALIR DEL MODO SPLIT
          <X size={12} />
        </button>
      </div>

      {/* Contenido Dividido */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        width: '100%', 
        overflow: 'hidden' 
      }}>
        {/* Panel Izquierdo */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          borderRight: '2px solid rgba(255,255,255,0.05)',
          minWidth: 0 
        }}>
          <NavControl side="left" currentPath={leftPath} />
          <iframe 
            src={`${leftPath}${leftPath.includes('?') ? '&' : '?'}minimal=true`}
            style={{ 
              flex: 1, 
              width: '100%', 
              border: 'none',
              background: '#050505'
            }}
          />
        </div>

        {/* Panel Derecho */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: 0 
        }}>
          <NavControl side="right" currentPath={rightPath} />
          <iframe 
            src={`${rightPath}${rightPath.includes('?') ? '&' : '?'}minimal=true`}
            style={{ 
              flex: 1, 
              width: '100%', 
              border: 'none',
              background: '#050505'
            }}
          />
        </div>
      </div>
    </div>
  );
}
