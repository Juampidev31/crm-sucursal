'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, FileSpreadsheet, LogOut, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFilter } from '@/context/FilterContext';
import { useSettings } from '@/features/settings/SettingsProvider';
import { ExportXlsxModal } from '@/components/ExportXlsxModal';
import ModalPortal from '@/components/ModalPortal';
import CalculadoraContent from '@/components/CalculadoraContent';
import styles from './AccountActions.module.css';

/**
 * Acciones auxiliares del sidebar: exportar XLSX, calculadora de incentivos
 * (admin) y salir del modo administrador.
 *
 * Vivían dentro del `Sidebar` grande. Al pasar las rutas internas a
 * `RecordsSidebar`, ese componente dejó de montarse y quedaron inalcanzables
 * desde toda la aplicación. Se agrupan acá para que `RecordsSidebar` siga
 * siendo navegación y no vuelva a crecer como monolito.
 *
 * El zoom se maneja sólo por teclado (Ctrl +/−/0, en `AppShell`): los botones
 * se retiraron del rail por pedido explícito.
 *
 * Reutiliza las clases existentes (`records-nav-item`): no introduce estilos.
 */
export default function AccountActions() {
  const { isAdmin, realIsAdmin, simulatedAnalista, user, logout } = useAuth();
  const router = useRouter();
  const { filters } = useFilter();
  const { hasPermiso } = useSettings();
  const [showXlsxModal, setShowXlsxModal] = useState(false);
  const [showCalculadora, setShowCalculadora] = useState(false);

  // Mismo criterio de permiso que aplicaba el Sidebar original.
  const currentAnalista =
    simulatedAnalista ||
    user?.username ||
    (filters?.analista && filters.analista !== 'todos' ? filters.analista : null);
  // Mientras la configuración remota todavía no llegó, el permiso debe ser
  // cerrado para evitar mostrar y retirar la acción durante la hidratación.
  const canExport = isAdmin || hasPermiso('exportar_excel', currentAnalista, false);

  // El `Sidebar` legacy abría el login en un modal propio; al retirarlo no quedó
  // ninguna forma de volver a entrar desde la interfaz. En lugar de un botón
  // visible para todos, el acceso queda detrás de un atajo: Ctrl + Shift + L.
  useEffect(() => {
    if (realIsAdmin) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        router.push('/login');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [realIsAdmin, router]);

  return (
    <>
      {canExport && (
        <button
          type="button"
          className="records-nav-item"
          onClick={() => setShowXlsxModal(true)}
          title="Descargar XLSX"
        >
          <span className="records-nav-icon"><FileSpreadsheet size={23} strokeWidth={1.8} /></span>
          <span>Exportar</span>
        </button>
      )}

      {isAdmin && (
        <button
          type="button"
          className={`records-nav-item${showCalculadora ? ' is-active' : ''}`}
          onClick={() => setShowCalculadora(true)}
          title="Simulador de sueldo e incentivos"
        >
          <span className="records-nav-icon"><Calculator size={23} strokeWidth={1.8} /></span>
          <span>Calculadora</span>
        </button>
      )}

      {realIsAdmin && (
        <button
          type="button"
          className="records-nav-item"
          onClick={logout}
          title="Salir del modo administrador"
        >
          <span className="records-nav-icon"><LogOut size={23} strokeWidth={1.8} /></span>
          <span>Salir</span>
        </button>
      )}

      <ExportXlsxModal open={showXlsxModal} onClose={() => setShowXlsxModal(false)} />

      {showCalculadora && isAdmin && (
        <ModalPortal>
          <div className={styles.overlay} onClick={() => setShowCalculadora(false)}>
            <div className={styles.calculatorPanel} onClick={e => e.stopPropagation()}>
              <div className={styles.calculatorHeader}>
                <div className={styles.calculatorHeading}>
                  <span className={styles.calculatorHeadingIcon}><Calculator size={18} /></span>
                  <div><span className={styles.calculatorTitle}>Calculadora de incentivos</span><small>Proyección de sueldo y comisiones</small></div>
                </div>
                <button type="button" onClick={() => setShowCalculadora(false)} aria-label="Cerrar" className={styles.calculatorClose}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.calculatorBody}>
                <CalculadoraContent />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
