'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CONFIG } from '@/types';
import { Bell, Send, User, Users, Trash2, Clock, AlertCircle, Play } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { formatDateTime } from '@/lib/utils';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';

export default function AvisosTab() {
  const { user } = useAuth();
  const { pushRecordatorioChange, forceShowPopup } = useRecordatorios();
  const { showSuccess, showError } = useToast();
  const [mensaje, setMensaje] = useState('');
  const [target, setTarget] = useState<'todos' | string>('todos');
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  const [recordatorios, setRecordatorios] = useState<any[]>([]);
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
    
    if (!error && data) setHistorial(data);
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
    
    if (!error && data) setRecordatorios(data);
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
      const analistas = target === 'todos' ? CONFIG.ANALISTAS_DEFAULT : [target];
      
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

      const { error } = await supabase.from('recordatorios').insert(records);
      
      if (error) throw error;

      showSuccess('Aviso enviado correctamente');
      setMensaje('');
      fetchHistorial();
      
      // Enviar broadcast para notificación inmediata
      pushRecordatorioChange('INSERT', records[0]);
      forceShowPopup(records[0]);

    } catch (err: any) {
      showError(`Error: ${err.message}`);
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

  const ejecutarRecordatorio = async (rec: any) => {
    try {
      // Simplemente enviamos el aviso para que se muestre en pantalla (sin modificar la fecha real de la BD)
      forceShowPopup(rec);
      showSuccess(`Recordatorio de ${rec.nombre} enviado a la pantalla de ${rec.analista}`);

      fetchRecordatoriosPendientes();
    } catch (err: any) {
      showError(`Error al ejecutar: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* SECCIÓN 1: MENSAJES DIRECTOS */}
      <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="data-card-header" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>1. Enviar Mensaje Pop-up (Directo)</h3>
          <p style={{ fontSize: '13px', color: 'var(--gris)' }}>Envía un mensaje rápido que aparecerá como popup al usuario.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>Destinatario</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setTarget('todos')}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: target === 'todos' ? '#fff' : 'transparent',
                  color: target === 'todos' ? '#000' : 'var(--gris)',
                  borderColor: target === 'todos' ? '#fff' : 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Users size={14} /> Todos
              </button>
              {CONFIG.ANALISTAS_DEFAULT.map(a => (
                <button 
                  key={a}
                  onClick={() => setTarget(a)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                    background: target === a ? '#fff' : 'transparent',
                    color: target === a ? '#000' : 'var(--gris)',
                    borderColor: target === a ? '#fff' : 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <User size={14} /> {a}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>Mensaje</label>
            <textarea 
              className="form-input"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe el mensaje aquí..."
              style={{ minHeight: '80px', background: 'rgba(255,255,255,0.02)', resize: 'vertical' }}
            />
          </div>

          <button 
            className="btn-primary" 
            onClick={handleSend} 
            disabled={loading || !mensaje.trim()}
            style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
          >
            {loading ? 'Enviando...' : <><Send size={16} /> Enviar Aviso</>}
          </button>
        </div>
      </div>

      {/* SECCIÓN 2: EJECUTAR RECORDATORIOS EXISTENTES */}
      <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="data-card-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>2. Ejecutar Recordatorios de Clientes</h3>
            <p style={{ fontSize: '13px', color: 'var(--gris)' }}>Lanza manualmente los recordatorios agendados para que salten en la pantalla del analista.</p>
          </div>
          <button onClick={fetchRecordatoriosPendientes} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
             Actualizar Lista
          </button>
        </div>

        {fetchingRecs ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 10px' }} /> Cargando recordatorios...</div>
        ) : recordatorios.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#444', background: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>
            No hay recordatorios pendientes de clientes.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '12px' }}>
            {recordatorios.map(rec => (
              <div key={rec.id} style={{ 
                padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>{rec.nombre}</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>CUIL: {rec.cuil} | Analista: <span style={{ color: 'var(--azul)', fontWeight: 700 }}>{rec.analista}</span></div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#444', textAlign: 'right' }}>
                    Agendado para:<br />
                    <span style={{ color: '#888' }}>{formatDateTime(rec.fecha_hora)}</span>
                  </div>
                </div>
                
                {rec.nota && (
                  <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                    "{rec.nota}"
                  </p>
                )}

                <button 
                  onClick={() => ejecutarRecordatorio(rec)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--azul)',
                    background: 'rgba(59,130,246,0.1)', color: 'var(--azul)', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--azul)'; e.currentTarget.style.color = '#000'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = 'var(--azul)'; }}
                >
                  <Play size={14} fill="currentColor" /> EJECUTAR POP-UP AHORA
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIAL DE MENSAJES DIRECTOS */}
      <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} /> Últimos Mensajes Directos Enviados
        </h4>
        
        {fetching ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#444' }}>Cargando...</div>
        ) : historial.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '13px' }}>Sin mensajes recientes.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {historial.map(h => (
              <div key={h.id} style={{ 
                padding: '12px 16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--azul)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      {h.analista}
                    </span>
                    <span style={{ fontSize: '11px', color: '#555' }}>{new Date(h.creado_en).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#ccc' }}>{h.nota}</p>
                </div>
                <button 
                  onClick={() => deleteAviso(h.id)}
                  style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '8px' }}
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
