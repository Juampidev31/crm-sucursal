'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DataProvider, useData } from '@/context/DataContext';
import { FilterProvider } from '@/context/FilterContext';
import Sidebar from './Sidebar';
import { Bell, X, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Componente para avisos de recordatorios pendientes
const ReminderAlertPopup = () => {
  const { pendingReminders } = useData();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pendingReminders > 0) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 8000);
      return () => clearTimeout(t);
    }
  }, [pendingReminders]);

  if (!show || pendingReminders === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
      background: '#0a0a0a', color: '#fff', padding: '16px 20px',
      borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', gap: '16px',
      animation: 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: '3px solid var(--naranja)',
    }}>
      <div style={{
        width: '36px', height: '36px', background: 'rgba(245,158,11,0.1)',
        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Bell size={16} style={{ color: 'var(--naranja)' }} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Recordatorios Pendientes</div>
        <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{pendingReminders} {pendingReminders === 1 ? 'recordatorio' : 'recordatorios'} sin revisar</div>
      </div>
      <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', marginLeft: '8px' }}>
        <X size={16} />
      </button>
    </div>
  );
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading } = useAuth();
  const isLoginPage = pathname === '/login';

  // Manejador global de Escape — vuelve a Registros si no hay modales abiertos
  useEffect(() => {
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

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--background)',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const isFullWidth = pathname === '/analistas';

  return (
    <DataProvider>
      <FilterProvider>
        <div className="wrapper">
          <Sidebar hidden={isFullWidth} />
          <main className={isFullWidth ? 'content-wrapper content-fullwidth' : 'content-wrapper'}>
            {children}
          </main>
          <ReminderAlertPopup />
        </div>
      </FilterProvider>
    </DataProvider>
  );
}
