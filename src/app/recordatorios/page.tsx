'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, getStatusLabel } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { Recordatorio } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import {
  Bell, Check, Trash2, AlertCircle, Clock, User, Filter, RefreshCw, Calendar,
} from 'lucide-react';
import { ANALISTAS } from '@/context/FilterContext';
import { useToast } from '@/hooks/useToast';

type TabType = 'pendientes' | 'completados';

export default function RecordatoriosPage() {
  const { user } = useAuth();
  const { adjustPendingReminders, pushRecordatorioChange } = useData();
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('pendientes');
  const { toast, showToast } = useToast();

  const fetchRecordatorios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recordatorios')
      .select('*')
      .order('fecha_hora', { ascending: true });
    if (!error && data) setRecordatorios(data);
    setLoading(false);
  }, []);

  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    fetchRecordatorios();

    // Usar BroadcastChannel para actualizaciones inmediatas
    const bc = supabase
      .channel('recordatorios-broadcast-client', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'recordatorio_change' }, async ({ payload }) => {
        const { type } = payload as { type: string };
        // Refetch para obtener los datos actualizados
        await fetchRecordatorios();
      })
      .subscribe();
    broadcastChannelRef.current = bc;

    return () => { supabase.removeChannel(bc); };
  }, [fetchRecordatorios]);

  const handleMarcarCompletado = async (id: string) => {
    const rec = recordatorios.find(r => r.id === id);
    setRecordatorios(prev => prev.map(r => r.id === id ? { ...r, mostrado: true } : r));
    adjustPendingReminders(-1);
    showToast('Marcado como completado', 'success');
    const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('id', id);
    if (error) {
      setRecordatorios(prev => prev.map(r => r.id === id ? { ...r, mostrado: false } : r));
      adjustPendingReminders(1);
      showToast('Error al actualizar', 'error');
    } else {
      if (rec) pushRecordatorioChange('UPDATE', { ...rec, mostrado: true });
      logAudit({ id_registro: rec?.registro_id, nombre: rec?.nombre, cuil: rec?.cuil, analista: rec?.analista, accion: 'Recordatorio completado', campo_modificado: 'Recordatorio', valor_nuevo: `${rec?.nombre} | ${rec?.fecha_hora}` });
    }
  };

  const handleEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar recordatorio de ${nombre}?`)) return;
    const backup = recordatorios.find(r => r.id === id);
    const wasPending = backup && !backup.mostrado;
    setRecordatorios(prev => prev.filter(r => r.id !== id));
    if (wasPending) adjustPendingReminders(-1);
    showToast('Eliminado', 'success');
    const { error } = await supabase.from('recordatorios').delete().eq('id', id);
    if (error && backup) {
      setRecordatorios(prev => [...prev, backup].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora)));
      if (wasPending) adjustPendingReminders(1);
      showToast('Error al eliminar', 'error');
    } else {
      if (backup) pushRecordatorioChange('DELETE', backup);
      logAudit({ id_registro: backup?.registro_id, nombre: backup?.nombre, cuil: backup?.cuil, analista: backup?.analista, accion: 'Eliminación', campo_modificado: 'Recordatorio', valor_anterior: `${backup?.nombre} | ${backup?.fecha_hora}` });
    }
  };

  const ahora = new Date();

  const filtrados = recordatorios.filter(r => {
    return tab === 'pendientes' ? !r.mostrado : r.mostrado;
  });

  const pendientesCount = recordatorios.filter(r => !r.mostrado).length;
  const vencidosCount = recordatorios.filter(r => !r.mostrado && new Date(r.fecha_hora) < ahora).length;

  const isVencido = (fechaHora: string) => new Date(fechaHora) < ahora;
  const isHoy = (fechaHora: string) => {
    const d = new Date(fechaHora);
    return d.getDate() === ahora.getDate() &&
      d.getMonth() === ahora.getMonth() &&
      d.getFullYear() === ahora.getFullYear();
  };

  const getUrgencyColor = (fechaHora: string, mostrado: boolean) => {
    if (mostrado) return 'rgba(255,255,255,0.01)';
    return 'rgba(255,255,255,0.02)';
  };

  const getUrgencyBorder = (fechaHora: string, mostrado: boolean) => {
    if (mostrado) return 'rgba(255,255,255,0.06)';
    if (isVencido(fechaHora)) return 'rgba(220,53,69,0.25)';
    if (isHoy(fechaHora)) return 'rgba(255,193,7,0.25)';
    return 'rgba(255,255,255,0.06)';
  };

  const canDelete = user?.rol === 'admin';

  return (
    <div className="dashboard-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '14px' }}>{toast.message}</span>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Recordatorios</h1>
        </div>
        <button
          className="btn-secondary"
          onClick={fetchRecordatorios}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={15} /> Actualizar
        </button>
      </header>

      {/* Stats rápidas */}
      <div className="cards-container" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div className="kpi-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div className="kpi-title" style={{ color: '#444' }}><Bell size={13} /> Total</div>
          <div className="kpi-val" style={{ fontSize: '24px', fontWeight: 900 }}>{recordatorios.length}</div>
        </div>
        <div className="kpi-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div className="kpi-title" style={{ color: '#444' }}><Clock size={13} /> Pendientes</div>
          <div className="kpi-val" style={{ fontSize: '24px', fontWeight: 900, color: '#fff' }}>{pendientesCount}</div>
        </div>
        <div className="kpi-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="kpi-title" style={{ color: '#444' }}><AlertCircle size={13} /> Vencidos</div>
          <div className="kpi-val" style={{ fontSize: '24px', fontWeight: 900, color: '#f87171' }}>{vencidosCount}</div>
        </div>
        <div className="kpi-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div className="kpi-title" style={{ color: '#444' }}><Check size={13} /> Completados</div>
          <div className="kpi-val" style={{ fontSize: '24px', fontWeight: 900, color: 'rgba(255,255,255,0.4)' }}>
            {recordatorios.filter(r => r.mostrado).length}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ justifyContent: 'flex-start' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px' }}>
          {(['pendientes', 'completados'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none',
                fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t ? '#fff' : '#555',
                textTransform: 'capitalize',
              }}
            >
              {t === 'pendientes'
                ? `Pendientes${pendientesCount > 0 ? ` (${pendientesCount})` : ''}`
                : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="data-card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span>Cargando recordatorios...</span>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <Bell size={32} style={{ color: '#222', marginBottom: '12px' }} />
            <p style={{ fontWeight: 600 }}>
              {tab === 'pendientes' ? 'Sin recordatorios pendientes' : 'Sin recordatorios completados'}
            </p>
            <p style={{ fontSize: '13px' }}>
              {tab === 'pendientes'
                ? 'Agendá recordatorios desde la sección Gestión de Clientes.'
                : 'Los recordatorios marcados como completados aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px' }}>
            {filtrados.map(rec => (
              <div
                key={rec.id}
                style={{
                  background: getUrgencyColor(rec.fecha_hora, rec.mostrado),
                  border: `1px solid ${getUrgencyBorder(rec.fecha_hora, rec.mostrado)}`,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  transition: 'all 0.2s',
                }}
              >
                {/* Icono de estado */}
                <div style={{
                  width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: rec.mostrado
                    ? 'rgba(76,175,80,0.1)'
                    : isVencido(rec.fecha_hora)
                      ? 'rgba(220,53,69,0.1)'
                      : isHoy(rec.fecha_hora)
                        ? 'rgba(255,193,7,0.1)'
                        : 'rgba(23,162,184,0.1)',
                }}>
                  {rec.mostrado
                    ? <Check size={16} style={{ color: 'var(--verde)' }} />
                    : isVencido(rec.fecha_hora)
                      ? <AlertCircle size={16} style={{ color: 'var(--rojo)' }} />
                      : <Bell size={16} style={{ color: 'var(--azul)' }} />
                  }
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: rec.mostrado ? '#555' : '#fff' }}>
                      {rec.nombre}
                    </span>
                    <span style={{ fontSize: '11px', color: '#444' }}>CUIL: {rec.cuil}</span>
                    {rec.estado && (
                      <span
                        className="status-badge"
                        style={{ color: '#aaa', fontSize: '11px' }}
                      >
                        {getStatusLabel(rec.estado)}
                      </span>
                    )}
                    {!rec.mostrado && isVencido(rec.fecha_hora) && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--rojo)',
                        background: 'rgba(220,53,69,0.1)', padding: '2px 8px',
                        borderRadius: '6px', border: '1px solid rgba(220,53,69,0.2)',
                      }}>
                        VENCIDO
                      </span>
                    )}
                    {!rec.mostrado && isHoy(rec.fecha_hora) && !isVencido(rec.fecha_hora) && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--naranja)',
                        background: 'rgba(255,193,7,0.1)', padding: '2px 8px',
                        borderRadius: '6px', border: '1px solid rgba(255,193,7,0.2)',
                      }}>
                        HOY
                      </span>
                    )}
                  </div>

                  {rec.nota && (
                    <p style={{ fontSize: '13px', color: '#666', margin: '4px 0', lineHeight: '1.5' }}>
                      {rec.nota}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#444' }}>
                      <Calendar size={12} />
                      <span style={{ color: !rec.mostrado && isVencido(rec.fecha_hora) ? 'var(--rojo)' : '#555' }}>
                        {formatDateTime(rec.fecha_hora)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#444' }}>
                      <User size={12} />
                      <span style={{ color: '#555' }}>{rec.analista}</span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {!rec.mostrado && (
                    <button
                      className="btn-icon"
                      onClick={() => handleMarcarCompletado(rec.id)}
                      title="Marcar como completado"
                      style={{ color: 'var(--verde)' }}
                    >
                      <Check size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleEliminar(rec.id, rec.nombre)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
