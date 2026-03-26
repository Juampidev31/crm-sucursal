'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading } = useAuth();
  const isLoginPage = pathname === '/login';

  // Manejador global de Escape — vuelve a Registros si no hay modales abiertos
  React.useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const modalOpen = !!document.querySelector('.modal-overlay');
        if (!modalOpen && pathname !== '/registros' && pathname !== '/login') {
          router.push('/registros');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalEscape, { capture: false });
    return () => window.removeEventListener('keydown', handleGlobalEscape);
  }, [pathname, router]);

  // La página de login no usa el layout principal
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#000',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const isFullWidth = pathname === '/analistas';

  return (
    <DataProvider>
      <div className="wrapper">
        <Sidebar hidden={isFullWidth} />
        <main className={isFullWidth ? 'content-wrapper content-fullwidth' : 'content-wrapper'}>
          {children}
        </main>
      </div>
    </DataProvider>
  );
}
