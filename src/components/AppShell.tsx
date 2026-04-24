'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ErrorProvider, useDataError } from '@/context/ErrorContext';
import { RegistrosProvider } from '@/features/registros/RegistrosProvider';
import { RecordatoriosProvider, useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { ObjetivosProvider } from '@/features/objetivos/ObjetivosProvider';
import { HistoricoProvider } from '@/features/historico/HistoricoProvider';
import { SettingsProvider } from '@/features/settings/SettingsProvider';
import { FilterProvider } from '@/context/FilterContext';
import Sidebar from './Sidebar';
import { Bell, X, AlertCircle, Columns, Layout, ChevronLeft, ChevronRight } from 'lucide-react';
import SplitLayout from './SplitLayout';
import { formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Toast global para errores reportados desde cualquier feature/context
const DataErrorToast = () => {
  const { lastError, clearError } = useDataError();

  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(() => clearError(), 6000);
    return () => clearTimeout(t);
  }, [lastError, clearError]);

  if (!lastError) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '24px', zIndex: 1001,
      background: '#0a0a0a', color: '#fff', padding: '14px 18px',
      borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '420px',
      animation: 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: '3px solid var(--rojo)',
    }}>
      <div style={{
        width: '32px', height: '32px', background: 'rgba(220,53,69,0.1)',
        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <AlertCircle size={16} style={{ color: 'var(--rojo)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Error al sincronizar datos</div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', fontFamily: 'monospace' }}>{lastError.scope}</div>
        <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px', wordBreak: 'break-word' }}>{lastError.message}</div>
      </div>
      <button onClick={clearError} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
};

// Componente para avisos de recordatorios pendientes
const ReminderAlertPopup = () => {
  const { pendingReminders } = useRecordatorios();
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

function AppShellInner({ children, pathname }: { children: React.ReactNode, pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAdmin } = useAuth();
  
  const isLoginPage = pathname === '/login';
  const isPublicRoute = pathname.startsWith('/publico');
  const isMinimal = searchParams.get('minimal') === 'true';

  // Estados para Split View
  const [isSplitView, setIsSplitView] = useState(false);
  const [leftPath, setLeftPath] = useState('/registros');
  const [rightPath, setRightPath] = useState('/ajustes');

  useEffect(() => {
    const saved = localStorage.getItem('admin_split_view');
    if (saved === 'true') setIsSplitView(true);
    
    const savedLeft = localStorage.getItem('admin_split_left');
    const savedRight = localStorage.getItem('admin_split_right');
    if (savedLeft) setLeftPath(savedLeft);
    if (savedRight) setRightPath(savedRight);
  }, []);

  const toggleSplitView = () => {
    const newVal = !isSplitView;
    setIsSplitView(newVal);
    localStorage.setItem('admin_split_view', newVal.toString());
  };

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
  }, [pathname, router, isPublicRoute, isLoginPage]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Top Banner — Full Width — Hidden in Reports/Analysts or Minimal Mode */}
      {!isMinimal && !pathname.startsWith('/reportes') && pathname !== '/analistas' && (
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
          position: 'relative',
          marginBottom: '24px',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
            {/* Brand or other left content could go here */}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            flex: 1,
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Sistema de</span>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>PROYECCIONES</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#333', letterSpacing: '1px' }}>y</span>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>VENTAS</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'flex-end' }}>
            {isAdmin && !isSplitView && (
              <button 
                onClick={toggleSplitView}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: '#aaa',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa'; }}
              >
                <Columns size={14} />
                MODO SPLIT
              </button>
            )}
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {formatDate(new Date().toISOString())}
            </div>
          </div>
        </header>
      )}

      <div className="wrapper" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {!isMinimal && <Sidebar />}
        <main
          className="content-wrapper"
          style={{
            height: '100%',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.18,
                ease: [0.4, 0, 0.2, 1]
              }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                paddingTop: isMinimal ? 0 : (pathname.startsWith('/reportes') || pathname === '/analistas') ? '10px' : undefined,
                willChange: 'opacity'
              }}
            >
              {isSplitView && isAdmin && !isMinimal ? (
                <SplitLayout 
                  leftPath={leftPath} 
                  rightPath={rightPath} 
                  onClose={toggleSplitView}
                  onPathsChange={(l, r) => {
                    setLeftPath(l);
                    setRightPath(r);
                    localStorage.setItem('admin_split_left', l);
                    localStorage.setItem('admin_split_right', r);
                  }}
                />
              ) : (
                children
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ReminderAlertPopup />
      <DataErrorToast />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isPublicRoute = pathname.startsWith('/publico');

  if (isPublicRoute || isLoginPage) return <>{children}</>;

  return (
    <ErrorProvider>
    <RegistrosProvider>
    <RecordatoriosProvider>
    <ObjetivosProvider>
    <HistoricoProvider>
    <SettingsProvider>
    <FilterProvider>
      <React.Suspense fallback={null}>
        <AppShellInner pathname={pathname}>
          {children}
        </AppShellInner>
      </React.Suspense>
    </FilterProvider>
    </SettingsProvider>
    </HistoricoProvider>
    </ObjetivosProvider>
    </RecordatoriosProvider>
    </RegistrosProvider>
    </ErrorProvider>
  );
}
