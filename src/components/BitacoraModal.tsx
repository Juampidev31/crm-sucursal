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
import { formatDate, formatDateTime } from '@/lib/utils';
import { X, Trash2, Loader2, AlertCircle, Bell, Clock, User, Tag, Edit3, Minus, Plus } from 'lucide-react';
import styles from './BitacoraModal.module.css';

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
  const [modalZoom, setModalZoom] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('crm_modal_bitacora_zoom_level_v1');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val)) setModalZoom(val);
      }
    }

    const handleZoomEvent = (e: Event) => {
      const customEvt = e as CustomEvent<number>;
      if (customEvt.detail) setModalZoom(customEvt.detail);
    };

    window.addEventListener('crm_modal_bitacora_zoom_changed', handleZoomEvent);
    return () => window.removeEventListener('crm_modal_bitacora_zoom_changed', handleZoomEvent);
  }, []);

  const handleModalZoom = (delta: number) => {
    setModalZoom(prev => {
      const next = Math.max(0.7, Math.round((prev + delta) * 100) / 100);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_modal_bitacora_zoom_level_v1', String(next));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('crm_modal_bitacora_zoom_changed', { detail: next }));
        }, 0);
      }
      return next;
    });
  };

  const resetModalZoom = () => {
    setModalZoom(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_modal_bitacora_zoom_level_v1', '1');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('crm_modal_bitacora_zoom_changed', { detail: 1 }));
      }, 0);
    }
  };
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const setSaveSuccess = (_val?: boolean) => {};

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
          valor_nuevo: `${registro.nombre} | ${formatDate(fecha)} ${hora}${nota.trim() ? ' | ' + nota.trim() : ''}`,
        });
        pushRecordatorioChange('INSERT', recData as Recordatorio);
        okRec = true;
      }
    }

    if (okNota || okRec || okEtiq) {
      setNota('');
      setFecha('');
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
        className={styles.overlay}
      >
        <motion.div
          drag
          dragMomentum={false}
          className={`modal-content ${styles.modal}`}
          style={{ '--modal-zoom': modalZoom } as React.CSSProperties}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className={styles.header}>
            <div className={styles.headerTitleRow}>
              <span className={styles.headerIcon}>📜</span>
              <h3 className={styles.title}>
                RECORDATORIOS Y SEGUIMIENTOS
              </h3>
            </div>
            <div className={styles.headerActions}>
              {/* Zoom Controls (- % +) */}
              <div className={styles.zoomControls}>
                <button
                  type="button"
                  onClick={() => handleModalZoom(-0.05)}
                  title="Reducir tamaño (-)"
                  className={styles.zoomButton}
                >
                  <Minus size={12} strokeWidth={2.5} />
                </button>
                <span
                  onClick={resetModalZoom}
                  title="Restablecer a 100%"
                  className={`${styles.zoomValue}${modalZoom !== 1 ? ` ${styles.isChanged}` : ''}`}
                >
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => handleModalZoom(0.05)}
                  title="Agrandar tamaño (+)"
                  className={styles.zoomButton}
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>

              <button
                onClick={onClose}
                className={styles.closeButton}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Body (Scrollable) ── */}
          <div
            className={`hide-scrollbar ${styles.body}`}
          >
            
            {/* Banners */}
            {saveError && (
              <div className={styles.errorBanner}>
                <AlertCircle size={15} />
                <span>{saveError}</span>
              </div>
            )}

            {/* Selector de Recordatorio (sin título) */}
            <div className={styles.sectionCard}>
              {activeReminder && (
                <div className={styles.activeReminder}>
                  <div className={styles.inlineRow}>
                    <Bell size={12} />
                    <span>
                      Recordatorio actual: <strong>{formatDateTime(activeReminder.fecha_hora)}</strong>
                    </span>
                  </div>
                  <div className={styles.compactActions}>
                    <button
                      type="button"
                      onClick={() => handleCompletarRecordatorio(activeReminder.id)}
                      className={`${styles.compactButton} ${styles.successButton}`}
                    >
                      ✅ Atendido
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminarRecordatorio(activeReminder.id)}
                      className={`${styles.compactButton} ${styles.dangerButton}`}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.dateGrid}>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className={styles.dateInput}
                />
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className={styles.dateInput}
                />
              </div>

              <div className={styles.quickDates}>
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
                      className={`${styles.quickDate}${sel ? ` ${styles.isSelected}` : ''}`}
                    >{label}</button>
                  );
                })}
              </div>
            </div>

            {/* 2. Card: ETIQUETAS PERSONALIZADAS */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>
                <Tag size={13} className={styles.tagIcon} />
                ETIQUETAS PERSONALIZADAS
              </div>

              {/* Lista actual de etiquetas */}
              <div className={styles.tagListBlock}>
                {etiquetas.length === 0 ? (
                  <span className={styles.emptyText}>Sin etiquetas asignadas a este cliente.</span>
                ) : (
                  <div className={styles.tagList}>
                    {etiquetas.map(t => {
                      const s = getTagStyle(t);
                      return (
                        <span key={t} className={styles.tagBadge} style={{ '--tag-bg': s.bg, '--tag-border': s.border, '--tag-color': s.color } as React.CSSProperties}>
                          {s.label}
                          <X size={11} className={styles.clickableIcon} onClick={() => setEtiquetas(etiquetas.filter(x => x !== t))} />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-box: CREAR NUEVA ETIQUETA */}
              <div className={styles.tagCreator}>
                <div className={styles.tagCreatorTitle}>
                  CREAR NUEVA ETIQUETA
                </div>
                <div className={styles.inlineRow}>
                  <input
                    value={nuevaEtiqueta}
                    onChange={e => setNuevaEtiqueta(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarEtiqueta(); } }}
                    className={styles.textInput}
                  />

                  {/* Círculos Selector de Color */}
                  <div className={styles.colorPicker}>
                    {TAG_COLORS.map(c => {
                      const isSel = selectedColor === c.color;
                      return (
                        <div
                          key={c.color}
                          onClick={() => setSelectedColor(c.color)}
                          className={`${styles.colorOption}${isSel ? ` ${styles.isSelected}` : ''}`}
                          style={{ '--tag-color': c.color, '--tag-bg': c.fill, '--tag-glow': c.glow } as React.CSSProperties}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleAgregarEtiqueta}
                    className={styles.addTagButton}
                  >
                    + AGREGAR
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Card: AÑADIR NUEVA NOTA / OBSERVACIÓN */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>
                <Edit3 size={13} className={styles.editIcon} />
                AÑADIR NUEVA NOTA / OBSERVACIÓN
              </div>

              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                rows={2}
                className={styles.noteInput}
              />

              <div className={styles.saveRow}>
                <button
                  onClick={handleGuardar}
                  disabled={saving || !canSave}
                  className={styles.saveButton}
                >
                  {saving ? <Loader2 size={12} className={styles.spinner} /> : null}
                  GUARDAR NOTA / RECORDATORIO
                </button>
              </div>
            </div>

            {/* 4. Card: HISTORIAL DE NOTAS */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>
                <Clock size={13} />
                HISTORIAL DE NOTAS ({notas.length})
              </div>

              {loadingNotas ? (
                <div className={styles.historyStatus}>
                  <Loader2 size={13} className={styles.inlineSpinner} />
                  Cargando historial...
                </div>
              ) : notas.length === 0 ? (
                <div className={`${styles.historyStatus} ${styles.isEmpty}`}>
                  No hay notas registradas para este cliente aún.
                </div>
              ) : (
                <div className={`hide-scrollbar ${styles.historyList}`}>
                  {notas.map(n => {
                    const dateStr = n.created_at
                      ? new Date(n.created_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '';
                    const isOwn = user?.username === 'admin' || user?.username === n.analista;
                    return (
                      <div key={n.id} className={styles.historyItem}>
                        <div className={styles.historyHeader}>
                          <div className={styles.historyMeta}>
                            <User size={11} />
                            <span className={styles.historyAuthor}>{n.analista || 'Anónimo'}</span>
                            <span className={styles.historyBullet}>•</span>
                            <span className={styles.historyDate}>{dateStr}</span>
                          </div>
                          {isOwn && (
                            <button
                              onClick={() => handleEliminar(n.id)}
                              className={styles.deleteButton}
                              title="Eliminar nota"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <p className={styles.historyNote}>
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
