'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import ZoomWrapper from './ZoomWrapper';
import { Bell, X, AlertCircle, Columns } from 'lucide-react';
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

// Componente para avisos de recordatorios pendientes y popups de admin
const ReminderAlertPopup = () => {
  const { pendingReminders, reminderAlert, clearReminderAlert, markReminderCompleted } = useRecordatorios();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (pendingReminders > 0 && !reminderAlert) {
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 8000);
      return () => clearTimeout(t);
    }
  }, [pendingReminders, reminderAlert]);

  if (reminderAlert) {
    const isAvisoAdmin = reminderAlert.cuil === 'ADMIN_AVISO';
    
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
        padding: '20px',
      }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: '#0a0a0a', border: `1px solid ${isAvisoAdmin ? 'var(--azul)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '20px', padding: '32px', maxWidth: '500px', width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '20px',
            position: 'relative'
          }}
        >
          <div style={{
            width: '60px', height: '60px', 
            background: isAvisoAdmin ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell size={28} style={{ color: isAvisoAdmin ? 'var(--azul)' : 'var(--naranja)' }} />
          </div>

          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
              {isAvisoAdmin ? 'MENSAJE DEL ADMINISTRADOR' : 'Recordatorio Pendiente'}
            </h3>
            {!isAvisoAdmin && (
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#555', marginBottom: '16px' }}>
                {reminderAlert.nombre} | CUIL: {reminderAlert.cuil}
              </div>
            )}
            <p style={{ 
              fontSize: '16px', color: '#ccc', lineHeight: '1.6', 
              background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' 
            }}>
              {reminderAlert.nota || 'Sin descripción adicional.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button 
              onClick={() => markReminderCompleted(reminderAlert.id)}
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center', height: '48px', fontSize: '14px', fontWeight: 700 }}
            >
              ENTENDIDO
            </button>
            <button 
              onClick={clearReminderAlert}
              className="btn-secondary"
              style={{ height: '48px', padding: '0 20px' }}
            >
              CERRAR
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!showToast || pendingReminders === 0) return null;

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
      <button onClick={() => setShowToast(false)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', marginLeft: '8px' }}>
        <X size={16} />
      </button>
    </div>
  );
};

function AppShellInner({ children, pathname }: { children: React.ReactNode, pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(0.9);
  
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app_zoom_level');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) setZoom(parsed);
    }
  }, []);

  const handleZoom = (delta: number) => {
    setZoom(prev => {
      const next = Math.max(0.3, Math.min(3, prev + delta));
      localStorage.setItem('app_zoom_level', next.toString());
      return next;
    });
  };

  const resetZoom = () => {
    setZoom(0.9);
    localStorage.setItem('app_zoom_level', '0.9');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); handleZoom(0.1); }
        else if (e.key === '-') { e.preventDefault(); handleZoom(-0.1); }
        else if (e.key === '0') { e.preventDefault(); resetZoom(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
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

  if (loading || !mounted) {
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
        {!isMinimal && (
          <Sidebar 
            zoom={zoom} 
            onZoomIn={() => handleZoom(0.1)} 
            onZoomOut={() => handleZoom(-0.1)} 
            onReset={resetZoom} 
          />
        )}
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
                <ZoomWrapper zoom={zoom}>
                  {children}
                </ZoomWrapper>
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

  if (isPublicRoute || isLoginPage) {
    return (
      <React.Suspense fallback={null}>
        <ZoomWrapper>{children}</ZoomWrapper>
      </React.Suspense>
    );
  }

  return (
    <ErrorProvider>
    <RegistrosProvider>
    <ObjetivosProvider>
    <HistoricoProvider>
    <SettingsProvider>
    <FilterProvider>
    <RecordatoriosProvider>
      <React.Suspense fallback={null}>
        <AppShellInner pathname={pathname}>
          {children}
        </AppShellInner>
      </React.Suspense>
    </RecordatoriosProvider>
    </FilterProvider>
    </SettingsProvider>
    </HistoricoProvider>
    </ObjetivosProvider>
    </RegistrosProvider>
    </ErrorProvider>
  );
}
