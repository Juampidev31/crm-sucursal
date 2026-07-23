'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { Registro, BitacoraNota, Recordatorio } from '@/types';
import ModalPortal from '@/components/ModalPortal';
import { EtiquetasSelector } from '@/components/EtiquetasSelector';
import { logAudit } from '@/lib/audit';
import { X, Trash2, Loader2, AlertCircle, Calendar, MessageSquare, Clock, User, CheckCircle2, Tag } from 'lucide-react';

interface BitacoraModalProps {
  isOpen: boolean;
  onClose: () => void;
  registro: Registro | null;
  onSavedEtiquetas?: (registroId: string, nuevasEtiquetas: string[]) => void;
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export default function BitacoraModal({ isOpen, onClose, registro, onSavedEtiquetas }: BitacoraModalProps) {
  const { user } = useAuth();
  const { pushRecordatorioChange } = useRecordatorios();

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('09:00');
  const [nota, setNota] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [notas, setNotas] = useState<BitacoraNota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);

  // ── Fetch historial ───────────────────────────────────────────────────────
  const fetchNotas = useCallback(async () => {
    if (!registro?.id) return;
    setLoadingNotas(true);
    try {
      const { data, error } = await supabase
        .from('bitacora_notas')
        .select('*')
        .or(`registro_id.eq.${registro.id}${registro.cuil ? `,cuil.eq.${registro.cuil}` : ''}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[BitacoraModal] fetchNotas error:', error.message);
      } else if (data) {
        setNotas(data as BitacoraNota[]);
      }
    } finally {
      setLoadingNotas(false);
    }
  }, [registro]);

  useEffect(() => {
    if (isOpen && registro) {
      fetchNotas();
      setFecha('');
      setHora('09:00');
      setNota('');
      setEtiquetas(registro.etiquetas || []);
      setSaveError('');
      setSaveSuccess(false);
    } else {
      setNotas([]);
      setNota('');
      setFecha('');
      setEtiquetas([]);
      setSaveError('');
      setSaveSuccess(false);
    }
  }, [isOpen, registro, fetchNotas]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!registro) return;
    
    const etiquetasChanged = JSON.stringify(etiquetas) !== JSON.stringify(registro.etiquetas || []);
    if (!nota.trim() && !fecha && !etiquetasChanged) return;

    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    let okNota = false;
    let okRec = false;
    let okEtiq = false;

    // 1) Guardar etiquetas en registro (si cambiaron)
    if (etiquetasChanged) {
      const { error: etiqErr } = await supabase
        .from('registros')
        .update({ etiquetas })
        .eq('id', registro.id);

      if (etiqErr) {
        setSaveError(`Error guardando etiquetas: ${etiqErr.message}`);
        setSaving(false);
        return;
      }
      if (onSavedEtiquetas) {
        onSavedEtiquetas(registro.id, etiquetas);
      }
      okEtiq = true;
    }

    // 2) Guardar nota en bitácora (si hay texto)
    if (nota.trim()) {
      const payload = {
        registro_id: registro.id,
        cuil: registro.cuil || '',
        analista: user?.username || 'Anónimo',
        nota: nota.trim(),
        created_at: new Date().toISOString(),
      };
      const { data: notaData, error: notaErr } = await supabase
        .from('bitacora_notas')
        .insert(payload)
        .select()
        .single();

      if (notaErr) {
        setSaveError(`Error Supabase: ${notaErr.message}`);
        setSaving(false);
        return;
      }
      if (notaData) {
        setNotas(prev => [notaData as BitacoraNota, ...prev]);
        okNota = true;
      }
    }

    // 3) Guardar recordatorio (si hay fecha)
    if (fecha) {
      const { data: recData, error: recErr } = await supabase
        .from('recordatorios')
        .insert({
          registro_id: registro.id,
          nombre: registro.nombre,
          cuil: registro.cuil,
          analista: registro.analista,
          estado: registro.estado,
          nota: nota.trim() || '',
          fecha_hora: `${fecha}T${hora}:00-03:00`,
          creado_por: user?.username || registro.analista || 'Sistema',
          mostrado: false,
        })
        .select()
        .single();

      if (recErr) {
        setSaveError(`Error al guardar recordatorio: ${recErr.message}`);
      } else if (recData) {
        logAudit({
          id_registro: registro.id,
          nombre: registro.nombre,
          cuil: registro.cuil,
          analista: registro.analista,
          accion: 'Recordatorio creado',
          campo_modificado: 'Recordatorio',
          valor_nuevo: `${registro.nombre} | ${fecha} ${hora}${nota.trim() ? ' | ' + nota.trim() : ''}`,
        });
        pushRecordatorioChange('INSERT', recData as Recordatorio);
        okRec = true;
      }
    }

    if (okNota || okRec || okEtiq) {
      setNota('');
      setFecha('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  };

  // ── Eliminar nota ─────────────────────────────────────────────────────────
  const handleEliminar = async (id: string) => {
    const { error } = await supabase.from('bitacora_notas').delete().eq('id', id);
    if (!error) setNotas(prev => prev.filter(n => n.id !== id));
  };

  if (!isOpen || !registro) return null;

  const etiquetasChanged = JSON.stringify(etiquetas) !== JSON.stringify(registro.etiquetas || []);
  const canSave = nota.trim() !== '' || fecha !== '' || etiquetasChanged;

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          drag
          dragMomentum={false}
          className="modal-content"
          style={{
            maxWidth: 880,
            width: '95%',
            maxHeight: 'calc((100vh - 32px) / 1.12)',
            borderRadius: 16,
            background: 'var(--bg-elev-1, #111)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="modal-header" style={{ padding: '22px 28px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div>
              <h3 className="modal-title" style={{ fontSize: 17, fontWeight: 800, color: '#fff', gap: 8 }}>
                📋 RECORDATORIO &amp; SEGUIMIENTO
              </h3>
              <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 0 0' }}>
                Cliente: <strong style={{ color: '#fff' }}>{registro.nombre}</strong>
                {registro.cuil && <> — CUIL: <span style={{ fontFamily: 'monospace', color: '#fff' }}>{registro.cuil}</span></>}
              </p>
            </div>
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>

          {/* ── Body ── */}
          <div className="modal-body" style={{ padding: 28, overflowY: 'auto' }}>
            
            {/* Banner de error */}
            {saveError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5', fontSize: 13, lineHeight: 1.5,
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{saveError}</span>
              </div>
            )}

            {/* Banner de éxito */}
            {saveSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7', fontSize: 13, fontWeight: 600,
              }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>¡Guardado correctamente!</span>
              </div>
            )}

            {/* Grid 2 columnas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
              alignItems: 'stretch',
            }}>
              
              {/* Columna Izquierda: Etiquetas + Recordatorio + Seguimiento + Guardar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* 1. Etiquetas Box */}
                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: 12,
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.02)',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: 'var(--fg-muted)',
                    letterSpacing: '0.6px', marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Tag size={15} style={{ color: 'var(--green)' }} />
                    ETIQUETAS DEL LEAD
                  </div>

                  <EtiquetasSelector etiquetas={etiquetas} onChange={setEtiquetas} />
                </div>

                {/* 2. Recordatorio Box */}
                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: 12,
                  padding: 18,
                  background: 'rgba(255, 255, 255, 0.02)',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: 'var(--fg-muted)',
                    letterSpacing: '0.6px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Calendar size={15} style={{ color: 'var(--green)' }} />
                    RECORDATORIO
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha</label>
                      <input
                        type="date"
                        value={fecha}
                        onChange={e => setFecha(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hora</label>
                      <input
                        type="time"
                        value={hora}
                        onChange={e => setHora(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Hoy', days: 0 },
                      { label: 'Mañana', days: 1 },
                      { label: 'En 3 días', days: 3 },
                      { label: 'En 1 semana', days: 7 },
                    ].map(({ label, days }) => {
                      const val = addDays(days);
                      const sel = fecha === val;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setFecha(sel ? '' : val)}
                          style={{
                            padding: '8px 12px', fontSize: 12, fontWeight: 600,
                            background: sel ? 'var(--green-bg, rgba(16,185,129,0.18))' : 'rgba(255, 255, 255, 0.04)',
                            color: sel ? 'var(--green, #10b981)' : 'var(--fg-muted)',
                            border: `1px solid ${sel ? 'var(--green, #10b981)' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
                            textAlign: 'center',
                          }}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Seguimiento Box */}
                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: 12,
                  padding: 18,
                  background: 'rgba(255, 255, 255, 0.02)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: 'var(--fg-muted)',
                    letterSpacing: '0.6px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <MessageSquare size={15} style={{ color: 'var(--green)' }} />
                    SEGUIMIENTO
                  </div>

                  <textarea
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Escribe una observación rápida (ej: Pidió presupuesto por $150.000, llamar por la tarde...)"
                    rows={4}
                    className="form-input"
                    style={{
                      width: '100%',
                      minHeight: 100,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      lineHeight: 1.6,
                      flex: 1,
                    }}
                  />
                </div>

                {/* Botón Principal Guardar */}
                <button
                  onClick={handleGuardar}
                  disabled={saving || !canSave}
                  style={{
                    width: '100%', padding: '14px', fontSize: 13, fontWeight: 800,
                    letterSpacing: '0.8px', textTransform: 'uppercase',
                    background: canSave && !saving ? 'var(--green, #10b981)' : 'rgba(255, 255, 255, 0.06)',
                    color: canSave && !saving ? '#000' : 'rgba(255, 255, 255, 0.3)',
                    border: 'none', borderRadius: 8,
                    cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  {saving
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> GUARDANDO...</>
                    : 'GUARDAR CAMBIOS'
                  }
                </button>

              </div>

              {/* Columna Derecha: Historial de Seguimiento */}
              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 12,
                padding: 18,
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 460,
                maxHeight: 620,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: 'var(--fg-muted)',
                  letterSpacing: '0.6px', marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={15} style={{ color: 'var(--green)' }} />
                    HISTORIAL DE SEGUIMIENTO ({notas.length})
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {loadingNotas ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--fg-muted)', fontSize: 13 }}>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 6 }} />
                      Cargando seguimiento...
                    </div>
                  ) : notas.length === 0 ? (
                    <div style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255, 255, 255, 0.25)', fontSize: 13, fontStyle: 'italic',
                      textAlign: 'center', padding: 20,
                    }}>
                      <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
                      No hay seguimientos registrados para este cliente aún.
                    </div>
                  ) : (
                    notas.map(n => {
                      const dateStr = n.created_at
                        ? new Date(n.created_at).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '';
                      const isOwn = user?.username === 'admin' || user?.username === n.analista;
                      return (
                        <div key={n.id} style={{
                          padding: '14px 16px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <User size={13} style={{ color: 'var(--green)' }} />
                              <span style={{ fontWeight: 700, color: '#fff' }}>{n.analista || 'Anónimo'}</span>
                              <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                              <span style={{ color: 'var(--fg-muted)', fontSize: 11 }}>{dateStr}</span>
                            </div>
                            {isOwn && (
                              <button
                                onClick={() => handleEliminar(n.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4, display: 'flex', borderRadius: 4 }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                                title="Eliminar nota"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {n.nota}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </ModalPortal>
  );
}
