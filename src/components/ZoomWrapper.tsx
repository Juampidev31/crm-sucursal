'use client';

import React from 'react';

/**
 * ZoomWrapper — Purely applies the scale transformation.
 * The state management and UI are handled by the parent (AppShell/Sidebar).
 */
export default function ZoomWrapper({ 
  children,
  zoom = 1
}: { 
  children: React.ReactNode; 
  zoom?: number;
}) {
  return (
    <div 
      style={{ 
        width: `${100 / zoom}%`,
        minHeight: `${100 / zoom}%`,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform'
      }}
    >
      {children}
    </div>
  );
}
