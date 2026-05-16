'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { logAudit } from '@/lib/audit';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { Trash2, AlertTriangle, Calendar, Search, ShieldAlert, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

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
        .or(`and(fecha.gte.${fechaDesde},fecha.lte.${fechaHasta}),and(fecha.is.null,created_at.gte.${fechaDesde},created_at.lte.${fechaHasta}T23:59:59)`);

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
        .or(`and(fecha.gte.${fechaDesde},fecha.lte.${fechaHasta}),and(fecha.is.null,created_at.gte.${fechaDesde},created_at.lte.${fechaHasta}T23:59:59)`);

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
    <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,22,22,0.1)' }}>
      <div className="data-card-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '10px' }}>
            <ShieldAlert size={24} color="#ff4444" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Eliminación Masiva por Fecha</h3>
            <p style={{ fontSize: '13px', color: '#ff4444', fontWeight: 600, marginTop: '4px' }}>Zona Restringida: Solo Administrador Maestro</p>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '24px', 
        padding: '24px', 
        background: 'rgba(255,255,255,0.02)', 
        borderRadius: '12px', 
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '32px'
      }}>
        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>Desde Fecha</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '14px', color: '#555' }} />
            <input 
              type="date" 
              className="form-input" 
              style={{ paddingLeft: '38px' }} 
              value={fechaDesde}
              onChange={e => {
                setFechaDesde(e.target.value);
                setCount(null);
              }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>Hasta Fecha</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '14px', color: '#555' }} />
            <input 
              type="date" 
              className="form-input" 
              style={{ paddingLeft: '38px' }} 
              value={fechaHasta}
              onChange={e => {
                setFechaHasta(e.target.value);
                setCount(null);
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button 
            className="btn-secondary" 
            style={{ width: '100%', height: '42px', justifyContent: 'center' }}
            onClick={checkCount}
            disabled={loading || deleting}
          >
            {loading ? 'Consultando...' : <><Search size={16} /> Previsualizar</>}
          </button>
        </div>
      </div>

      {count !== null && (
        <div style={{ 
          animation: 'fadeIn 0.3s ease',
          padding: '24px', 
          background: count > 0 ? 'rgba(255,68,68,0.05)' : 'rgba(74,222,128,0.05)', 
          borderRadius: '12px', 
          border: '1px solid',
          borderColor: count > 0 ? 'rgba(255,68,68,0.2)' : 'rgba(74,222,128,0.2)',
          textAlign: 'center'
        }}>
          {count > 0 ? (
            <>
              <div style={{ color: '#ff4444', fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>
                <AlertTriangle size={24} style={{ marginBottom: '8px' }} /><br />
                Se encontraron {count} registros para eliminar
              </div>
              <p style={{ color: 'var(--gris)', fontSize: '13px', marginBottom: '20px' }}>
                Esta acción eliminará todos los registros entre el {formatDate(fechaDesde)} y el {formatDate(fechaHasta)}.
              </p>
              <button 
                className="btn-primary" 
                style={{ 
                  background: '#ff4444', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '12px 32px',
                  fontSize: '14px',
                  fontWeight: 800
                }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : <><Trash2 size={16} /> ELIMINAR AHORA</>}
              </button>
            </>
          ) : (
            <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 700 }}>
              <CheckCircle size={24} style={{ marginBottom: '8px' }} /><br />
              No se encontraron registros en este rango de fechas.
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '12px', color: '#555' }}>
        <strong>Nota de seguridad:</strong> Cada eliminación masiva queda registrada en el log de auditoría con tu nombre de usuario, la fecha del rango y la cantidad de registros afectados.
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
