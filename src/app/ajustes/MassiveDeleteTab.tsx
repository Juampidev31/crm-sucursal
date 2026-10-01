'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { logAudit } from '@/lib/audit';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { Trash2, AlertTriangle, Calendar, Search, ShieldAlert, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import styles from './MassiveDeleteTab.module.css';

// Única fuente de verdad para el rango: preview y delete deben apuntar siempre a las mismas filas
const buildRangeFilter = (desde: string, hasta: string) =>
  `and(fecha.gte.${desde},fecha.lte.${hasta}),and(fecha.is.null,created_at.gte.${desde},created_at.lte.${hasta}T23:59:59)`;

const DateField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="form-group">
    <label className={`form-label ${styles.dateLabel}`}>{label}</label>
    <div className={styles.dateField}>
      <Calendar size={14} className={styles.dateIcon} />
      <input type="date" className={`form-input ${styles.dateInput}`} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  </div>
);

export default function MassiveDeleteTab() {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showSuccess, showError } = useToast(3000);
  const { refresh, pushBulkRefresh } = useRegistros();

  const checkCount = async () => {
    if (!fechaDesde || !fechaHasta) {
      showError('Por favor selecciona ambas fechas');
      return;
    }

    setLoading(true);
    try {
      const { count: c, error } = await supabase
        .from('registros')
        .select('*', { count: 'exact', head: true })
        .or(buildRangeFilter(fechaDesde, fechaHasta));

      if (error) throw error;
      setCount(c);
    } catch (err: any) {
      showError(`Error al consultar: ${err.message}`);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (count === null || count === 0) return;
    
    if (!confirm(`¿ESTÁS SEGURO? Se eliminarán ${count} registros de forma PERMANENTE entre ${formatDate(fechaDesde)} y ${formatDate(fechaHasta)}.`)) {
      return;
    }

    const confirm2 = prompt(`Para confirmar la eliminación de ${count} registros, escribe "ELIMINAR ${count}":`);
    if (confirm2 !== `ELIMINAR ${count}`) {
      showError('Confirmación incorrecta');
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('registros')
        .delete()
        .or(buildRangeFilter(fechaDesde, fechaHasta));

      if (error) throw error;

      logAudit({
        accion: 'ELIMINACION_MASIVA_FECHA',
        campo_modificado: 'registros',
        valor_anterior: `Rango: ${fechaDesde} a ${fechaHasta}`,
        valor_nuevo: `Eliminados: ${count} registros`,
      });

      await refresh(true);
      pushBulkRefresh();

      showSuccess(`Se eliminaron ${count} registros exitosamente`);
      setCount(null);
      setFechaDesde('');
      setFechaHasta('');
    } catch (err: any) {
      showError(`Error al eliminar: ${err.message}`);
    }
    setDeleting(false);
  };

  return (
    <div className={`data-card ${styles.root}`}>
      <div className={`data-card-header ${styles.header}`}>
        <div className={styles.headerRow}>
          <div className={styles.headerIcon}>
            <ShieldAlert size={24} color="#ff4444" />
          </div>
          <div>
            <h3 className={styles.title}>Eliminación Masiva por Fecha</h3>
            <p className={styles.subtitle}>Zona Restringida: Solo Administrador Maestro</p>
          </div>
        </div>
      </div>

      <div className={styles.filterGrid}>
        <DateField label="Desde Fecha" value={fechaDesde} onChange={v => { setFechaDesde(v); setCount(null); }} />

        <DateField label="Hasta Fecha" value={fechaHasta} onChange={v => { setFechaHasta(v); setCount(null); }} />

        <div className={styles.previewAction}>
          <button
            className={`btn-secondary ${styles.previewButton}`}
            onClick={checkCount}
            disabled={loading || deleting}
          >
            {loading ? 'Consultando...' : <><Search size={16} /> Previsualizar</>}
          </button>
        </div>
      </div>

      {count !== null && (
        <div className={`${styles.result} ${count > 0 ? styles.hasRecords : styles.isEmpty}`}>
          {count > 0 ? (
            <>
              <div className={styles.resultDanger}>
                <AlertTriangle size={24} className={styles.resultIcon} /><br />
                Se encontraron {count} registros para eliminar
              </div>
              <p className={styles.resultDescription}>
                Esta acción eliminará todos los registros entre el {formatDate(fechaDesde)} y el {formatDate(fechaHasta)}.
              </p>
              <button 
                className={`btn-primary ${styles.deleteButton}`}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : <><Trash2 size={16} /> ELIMINAR AHORA</>}
              </button>
            </>
          ) : (
            <div className={styles.resultEmpty}>
              <CheckCircle size={24} className={styles.resultIcon} /><br />
              No se encontraron registros en este rango de fechas.
            </div>
          )}
        </div>
      )}

      <div className={styles.securityNote}>
        <strong>Nota de seguridad:</strong> Cada eliminación masiva queda registrada en el log de auditoría con tu nombre de usuario, la fecha del rango y la cantidad de registros afectados.
      </div>
    </div>
  );
}
