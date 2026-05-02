'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';

// ── Extracted button — eliminates 3x style duplication ────────────────────────
const zoomBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: 'none',
  color: '#fff',
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s ease, transform 0.15s ease',
};

function ZoomButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      style={zoomBtnStyle}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ZoomWrapper({ 
  children 
}: { 
  children: React.ReactNode; 
}) {
  const [zoom, setZoom] = useState(0.9);
  const [isAnimating, setIsAnimating] = useState(false);
  const [zoomColor, setZoomColor] = useState('#fff');
  const [mounted, setMounted] = useState(false);
  const prevZoomRef = useRef(0.9);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app_zoom_level');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) {
        setZoom(parsed);
        prevZoomRef.current = parsed;
      }
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const next = Math.min(prev + 0.1, 3);
      localStorage.setItem('app_zoom_level', next.toString());
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(prev - 0.1, 0.3);
      localStorage.setItem('app_zoom_level', next.toString());
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setZoom(0.9);
    localStorage.setItem('app_zoom_level', '0.9');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (zoom !== prevZoomRef.current) {
      setIsAnimating(true);
      setZoomColor(zoom > prevZoomRef.current ? '#4ade80' : '#f87171');
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setZoomColor('#fff');
      }, 300);
      prevZoomRef.current = zoom;
      return () => clearTimeout(timer);
    }
  }, [zoom, mounted]);

  // Intercept browser zoom (Ctrl+wheel / Ctrl+±) — deps now include stable callbacks
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); handleZoomIn(); }
        else if (e.key === '-') { e.preventDefault(); handleZoomOut(); }
        else if (e.key === '0') { e.preventDefault(); handleReset(); }
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleZoomIn, handleZoomOut, handleReset]);

  if (!mounted) {
    return <div style={{ width: '100%', minHeight: '100%' }}>{children}</div>;
  }

  return (
    <>
      <div 
        className="zoom-controls-active"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 999999,
          display: 'flex',
          gap: '8px',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          padding: '8px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
          alignItems: 'center'
        }}
      >
        <ZoomButton onClick={handleZoomOut}>
          <ZoomOut size={16} />
        </ZoomButton>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '50px',
          fontSize: '12px',
          fontWeight: 800,
          color: zoomColor,
          fontFamily: "'Outfit', sans-serif",
          transition: 'color 0.2s ease, transform 0.2s ease',
          transform: `scale(${isAnimating ? 1.05 : 1})`
        }}>
          {Math.round(zoom * 100)}%
        </div>

        <ZoomButton onClick={handleZoomIn}>
          <ZoomIn size={16} />
        </ZoomButton>
        
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        
        <ZoomButton onClick={handleReset}>
          <Maximize size={14} />
        </ZoomButton>
      </div>

      <div 
        style={{ 
          width: `${100 / zoom}%`,
          minHeight: `${100 / zoom}%`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          // Only animate GPU-accelerated `transform` — width/min-height change instantly
          // (imperceptible because scale compensates). This maintains 60fps.
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        {children}
      </div>
    </>
  );
}
