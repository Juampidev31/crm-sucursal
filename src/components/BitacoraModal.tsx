'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { Registro, BitacoraNota, Recordatorio } from '@/types';
import ModalPortal from '@/components/ModalPortal';
import { getTagStyle } from '@/components/EtiquetasSelector';
import { logAudit } from '@/lib/audit';
import { X, Trash2, Loader2, AlertCircle, Bell, Clock, User, CheckCircle2, Tag, Edit3 } from 'lucide-react';

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

const TAG_COLORS = [
  { color: '#c084fc', fill: 'rgba(192, 132, 252, 0.18)', glow: '#c084fc' },
  { color: '#3b82f6', fill: 'rgba(59, 130, 246, 0.18)', glow: '#3b82f6' },
  { color: '#22c55e', fill: 'rgba(34, 197, 94, 0.18)', glow: '#22c55e' },
  { color: '#eab308', fill: 'rgba(234, 179, 8, 0.18)', glow: '#eab308' },
  { color: '#ef4444', fill: 'rgba(239, 68, 68, 0.18)', glow: '#ef4444' },
  { color: '#ec4899', fill: 'rgba(236, 72, 153, 0.18)', glow: '#ec4899' },
  { color: '#14b8a6', fill: 'rgba(20, 184, 166, 0.18)', glow: '#14b8a6' },
];

