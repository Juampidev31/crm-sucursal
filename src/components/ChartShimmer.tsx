'use client';

import { useState, useEffect } from 'react';

export function useDeferredMount(delayMs = 450) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return ready;
}

export function ChartShimmer() {
  return <div className="shimmer-bg chart-shimmer" />;
}
