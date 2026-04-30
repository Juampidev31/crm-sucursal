'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Maximize, ZoomIn, ZoomOut, Move } from 'lucide-react';

export default function ZoomWrapper({ 
  children, 
  initialZoom = 1 
}: { 
  children: React.ReactNode; 
  initialZoom?: number 
}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    // Solo permitir drag si zoom != 1 o si el usuario quiere moverlo
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setPosition({ x: newX, y: newY });
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  // Evitar que el drag continúe si el mouse sale de la ventana
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        position: 'relative',
        cursor: isDragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
        touchAction: 'none' // Para evitar scroll táctil mientras se mueve
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Controles flotantes */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        padding: '8px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        cursor: 'default'
      }} onMouseDown={e => e.stopPropagation()}>
        <button 
          onClick={handleZoomOut}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Alejar"
        >
          <ZoomOut size={18} />
        </button>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '60px',
          fontSize: '13px',
          fontWeight: 800,
          color: '#fff',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div>{Math.round(zoom * 100)}%</div>
          {zoom > 1 && <div style={{ fontSize: '8px', color: '#666', marginTop: -2 }}>DRAG ACTIVO</div>}
        </div>
        <button 
          onClick={handleZoomIn}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Acercar"
        >
          <ZoomIn size={18} />
        </button>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />
        <button 
          onClick={handleReset}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Resetear"
        >
          <Maximize size={16} />
        </button>
      </div>

      {/* Contenido escalable y movible */}
      <div 
        ref={contentRef}
        style={{ 
          width: '100%',
          minHeight: '100vh',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transformOrigin: 'top center',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {children}
      </div>
    </div>
  );
}