export default function BitacoraModal({ isOpen, onClose, registro, onSavedEtiquetas }: BitacoraModalProps) {
  const { user } = useAuth();
  const { pushRecordatorioChange } = useRecordatorios();

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('09:00');
  const [nota, setNota] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [selectedColor, setSelectedColor] = useState('#c084fc');
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [notas, setNotas] = useState<BitacoraNota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [activeReminder, setActiveReminder] = useState<Recordatorio | null>(null);

  // ── Fetch recordatorio activo ──────────────────────────────────────────────
  const fetchActiveReminder = useCallback(async () => {
    if (!registro?.id) return;
    const { data } = await supabase
      .from('recordatorios')
      .select('*')
      .eq('registro_id', registro.id)
      .eq('mostrado', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveReminder(data as Recordatorio);
    } else {
      setActiveReminder(null);
    }
  }, [registro]);

  const handleCompletarRecordatorio = async (recId: string) => {
    const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('id', recId);
    if (!error) {
      if (activeReminder) {
        pushRecordatorioChange('UPDATE', { ...activeReminder, mostrado: true });
      }
      setActiveReminder(null);
    }
  };

  const handleEliminarRecordatorio = async (recId: string) => {
    const { error } = await supabase.from('recordatorios').delete().eq('id', recId);
    if (!error) {
      if (activeReminder) {
        pushRecordatorioChange('DELETE', activeReminder);
      }
      setActiveReminder(null);
    }
  };

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
      fetchActiveReminder();
      setFecha('');
      setHora('09:00');
      setNota('');
      setEtiquetas(registro.etiquetas || []);
      setNuevaEtiqueta('');
      setSaveError('');
      setSaveSuccess(false);

      // ── Supabase Realtime subscription para bitacora_notas en tiempo real ──
      const channel = supabase
        .channel(`bitacora_notas_realtime_${registro.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bitacora_notas' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newNota = payload.new as BitacoraNota;
              if (newNota.registro_id === registro.id || (registro.cuil && newNota.cuil === registro.cuil)) {
                setNotas((prev) => {
                  if (prev.some((n) => n.id === newNota.id)) return prev;
                  return [newNota, ...prev];
                });
              }
            } else if (payload.eventType === 'DELETE') {
              const oldId = payload.old.id;
              setNotas((prev) => prev.filter((n) => n.id !== oldId));
            } else if (payload.eventType === 'UPDATE') {
              const updatedNota = payload.new as BitacoraNota;
              setNotas((prev) => prev.map((n) => (n.id === updatedNota.id ? updatedNota : n)));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setNotas([]);
      setNota('');
      setFecha('');
      setEtiquetas([]);
      setNuevaEtiqueta('');
      setSaveError('');
      setSaveSuccess(false);
    }
  }, [isOpen, registro, fetchNotas]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Agregar Etiqueta Custom ───────────────────────────────────────────────
  const handleAgregarEtiqueta = () => {
    const tag = nuevaEtiqueta.trim();
    if (tag) {
      const tagWithColor = selectedColor ? `${tag}|${selectedColor}` : tag;
      if (!etiquetas.some(t => t === tagWithColor || t === tag || t.startsWith(tag + '|'))) {
        setEtiquetas([...etiquetas, tagWithColor]);
        setNuevaEtiqueta('');
      }
    }
  };

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
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          drag
          dragMomentum={false}
          style={{
            maxWidth: 660,
            width: '100%',
            height: 'calc(100vh - 36px)',
            maxHeight: 'calc(100vh - 36px)',
            borderRadius: 16,
            background: '#0d0d10',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.95)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div style={{
            background: 'rgba(14, 14, 18, 0.98)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📜</span>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                RECORDATORIOS Y SEGUIMIENTOS
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Body (Scrollable) ── */}
          <div
            className="hide-scrollbar"
            style={{
              padding: '16px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              flex: 1,
            }}
          >
            
            {/* Sub-header Cliente */}
            <div style={{ fontSize: 13, color: '#9ca3af' }}>
              Cliente: <strong style={{ color: '#fff' }}>{registro.nombre}</strong> — CUIL: <strong style={{ color: '#fff' }}>{registro.cuil || 'Sin CUIL'}</strong>
            </div>

            {/* Banners */}
            {saveError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5', fontSize: 12, lineHeight: 1.5,
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7', fontSize: 12, fontWeight: 600,
              }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>¡Guardado correctamente!</span>
              </div>
            )}

            {/* 1. Card: RECORDATORIO DE RE-CONTACTO */}
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 14,
              background: 'rgba(255, 255, 255, 0.015)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#e5e7eb', letterSpacing: '0.6px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={14} style={{ color: '#f59e0b' }} />
                  <span>RECORDATORIO DE RE-CONTACTO</span>
                </div>
              </div>

              {activeReminder && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                  background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5', fontSize: 11
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={13} style={{ color: '#ef4444' }} />
                    <span>
                      Recordatorio actual: <strong>{new Date(activeReminder.fecha_hora).toLocaleDateString('es-AR')} {new Date(activeReminder.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleCompletarRecordatorio(activeReminder.id)}
                      style={{
                        padding: '4px 8px', fontSize: 10, fontWeight: 800,
                        background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399',
                        borderRadius: 6, cursor: 'pointer'
                      }}
                    >
                      ✅ Atendido
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminarRecordatorio(activeReminder.id)}
                      style={{
                        padding: '4px 8px', fontSize: 10, fontWeight: 800,
                        background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5',
                        borderRadius: 6, cursor: 'pointer'
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  style={{
                    width: '100%', height: 38, padding: '0 12px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 12, outline: 'none', colorScheme: 'dark'
                  }}
                />
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  style={{
                    width: '100%', height: 38, padding: '0 12px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 12, outline: 'none', colorScheme: 'dark'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
                        width: '100%',
                        padding: '6px 4px', fontSize: 11, fontWeight: 700,
                        background: sel ? 'rgba(16,185,129,0.18)' : 'rgba(255, 255, 255, 0.04)',
                        color: sel ? '#10b981' : '#9ca3af',
                        border: `1px solid ${sel ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
                        textAlign: 'center', whiteSpace: 'nowrap'
                      }}
                    >{label}</button>
                  );
                })}
              </div>
            </div>

            {/* 2. Card: ETIQUETAS PERSONALIZADAS */}
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 14,
              background: 'rgba(255, 255, 255, 0.015)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#e5e7eb', letterSpacing: '0.6px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={14} style={{ color: '#c084fc' }} />
                ETIQUETAS PERSONALIZADAS
              </div>

              {/* Lista actual de etiquetas */}
              <div style={{ marginBottom: 10 }}>
                {etiquetas.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Sin etiquetas asignadas a este cliente.</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {etiquetas.map(t => {
                      const s = getTagStyle(t);
                      return (
                        <span key={t} style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: s.bg, border: `1px solid ${s.border}`,
                          color: s.color, display: 'inline-flex', alignItems: 'center', gap: 6
                        }}>
                          {s.label}
                          <X size={12} style={{ cursor: 'pointer' }} onClick={() => setEtiquetas(etiquetas.filter(x => x !== t))} />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-box: CREAR NUEVA ETIQUETA */}
              <div style={{
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 8,
                padding: 10,
                background: 'rgba(0, 0, 0, 0.25)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>
                  CREAR NUEVA ETIQUETA
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={nuevaEtiqueta}
                    onChange={e => setNuevaEtiqueta(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarEtiqueta(); } }}
                    style={{
                      flex: 1, minWidth: 0, height: 36, padding: '0 10px',
                      background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none'
                    }}
                  />

                  {/* Círculos Selector de Color en Contenedor Redondeado */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    flexShrink: 0
                  }}>
                    {TAG_COLORS.map(c => {
                      const isSel = selectedColor === c.color;
                      return (
                        <div
                          key={c.color}
                          onClick={() => setSelectedColor(c.color)}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: c.fill,
                            border: isSel ? `2px solid ${c.color}` : `1px solid ${c.color}`,
                            boxShadow: isSel ? `0 0 10px ${c.glow}` : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            transform: isSel ? 'scale(1.1)' : 'scale(1)',
                            boxSizing: 'border-box'
                          }}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleAgregarEtiqueta}
                    style={{
                      height: 36, padding: '0 12px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', color: '#34d399',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      whiteSpace: 'nowrap', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)'; }}
                  >
                    + AGREGAR
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Card: AÑADIR NUEVA NOTA / OBSERVACIÓN */}
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 14,
              background: 'rgba(255, 255, 255, 0.015)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#e5e7eb', letterSpacing: '0.6px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={14} style={{ color: '#60a5fa' }} />
                AÑADIR NUEVA NOTA / OBSERVACIÓN
              </div>

              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                rows={3}
                style={{
                  width: '100%', minHeight: 75, padding: 10, borderRadius: 8,
                  background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={handleGuardar}
                  disabled={saving || !canSave}
                  style={{
                    padding: '8px 20px', fontSize: 11, fontWeight: 900,
                    letterSpacing: '0.6px', textTransform: 'uppercase',
                    background: canSave && !saving ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    color: canSave && !saving ? '#34d399' : '#6b7280',
                    border: `1px solid ${canSave && !saving ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 8, cursor: canSave && !saving ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (canSave && !saving) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; }}
                  onMouseLeave={e => { if (canSave && !saving) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; }}
                >
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  GUARDAR NOTA / RECORDATORIO
                </button>
              </div>
            </div>

            {/* 4. Card: HISTORIAL DE NOTAS */}
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 14,
              background: 'rgba(255, 255, 255, 0.015)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#e5e7eb', letterSpacing: '0.6px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} style={{ color: '#9ca3af' }} />
                HISTORIAL DE NOTAS ({notas.length})
              </div>

              {loadingNotas ? (
                <div style={{ textAlign: 'center', padding: '14px 0', color: '#6b7280', fontSize: 12 }}>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 6 }} />
                  Cargando historial...
                </div>
              ) : notas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>
                  No hay notas registradas para este cliente aún.
                </div>
              ) : (
                <div className="hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                  {notas.map(n => {
                    const dateStr = n.created_at
                      ? new Date(n.created_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '';
                    const isOwn = user?.username === 'admin' || user?.username === n.analista;
                    return (
                      <div key={n.id} style={{
                        padding: '8px 12px', background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 8,
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <User size={12} style={{ color: '#34d399' }} />
                            <span style={{ fontWeight: 700, color: '#fff' }}>{n.analista || 'Anónimo'}</span>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                            <span style={{ color: '#9ca3af' }}>{dateStr}</span>
                          </div>
                          {isOwn && (
                            <button
                              onClick={() => handleEliminar(n.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                              title="Eliminar nota"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {n.nota}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </motion.div>
      </div>
    </ModalPortal>
  );
}
