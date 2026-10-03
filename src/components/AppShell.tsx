'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ErrorProvider, useDataError } from '@/context/ErrorContext';
import { RegistrosProvider } from '@/features/registros/RegistrosProvider';
import { GestionDiariaProvider } from '@/features/gestion-diaria/GestionDiariaProvider';
import { RecordatoriosProvider, useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { ObjetivosProvider } from '@/features/objetivos/ObjetivosProvider';
import { HistoricoProvider } from '@/features/historico/HistoricoProvider';
import { SettingsProvider } from '@/features/settings/SettingsProvider';
import { FilterProvider, useFilter } from '@/context/FilterContext';
import RecordsSidebar from './RecordsSidebar';
import ZoomWrapper from './ZoomWrapper';
import { Bell, X, AlertCircle, Columns, CalendarDays, ChartColumnIncreasing, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import SplitLayout from './SplitLayout';
import { formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './AppShell.module.css';

// Toast card compartido por DataErrorToast y ReminderAlertPopup
type ToastSide = 'left' | 'right';
type ToastTone = 'danger' | 'warning';
function ToastCard({
  side, tone, icon, title, subtitle, body, onClose,
}: {
  side: ToastSide;
  tone: ToastTone;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  body?: string;
  onClose: () => void;
}) {
  const toastClasses = [
    styles.toast,
    side === 'left' ? styles.toastLeft : styles.toastRight,
    tone === 'danger' ? styles.toastDanger : styles.toastWarning,
  ].join(' ');

  return (
    <div className={toastClasses} role="status">
      <div className={styles.toastIcon}>{icon}</div>
      <div className={styles.toastContent}>
        <div className={styles.toastTitle}>{title}</div>
        {subtitle && (
          <div className={styles.toastSubtitle}>{subtitle}</div>
        )}
        {body && (
          <div className={styles.toastBody}>{body}</div>
        )}
      </div>
      <button aria-label="Cerrar aviso" className={styles.toastClose} onClick={onClose} type="button">
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
      tone="danger"
      icon={<AlertCircle size={16} />}
      title="Error al sincronizar datos"
      subtitle={lastError.scope}
      body={lastError.message}
      onClose={clearError}
    />
  );
};

// Componente para avisos de recordatorios pendientes y popups de admin
const ReminderAlertPopup = () => {
  const { pendingReminders, reminderAlert, clearReminderAlert, markReminderCompleted } = useRecordatorios();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (pendingReminders > 0 && !reminderAlert) {
      const showTimer = window.setTimeout(() => setShowToast(true), 0);
      const hideTimer = window.setTimeout(() => setShowToast(false), 8000);
      return () => {
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
      };
    }
  }, [pendingReminders, reminderAlert]);

  if (reminderAlert) {
    const isAvisoAdmin = reminderAlert.cuil === 'ADMIN_AVISO';
    
    return (
      <div className={styles.reminderOverlay}>
        <motion.div
          aria-modal="true"
          className={`${styles.reminderDialog}${isAvisoAdmin ? ` ${styles.reminderDialogAdmin}` : ''}`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          role="dialog"
        >
          <div className={`${styles.reminderIcon}${isAvisoAdmin ? ` ${styles.reminderIconAdmin}` : ''}`}>
            <Bell size={28} />
          </div>

          <div>
            <h3 className={styles.reminderTitle}>
              {isAvisoAdmin ? 'MENSAJE DEL ADMINISTRADOR' : 'Recordatorio Pendiente'}
            </h3>
            {!isAvisoAdmin && (
              <div className={styles.reminderMeta}>
                {reminderAlert.nombre} | CUIL: {reminderAlert.cuil}
              </div>
            )}
            <p className={styles.reminderBody}>
              {reminderAlert.nota || 'Sin descripción adicional.'}
            </p>
          </div>

          <div className={styles.reminderActions}>
            <button
              onClick={() => markReminderCompleted(reminderAlert.id)}
              className={`btn-primary ${styles.reminderConfirm}`}
            >
              ENTENDIDO
            </button>
            <button
              onClick={clearReminderAlert}
              className={`btn-secondary ${styles.reminderCancel}`}
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
      tone="warning"
      icon={<Bell size={16} />}
      title="Recordatorios Pendientes"
      subtitle={`${pendingReminders} ${pendingReminders === 1 ? 'recordatorio' : 'recordatorios'} sin revisar`}
      onClose={() => setShowToast(false)}
    />
  );
};

const LEGACY_ADMIN_ZOOM_STORAGE_KEY = 'app_admin_zoom_levels_v3';
const PAGE_ZOOM_SCOPE_EVENT = 'crm:page-zoom-scope';
const pageZoomStorageKey = (screen: string) => `app_admin_page_zoom_v1:${screen}`;

// Límites del zoom interno del admin (el que reemplaza al nativo con Ctrl+rueda).
// El piso se mantiene en 0.7: por debajo el layout se rompía en 1366x768, que es
// el motivo por el que existe el interceptor.
const ADMIN_ZOOM_MIN = 0.7;
const ADMIN_ZOOM_MAX = 2;

function AppShellInner({ children, pathname }: { children: React.ReactNode, pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAdmin } = useAuth();
  const isMinimal = searchParams.get('minimal') === 'true';
  const [mounted, setMounted] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [declaredZoomScope, setDeclaredZoomScope] = useState<{ pathname: string; scope: string }>({ pathname: '', scope: '' });
  const [isSidebarHidden, setIsSidebarHidden] = useState(true);
  const { setShowFilters } = useFilter();
  const usesRecordsShell =
    pathname === '/registros' ||
    pathname === '/gestion-diaria' ||
    pathname === '/ajustes' ||
    pathname === '/analistas' ||
    pathname === '/duplicados' ||
    pathname.startsWith('/reportes');

  const queryZoomScope = useMemo(() => {
    const entries = Array.from(searchParams.entries())
      .filter(([key]) => key !== 'minimal')
      .sort(([a], [b]) => a.localeCompare(b));
    return entries.length > 0 ? `?${new URLSearchParams(entries).toString()}` : '';
  }, [searchParams]);
  const screenZoomScope = `${pathname}${queryZoomScope}${declaredZoomScope.pathname === pathname && declaredZoomScope.scope ? `#${declaredZoomScope.scope}` : ''}`;

  useEffect(() => {
    const handleScopeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ pathname?: string; scope?: string }>).detail;
      if (!detail?.scope) return;
      setDeclaredZoomScope({ pathname: detail.pathname || window.location.pathname, scope: detail.scope });
    };
    window.addEventListener(PAGE_ZOOM_SCOPE_EVENT, handleScopeChange);
    return () => window.removeEventListener(PAGE_ZOOM_SCOPE_EVENT, handleScopeChange);
  }, []);

  // Cierra el panel de filtros al cambiar de ruta.
  useEffect(() => {
    setShowFilters(false);
  }, [pathname, setShowFilters]);
  
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = window.setTimeout(() => {
      if (!isAdmin) {
        setCurrentZoom(1);
        return;
      }

      const legacyZooms = localStorage.getItem(LEGACY_ADMIN_ZOOM_STORAGE_KEY);
      if (legacyZooms) {
        try {
          const parsed = JSON.parse(legacyZooms) as Record<string, number>;
          Object.entries(parsed).forEach(([route, zoom]) => {
            const scopedKey = pageZoomStorageKey(route);
            if (localStorage.getItem(scopedKey) === null && Number.isFinite(zoom)) {
              localStorage.setItem(scopedKey, String(zoom));
            }
          });
        } catch {
          // El formato global anterior se descarta; cada ruta mantiene su propia clave.
        }
        localStorage.removeItem(LEGACY_ADMIN_ZOOM_STORAGE_KEY);
      }

      const saved = Number.parseFloat(localStorage.getItem(pageZoomStorageKey(screenZoomScope)) ?? '1');
      setCurrentZoom(Number.isFinite(saved) ? Math.min(ADMIN_ZOOM_MAX, Math.max(ADMIN_ZOOM_MIN, saved)) : 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, loading, screenZoomScope]);

  // El zoom interno arranca en 100% y es una preferencia exclusiva del administrador.
  const defaultZoom = 1;

  const handleZoom = useCallback((delta: number) => {
    if (!isAdmin) return;

    setCurrentZoom(current => {
      const next = Math.max(ADMIN_ZOOM_MIN, Math.min(ADMIN_ZOOM_MAX, Math.round((current + delta) * 100) / 100));
      localStorage.setItem(pageZoomStorageKey(screenZoomScope), String(next));
      return next;
    });
  }, [isAdmin, screenZoomScope]);

  const resetZoom = useCallback(() => {
    if (!isAdmin) return;

    setCurrentZoom(defaultZoom);
    localStorage.setItem(pageZoomStorageKey(screenZoomScope), String(defaultZoom));
  }, [isAdmin, screenZoomScope]);

  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); handleZoom(0.1); }
        else if (e.key === '-') { e.preventDefault(); handleZoom(-0.1); }
        else if (e.key === '0') { e.preventDefault(); resetZoom(); }
      }
    };
    // Ctrl + rueda del mouse: usar el zoom interno de la app en vez del zoom nativo del navegador
    // (que en pantallas chicas como 1366x768 saltaba a 50% y rompía el layout).
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        handleZoom(e.deltaY < 0 ? 0.1 : -0.1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoom, isAdmin, resetZoom]);
  
  // Estados para Split View
  const [isSplitView, setIsSplitView] = useState(false);
  const [leftPath, setLeftPath] = useState('/registros');
  const [rightPath, setRightPath] = useState('/ajustes');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem('admin_split_view');
      if (saved === 'true') setIsSplitView(true);

      const savedLeft = localStorage.getItem('admin_split_left');
      const savedRight = localStorage.getItem('admin_split_right');
      if (savedLeft) setLeftPath(savedLeft);
      if (savedRight) setRightPath(savedRight);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleSplitView = () => {
    const newVal = !isSplitView;
    setIsSplitView(newVal);
    localStorage.setItem('admin_split_view', newVal.toString());
  };

  // Manejador global de Escape — vuelve a Registros si no hay modales abiertos
  useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const modalOpen = !!document.querySelector('.modal-overlay');
        if (!modalOpen && pathname !== '/registros') {
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
  }, [pathname, router]);

  const showOwnSidebar = !isSplitView && !isMinimal;

  if (loading || !mounted) {
    return (
      <div className={styles.loadingScreen}>
        <div className={`spinner ${styles.loadingSpinner}`} />
      </div>
    );
  }

  return (
    <div
      className={[
        styles.shell,
        usesRecordsShell ? styles.recordsShell : '',
        pathname === '/registros' ? styles.recordsListShell : '',
        isSidebarHidden ? styles.sidebarHidden : '',
        isMinimal ? styles.minimalShell : '',
        isSplitView && !isMinimal ? styles.splitShell : '',
      ].filter(Boolean).join(' ')}
      data-app-shell
      data-minimal-mode={isMinimal ? 'true' : undefined}
    >
      {/* Top Banner — Full Width — Hidden in Reports/Analysts or Minimal Mode */}
      {!isMinimal && !pathname.startsWith('/reportes/') && (
        <header className={styles.topbar} data-app-topbar>
          {/* Difuminado sutil y ligero hacia abajo */}
          <div className={styles.topbarFade} />
          <div className={styles.topbarSpacer}>
            {/* Brand or other left content could go here */}
          </div>

          <div className={styles.topbarTitle}>
            <span className={styles.topbarMark} aria-hidden="true">
              <ChartColumnIncreasing size={18} strokeWidth={2} />
            </span>
            <span className={styles.topbarWordmark}>
              <span className={styles.topbarEyebrow}>Sistema de gestión comercial</span>
              <span className={styles.topbarBrandLine}>
                <span className={styles.topbarBrand}>Proyecciones</span>
                <span className={styles.topbarConjunction}>y</span>
                <span className={styles.topbarBrand}>Ventas</span>
              </span>
            </span>
          </div>

          <div className={styles.topbarActions}>
            {usesRecordsShell && !isSplitView && (
              <button
                type="button"
                className={styles.sidebarToggle}
                onClick={() => setIsSidebarHidden(hidden => !hidden)}
                aria-pressed={isSidebarHidden}
                title={isSidebarHidden ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
              >
                {isSidebarHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                <span>{isSidebarHidden ? 'MOSTRAR MENÚ' : 'OCULTAR MENÚ'}</span>
              </button>
            )}
            {isAdmin && !isSplitView && (
              <button 
                onClick={toggleSplitView}
                className={styles.splitToggle}
              >
                <Columns size={14} />
                MODO SPLIT
              </button>
            )}
            <div className={styles.topbarDate}>
              <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
              <span>{formatDate(new Date().toISOString())}</span>
            </div>
          </div>
        </header>
      )}

      <div className={styles.wrapper} data-app-wrapper>
        {showOwnSidebar && !isSidebarHidden && <RecordsSidebar />}
        <main
          className={styles.content}
          data-app-content
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className={[
                styles.pageScroll,
                usesRecordsShell ? styles.recordsPageScroll : '',
                pathname === '/registros' ? styles.recordsListPageScroll : '',
                isMinimal ? styles.minimalPageScroll : '',
                isSplitView && !isMinimal ? styles.splitPageScroll : '',
                !isMinimal && (pathname.startsWith('/reportes') || pathname === '/analistas') ? styles.reportPageScroll : '',
              ].filter(Boolean).join(' ')}
              data-app-scroll
              key={pathname}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, x: -15, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
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
                <ZoomWrapper zoom={currentZoom}>
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
    <GestionDiariaProvider>
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
    </GestionDiariaProvider>
    </RegistrosProvider>
    </ErrorProvider>
  );
}
