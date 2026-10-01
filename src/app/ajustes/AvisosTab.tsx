'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { Send, User, Users, Trash2, Clock, Play } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { formatDateTime } from '@/lib/utils';
import { useRecordatorios, type ReminderAlertData } from '@/features/recordatorios/RecordatoriosProvider';
import styles from './AvisosTab.module.css';

/** Minimal shape returned by `select('*')` from the `recordatorios` table. */
interface RecordatorioRow {
  id: string;
  cuil: string;
  nombre: string;
  nota?: string;
  analista: string;
  fecha_hora: string;
  creado_en?: string;
}

export default function AvisosTab() {
  const { user } = useAuth();
  const { nombres: analistasDefault } = useAnalistas();
  const { pushRecordatorioChange, forceShowPopup } = useRecordatorios();
  const { showSuccess, showError } = useToast();
  const [mensaje, setMensaje] = useState('');
  const [target, setTarget] = useState<'todos' | string>('todos');
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState<RecordatorioRow[]>([]);
  const [recordatorios, setRecordatorios] = useState<RecordatorioRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchingRecs, setFetchingRecs] = useState(true);

  const fetchHistorial = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('recordatorios')
      .select('*')
      .eq('cuil', 'ADMIN_AVISO')
      .order('creado_en', { ascending: false })
      .limit(5);
    
    if (!error && data) setHistorial(data as RecordatorioRow[]);
    setFetching(false);
  };

  const fetchRecordatoriosPendientes = async () => {
    setFetchingRecs(true);
    const { data, error } = await supabase
      .from('recordatorios')
      .select('*')
      .eq('mostrado', false)
      .neq('cuil', 'ADMIN_AVISO')
      .order('fecha_hora', { ascending: true });
    
    if (!error && data) setRecordatorios(data as RecordatorioRow[]);
    setFetchingRecs(false);
  };

  useEffect(() => {
    fetchHistorial();
    fetchRecordatoriosPendientes();
  }, []);

  const handleSend = async () => {
    if (!mensaje.trim()) {
      showError('Escribe un mensaje');
      return;
    }

    setLoading(true);
    try {
      const analistas = target === 'todos' ? analistasDefault : [target];
      
      const pastTime = new Date(Date.now() - 120000).toISOString(); // 2 min en el pasado
      const records = analistas.map(a => ({
        cuil: 'ADMIN_AVISO',
        nombre: 'MENSAJE DEL ADMINISTRADOR',
        nota: mensaje,
        analista: a,
        fecha_hora: pastTime,
        creado_por: user?.username || 'admin',
        mostrado: false,
      }));

      const { error, data: inserted } = await supabase.from('recordatorios').insert(records).select();
      
      if (error) throw error;

      showSuccess('Aviso enviado correctamente');
      setMensaje('');
      fetchHistorial();
      
      // Enviar broadcast para notificación inmediata (inserted has id from DB)
      if (inserted && inserted[0]) {
        const rec: ReminderAlertData = {
          id: inserted[0].id as string,
          nombre: inserted[0].nombre as string,
          cuil: inserted[0].cuil as string,
          nota: inserted[0].nota as string,
          fecha_hora: inserted[0].fecha_hora as string,
          analista: inserted[0].analista as string,
        };
        pushRecordatorioChange('INSERT', rec);
        forceShowPopup(rec);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      showError(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteAviso = async (id: string) => {
    if (!confirm('¿Eliminar este aviso?')) return;
    const { error } = await supabase.from('recordatorios').delete().eq('id', id);
    if (!error) {
      showSuccess('Aviso eliminado');
      fetchHistorial();
    } else {
      showError('Error al eliminar');
    }
  };

  const ejecutarRecordatorio = async (rec: RecordatorioRow) => {
    try {
      // Simplemente enviamos el aviso para que se muestre en pantalla (sin modificar la fecha real de la BD)
      forceShowPopup({
        id: rec.id,
        nombre: rec.nombre,
        cuil: rec.cuil,
        nota: rec.nota,
        fecha_hora: rec.fecha_hora,
        analista: rec.analista,
      });
      showSuccess(`Recordatorio de ${rec.nombre} enviado a la pantalla de ${rec.analista}`);

      fetchRecordatoriosPendientes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      showError(`Error al ejecutar: ${message}`);
    }
  };

  return (
    <div className={styles.root}>
      
      {/* SECCIÓN 1: MENSAJES DIRECTOS */}
      <div className={`data-card ${styles.card}`}>
        <div className={`data-card-header ${styles.cardHeader}`}>
          <h3 className={styles.title}>1. Enviar Mensaje Pop-up (Directo)</h3>
          <p className={styles.subtitle}>Envía un mensaje rápido que aparecerá como popup al usuario.</p>
        </div>

        <div className={styles.formStack}>
          <div className="form-group">
            <label className={`form-label ${styles.label}`}>Destinatario</label>
            <div className={styles.targetList}>
              {[
                { value: 'todos' as const, label: 'Todos', Icon: Users },
                ...analistasDefault.map(a => ({ value: a, label: a, Icon: User })),
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTarget(value)}
                  className={`${styles.targetButton}${target === value ? ` ${styles.isActive}` : ''}`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className={`form-label ${styles.label}`}>Mensaje</label>
            <textarea 
              className={`form-input ${styles.messageInput}`}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe el mensaje aquí..."
            />
          </div>

          <button 
            className={`btn-primary ${styles.sendButton}`}
            onClick={handleSend} 
            disabled={loading || !mensaje.trim()}
          >
            {loading ? 'Enviando...' : <><Send size={16} /> Enviar Aviso</>}
          </button>
        </div>
      </div>

      {/* SECCIÓN 2: EJECUTAR RECORDATORIOS EXISTENTES */}
      <div className={`data-card ${styles.card}`}>
        <div className={`data-card-header ${styles.cardHeaderSplit}`}>
          <div>
            <h3 className={styles.title}>2. Ejecutar Recordatorios de Clientes</h3>
            <p className={styles.subtitle}>Lanza manualmente los recordatorios agendados para que salten en la pantalla del analista.</p>
          </div>
          <button onClick={fetchRecordatoriosPendientes} className={`btn-secondary ${styles.refreshButton}`}>
             Actualizar Lista
          </button>
        </div>

        {fetchingRecs ? (
          <div className={styles.loading}><div className={`spinner ${styles.centeredSpinner}`} /> Cargando recordatorios...</div>
        ) : recordatorios.length === 0 ? (
          <div className={styles.emptyState}>
            No hay recordatorios pendientes de clientes.
          </div>
        ) : (
          <div className={styles.reminderGrid}>
            {recordatorios.map(rec => (
              <div key={rec.id} className={styles.reminderCard}>
                <div className={styles.reminderHeader}>
                  <div>
                    <div className={styles.reminderName}>{rec.nombre}</div>
                    <div className={styles.reminderMeta}>CUIL: {rec.cuil} | Analista: <span>{rec.analista}</span></div>
                  </div>
                  <div className={styles.scheduledAt}>
                    Agendado para:<br />
                    <span>{formatDateTime(rec.fecha_hora)}</span>
                  </div>
                </div>
                
                {rec.nota && (
                  <p className={styles.reminderNote}>
                    &ldquo;{rec.nota}&rdquo;
                  </p>
                )}

                <button 
                  onClick={() => ejecutarRecordatorio(rec)}
                  className={styles.runButton}
                >
                  <Play size={14} fill="currentColor" /> EJECUTAR POP-UP AHORA
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIAL DE MENSAJES DIRECTOS */}
      <div className={`data-card ${styles.card}`}>
        <h4 className={styles.historyTitle}>
          <Clock size={16} /> Últimos Mensajes Directos Enviados
        </h4>
        
        {fetching ? (
          <div className={styles.compactEmpty}>Cargando...</div>
        ) : historial.length === 0 ? (
          <div className={styles.compactEmpty}>Sin mensajes recientes.</div>
        ) : (
          <div className={styles.historyList}>
            {historial.map(h => (
              <div key={h.id} className={styles.historyItem}>
                <div className={styles.historyContent}>
                  <div className={styles.historyMeta}>
                    <span className={styles.analystBadge}>
                      {h.analista}
                    </span>
                    <span className={styles.historyDate}>{new Date(h.creado_en || '').toLocaleString()}</span>
                  </div>
                  <p className={styles.historyNote}>{h.nota}</p>
                </div>
                <button 
                  onClick={() => deleteAviso(h.id)}
                  className={styles.deleteButton}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
