'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ErrorProvider, useDataError } from '@/context/ErrorContext';
import { RegistrosProvider } from '@/features/registros/RegistrosProvider';
import { RecordatoriosProvider, useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { ObjetivosProvider } from '@/features/objetivos/ObjetivosProvider';
import { HistoricoProvider } from '@/features/historico/HistoricoProvider';
import { SettingsProvider } from '@/features/settings/SettingsProvider';
import { FilterProvider, useFilter } from '@/context/FilterContext';
import Sidebar from './Sidebar';
import ZoomWrapper from './ZoomWrapper';
import { Bell, X, AlertCircle, Columns, Menu, ChevronRight } from 'lucide-react';
import SplitLayout from './SplitLayout';
import { formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Toast card compartido por DataErrorToast y ReminderAlertPopup
type ToastSide = 'left' | 'right';
function ToastCard({
  side, accentColor, icon, iconTint, title, subtitle, body, onClose, zIndex = 1000,
}: {
  side: ToastSide;
  accentColor: string;
  icon: React.ReactNode;
  iconTint: string;
  title: string;
  subtitle?: string;
  body?: string;
  onClose: () => void;
  zIndex?: number;
}) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', [side]: '24px', zIndex,
      background: 'var(--bg)', color: '#fff', padding: '14px 18px',
      borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '420px',
      animation: 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      border: '1px solid rgba(255,255,255,0.03)',
      borderLeft: `3px solid ${accentColor}`,
    }}>
      <div style={{
        width: '32px', height: '32px', background: iconTint,
        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '11px', color: 'var(--fg-dim)', marginTop: '2px', fontFamily: 'monospace' }}>{subtitle}</div>
        )}
        {body && (
          <div style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: '4px', wordBreak: 'break-word' }}>{body}</div>
        )}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}

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
    <ToastCard
      side="left"
      accentColor="var(--rojo)"
      iconTint="rgba(220,53,69,0.1)"
      icon={<AlertCircle size={16} style={{ color: 'var(--rojo)' }} />}
      title="Error al sincronizar datos"
      subtitle={lastError.scope}
      body={lastError.message}
      onClose={clearError}
      zIndex={1001}
    />
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
            background: 'var(--bg)', border: `1px solid ${isAvisoAdmin ? 'var(--azul)' : 'rgba(255,255,255,0.03)'}`,
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
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg-dim)', marginBottom: '16px' }}>
                {reminderAlert.nombre} | CUIL: {reminderAlert.cuil}
              </div>
            )}
            <p style={{ 
              fontSize: '16px', color: 'var(--fg)', lineHeight: '1.6', 
              background: 'rgba(255,255,255,0.015)', padding: '16px', borderRadius: '12px' 
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
    <ToastCard
      side="right"
      accentColor="var(--naranja)"
      iconTint="rgba(245,158,11,0.1)"
      icon={<Bell size={16} style={{ color: 'var(--naranja)' }} />}
      title="Recordatorios Pendientes"
      subtitle={`${pendingReminders} ${pendingReminders === 1 ? 'recordatorio' : 'recordatorios'} sin revisar`}
      onClose={() => setShowToast(false)}
    />
  );
};

function AppShellInner({ children, pathname }: { children: React.ReactNode, pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(0.9);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const { setShowFilters } = useFilter();

  // Auto-hide sidebar when entering reports
  useEffect(() => {
    setShowFilters(false);
    setSidebarHidden(pathname === '/analistas' || pathname.startsWith('/reportes/'));
  }, [pathname, setShowFilters]);
  
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app_zoom_level');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) setZoom(parsed);
    }
  }, []);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const next = Math.max(0.3, Math.min(3, prev + delta));
      localStorage.setItem('app_zoom_level', next.toString());
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(0.9);
    localStorage.setItem('app_zoom_level', '0.9');
  }, []);

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
  }, [handleZoom, resetZoom]);
  
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
          if (pathname?.startsWith('/ajustes')) {
            router.back();
          } else {
            router.push('/registros');
          }
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
          background: 'transparent',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Sistema de</span>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>PROYECCIONES</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg-dim)', letterSpacing: '1px' }}>y</span>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>VENTAS</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'flex-end' }}>
            {isAdmin && !isSplitView && (
              <button 
                onClick={toggleSplitView}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'var(--fg-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'var(--fg-muted)'; }}
              >
                <Columns size={14} />
                MODO SPLIT
              </button>
            )}
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {formatDate(new Date().toISOString())}
            </div>
          </div>
        </header>
      )}

      <div className="wrapper" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {!isMinimal && (
          <>
            <Sidebar 
              hidden={sidebarHidden}
              zoom={zoom} 
              onZoomIn={() => handleZoom(0.1)} 
              onZoomOut={() => handleZoom(-0.1)} 
              onReset={resetZoom} 
            />
          </>
        )}
        <main
          className="content-wrapper"
          style={{
            height: '100%',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {!isMinimal && (
            <button
              onClick={() => setSidebarHidden(false)}
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                zIndex: 300,
                background: 'var(--bg-elev-1)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderLeft: 'none',
                borderRadius: '0 12px 12px 0',
                width: 28,
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: sidebarHidden ? 1 : 0,
                pointerEvents: sidebarHidden ? 'auto' : 'none',
                transform: sidebarHidden ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-28px)'
              }}
              onMouseEnter={e => {
                if (!sidebarHidden) return;
                e.currentTarget.style.width = '36px';
                e.currentTarget.style.background = 'var(--bg-elev-2)';
              }}
              onMouseLeave={e => {
                if (!sidebarHidden) return;
                e.currentTarget.style.width = '28px';
                e.currentTarget.style.background = 'var(--bg-elev-1)';
              }}
            >
              <ChevronRight size={18} strokeWidth={3} />
            </button>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, x: -15, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
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
