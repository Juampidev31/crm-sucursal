'use client';

import { useState, useEffect, CSSProperties } from 'react';

export function useDeferredMount(delayMs = 450) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return ready;
}

export function ChartShimmer({ style }: { style?: CSSProperties }) {
  return (
    <div
      className="shimmer-bg"
      style={{ height: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)', ...style }}
    />
  );
}
