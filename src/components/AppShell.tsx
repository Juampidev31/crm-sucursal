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
  const isPublicRoute = pathname.startsWith('/publico');

  // Manejador global de Escape — vuelve a Registros si no hay modales abiertos
  useEffect(() => {
    if (isPublicRoute || isLoginPage) return;
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

  if (isPublicRoute || isLoginPage) return <>{children}</>;

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

  return (
    <DataProvider>
      <FilterProvider>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
          {/* Top Banner — Full Width — Hidden in Reports/Analysts */}
          {!pathname.startsWith('/reportes') && pathname !== '/analistas' && (
            <header style={{
              height: '60px',
              width: '100%',
              background: '#000',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 32px',
              zIndex: 10,
              flexShrink: 0,
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Sistema de</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>PROYECCIONES</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#333', letterSpacing: '1px' }}>y</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>VENTAS</span>
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {formatDate(new Date().toISOString())}
                </div>
              </div>
            </header>
          )}

          <div className="wrapper" style={{ flex: 1, overflow: 'hidden' }}>
            <Sidebar />
            <main
              className="content-wrapper"
              style={{
                height: '100%',
                overflowY: 'auto',
                paddingTop: (pathname.startsWith('/reportes') || pathname === '/analistas') ? '10px' : undefined
              }}
            >
              {children}
            </main>
          </div>
          <ReminderAlertPopup />
        </div>
      </FilterProvider>
    </DataProvider>
  );
}
