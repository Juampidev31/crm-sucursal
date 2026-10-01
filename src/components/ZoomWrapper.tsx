'use client';

import React from 'react';
import styles from './ZoomWrapper.module.css';

type ZoomStyle = React.CSSProperties & {
  '--app-zoom': number;
  '--app-zoom-size': string;
};

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
      className={styles.root}
      style={{
        '--app-zoom': zoom,
        '--app-zoom-size': `${100 / zoom}%`,
      } as ZoomStyle}
    >
      {children}
    </div>
  );
}
