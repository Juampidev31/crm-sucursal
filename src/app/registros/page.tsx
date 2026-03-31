'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, capitalizarNombre, sanitizarCuil, displayAnalista } from '@/lib/utils';
import { Registro, Recordatorio } from '@/types';
import { Edit2, Trash2, X, Save, AlertCircle, AlertTriangle, Bell, ChevronLeft, ChevronRight, Download, FileText, TrendingUp, Activity, DollarSign, Hash, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFilter, ESTADOS, ANALISTAS } from '@/context/FilterContext';
import { logAudit } from '@/lib/audit';

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTADOS_PERMITIDOS_DUPLICADO = ['venta', 'derivado / aprobado cc'];

const initialForm: Partial<Registro> = {
  cuil: '', nombre: '', puntaje: 0, es_re: false,
  analista: ANALISTAS[0], fecha: '', fecha_score: '', monto: 0,
  estado: 'proyeccion', comentarios: '',
};

const REGEX_NOMBRE = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]+$/;

const FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre', cuil: 'CUIL', analista: 'Analista',
  estado: 'Estado', monto: 'Monto', fecha: 'Fecha',
  puntaje: 'Score', es_re: 'Es RE', comentarios: 'Comentarios',
  tipo_cliente: 'Tipo cliente', acuerdo_precios: 'Acuerdo precios',
  fecha_score: 'Fecha score',
};

// Status label map (monochromatic — no per-state colors)
const STATUS_LABEL: Record<string, string> = {
  'venta': 'Venta',
  'proyeccion': 'Proyección',
  'en seguimiento': 'En seguimiento',
  'score bajo': 'Score bajo',
  'afectaciones': 'Afectaciones',
  'derivado / aprobado cc': 'Aprob. CC',
  'derivado / rechazado cc': 'Rechaz. CC',
};

// ── Validation ────────────────────────────────────────────────────────────────

function validarForm(form: Partial<Registro>, isAdmin: boolean): Record<string, string> {
  if (isAdmin) return {};
  const errs: Record<string, string> = {};
  if (!form.nombre?.trim()) errs.nombre = 'Requerido';
  else if (form.nombre.trim().length < 2) errs.nombre = 'Mín. 2 caracteres';
  else if (!REGEX_NOMBRE.test(form.nombre.trim())) errs.nombre = 'Solo letras';

  if (!form.cuil?.trim()) errs.cuil = 'Requerido';
  else if (form.cuil.length !== 11) errs.cuil = '11 dígitos';

  if (!form.analista) errs.analista = 'Requerido';
  if (!form.estado) errs.estado = 'Requerido';
  const requiereTipoYAcuerdo = form.estado === 'venta' || form.estado === 'derivado / aprobado cc';
  if (requiereTipoYAcuerdo && !form.tipo_cliente) errs.tipo_cliente = 'Requerido';
  if (requiereTipoYAcuerdo && !form.acuerdo_precios) errs.acuerdo_precios = 'Requerido';

  return errs;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => {
  const isRequired = label.includes('*');
  const cleanLabel = label.replace('*', '').trim();

  return (
    <div className="form-group">
      <label className="form-label">
        {cleanLabel}
        {isRequired && <span style={{ color: 'var(--rojo)', marginLeft: 4 }}>*</span>}
        {error && <span style={{ color: 'var(--rojo)', fontWeight: 400, marginLeft: 6 }}>— {error}</span>}
      </label>
      {children}
    </div>
  );
};

// ── Modal: Registro ───────────────────────────────────────────────────────────

const RegistroModal = memo(function RegistroModal({
  isOpen, editingId, initialData, onClose, onSaved, onSavedWithRecordatorio, isAdmin,
}: {
  isOpen: boolean; editingId: string | null; initialData: Partial<Registro>;
  onClose: () => void; onSaved: (reg: Registro) => void;
  onSavedWithRecordatorio?: (registro: Registro) => void; isAdmin: boolean;
}) {
  const [form, setForm] = useState<Partial<Registro>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);
  const [agendarRecordatorio, setAgendarRecordatorio] = useState(false);

  useEffect(() => {
    if (isOpen) { setForm(initialData); setErrors({}); setShowDupModal(false); setAgendarRecordatorio(false); }
  }, [isOpen, initialData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDupModal) { setShowDupModal(false); e.stopImmediatePropagation(); }
        else if (isOpen) { onClose(); e.stopImmediatePropagation(); }
      }
    };
    if (isOpen || showDupModal) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDupModal, onClose]);

  const set = (field: keyof Registro, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  const guardar = async () => {
    const errs = validarForm(form, isAdmin);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, ...cleanForm } = form as Registro & { created_at?: string; updated_at?: string };
    const payload = {
      ...cleanForm,
      monto: Number(form.monto),
      puntaje: Number(form.puntaje),
      fecha: cleanForm.fecha || null,
      fecha_score: cleanForm.fecha_score || null,
    };
    if (editingId) {
      const { error } = await supabase.from('registros').update(payload).eq('id', editingId);
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      // Auditar todos los cambios en una sola entrada
      const AUDIT_FIELDS = ['nombre', 'cuil', 'analista', 'estado', 'monto', 'fecha', 'fecha_score', 'puntaje', 'es_re', 'comentarios', 'tipo_cliente', 'acuerdo_precios'] as const;
      const cambios = AUDIT_FIELDS.filter(field => String((initialData as Record<string, unknown>)[field] ?? '') !== String((payload as Record<string, unknown>)[field] ?? ''));
      if (cambios.length > 0) {
        logAudit({
          id_registro: editingId,
          analista: String(payload.analista ?? ''),
          accion: 'Modificación',
          campo_modificado: cambios.map(f => FIELD_LABELS[f] ?? f).join(', '),
          valor_anterior: cambios.map(f => String((initialData as Record<string, unknown>)[f] ?? '—')).join(' | '),
          valor_nuevo: cambios.map(f => String((payload as Record<string, unknown>)[f] ?? '—')).join(' | '),
        });
      }
      const savedReg: Registro = { ...form as Registro, ...payload, id: editingId };
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio) onSavedWithRecordatorio(savedReg);
      else onSaved(savedReg);
    } else {
      const { data: newReg, error } = await supabase.from('registros').insert(payload).select().single();
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      logAudit({ id_registro: (newReg as Registro).id, analista: String(payload.analista ?? ''), accion: 'Creación', campo_modificado: 'Nuevo registro', valor_nuevo: `${payload.nombre} | ${payload.estado} | $${payload.monto}` });
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio && newReg) onSavedWithRecordatorio(newReg as Registro);
      else onSaved(newReg as Registro);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: '#000', border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
      }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '24px 32px' }}>
          <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
            {editingId ? 'EDITAR' : 'NUEVO'} REGISTRO
          </h3>
          <button className="btn-icon" onClick={onClose} style={{ color: '#444' }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <Field label="CUIL *" error={errors.cuil}>
              <input className="form-input" value={form.cuil || ''} onChange={e => set('cuil', isAdmin ? e.target.value : sanitizarCuil(e.target.value))} inputMode="numeric" />
            </Field>
            <Field label="Nombre *" error={errors.nombre}>
              <input className="form-input" value={form.nombre || ''} onChange={e => set('nombre', isAdmin ? e.target.value : capitalizarNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]/g, '')))} autoFocus />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Analista *">
              <select className="form-select" value={form.analista || ANALISTAS[0]} onChange={e => set('analista', e.target.value)}>
                {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Estado *">
              <select className="form-select" value={form.estado || 'proyeccion'} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e} value={e}>{STATUS_LABEL[e] ?? e}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Monto" error={errors.monto}>
              <input className="form-input" type="number" value={form.monto || ''} onChange={e => set('monto', e.target.value)} />
            </Field>
            <Field label="Fecha" error={errors.fecha}>
              <input className="form-input" type="date" value={form.fecha || ''} onChange={e => set('fecha', e.target.value)} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Fecha Score">
              <input className="form-input" type="date" value={form.fecha_score || ''} onChange={e => set('fecha_score', e.target.value)} />
            </Field>
            <Field label="Score">
              <input className="form-input" type="number" value={form.puntaje || ''} onChange={e => set('puntaje', Number(e.target.value))} placeholder="0" />
            </Field>
          </div>
          <div className="form-row">
            <Field label={`Tipo de cliente${form.estado === 'venta' || form.estado === 'derivado / aprobado cc' ? ' *' : ''}`} error={errors.tipo_cliente}>
              <select className="form-select" value={form.tipo_cliente || ''} onChange={e => set('tipo_cliente', e.target.value)}>
                <option value="">— Sin especificar —</option>
                <option value="Apertura">Apertura</option>
                <option value="Renovacion">Renovación</option>
              </select>
            </Field>
            <Field label={`Acuerdo de precios${form.estado === 'venta' || form.estado === 'derivado / aprobado cc' ? ' *' : ''}`} error={errors.acuerdo_precios}>
              <select className="form-select" value={form.acuerdo_precios || ''} onChange={e => set('acuerdo_precios', e.target.value)}>
                <option value="">— Sin especificar —</option>
                <option value="Riesgo Bajo">Riesgo Bajo</option>
                <option value="Riesgo Medio">Riesgo Medio</option>
                <option value="Premium">Premium</option>
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Comentarios">
              <textarea
                className="form-input"
                value={form.comentarios || ''}
                onChange={e => set('comentarios', e.target.value)}
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label className="toggle-card">
              <span className="toggle-switch">
                <input type="checkbox" checked={!!form.es_re} onChange={e => set('es_re', e.target.checked)} />
                <span className="toggle-slider" />
              </span>
              <span className="toggle-label"><FileText size={14} />Resumen Ejecutivo (RE)</span>
            </label>
            <label className="toggle-card">
              <span className="toggle-switch">
                <input type="checkbox" checked={agendarRecordatorio} onChange={e => setAgendarRecordatorio(e.target.checked)} />
                <span className="toggle-slider" />
              </span>
              <span className="toggle-label"><AlertTriangle size={14} />Agendar Recordatorio</span>
            </label>
          </div>
          <p className="modal-required-legend" style={{ color: 'var(--rojo)' }}>
            <span style={{ fontWeight: 700 }}>*</span> CAMPOS OBLIGATORIOS
          </p>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', padding: '24px 32px' }}>
          {errors._ && <span style={{ color: '#fff', fontSize: '12px', flex: 1, fontWeight: 700 }}>{errors._}</span>}
          <button className="btn-secondary" onClick={onClose} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#666',
            fontWeight: 700, padding: '12px 24px', borderRadius: '10px'
          }}>CANCELAR</button>
          <button className="btn-primary" onClick={() => guardar()} disabled={saving} style={{
            background: '#fff', color: '#000', border: 'none',
            fontWeight: 900, padding: '12px 32px', borderRadius: '10px',
            fontSize: '13px', letterSpacing: '0.5px'
          }}>
            <Save size={14} style={{ marginRight: 8 }} />{saving ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Modal: Recordatorio ───────────────────────────────────────────────────────

const RecordatorioModal = memo(function RecordatorioModal({
  registro, onClose,
}: { registro: Registro | null; onClose: (saved: boolean, newRec?: Recordatorio) => void }) {
  const [recForm, setRecForm] = useState({ nota: '', fecha: '', hora: '09:00' });
  const [saving, setSaving] = useState(false);
  const { pushRecordatorioChange } = useData();

  useEffect(() => {
    if (registro) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      setRecForm({ nota: '', fecha: tomorrow.toISOString().split('T')[0], hora: '09:00' });
    }
  }, [registro]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    if (registro) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registro, onClose]);

  if (!registro) return null;

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('recordatorios').insert({
      registro_id: registro.id, nombre: registro.nombre, cuil: registro.cuil,
      analista: registro.analista, estado: registro.estado, nota: recForm.nota,
      fecha_hora: `${recForm.fecha}T${recForm.hora}:00-03:00`,
      creado_por: registro.analista || 'Sistema', mostrado: false,
    }).select().single();

    if (error) {
      setSaving(false);
      return;
    }

    logAudit({ id_registro: registro.id, analista: registro.analista, accion: 'Recordatorio creado', campo_modificado: 'Recordatorio', valor_nuevo: `${registro.nombre} | ${recForm.fecha} ${recForm.hora}${recForm.nota ? ' | ' + recForm.nota : ''}` });
    // Broadcast a otros usuarios
    pushRecordatorioChange('INSERT', data as Recordatorio);
    setSaving(false); onClose(true, data as Recordatorio);
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Nuevo Recordatorio</h3>
          <button className="btn-icon" onClick={() => onClose(false)}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>{registro.nombre}</p>
          <div className="form-row">
            <Field label="Fecha *"><input className="form-input" type="date" value={recForm.fecha} onChange={e => setRecForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
            <Field label="Hora *"><input className="form-input" type="time" value={recForm.hora} onChange={e => setRecForm(p => ({ ...p, hora: e.target.value }))} /></Field>
          </div>
          <Field label="Nota"><textarea className="form-textarea" value={recForm.nota} onChange={e => setRecForm(p => ({ ...p, nota: e.target.value }))} /></Field>

          <p className="modal-required-legend" style={{ color: 'var(--rojo)' }}>
            <span style={{ fontWeight: 700 }}>*</span> CAMPOS OBLIGATORIOS
          </p>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', padding: '20px 28px' }}>
          <button className="btn-secondary" onClick={() => onClose(false)} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#666'
          }}>CANCELAR</button>
          <button className="btn-primary" onClick={save} disabled={saving || !recForm.fecha || !recForm.hora} style={{
            background: '#fff', color: '#000', border: 'none', fontWeight: 800
          }}>AGENDAR</button>
        </div>
      </div>
    </div>
  );
});

// ── Modal: Confirmar borrado ──────────────────────────────────────────────────

const DeleteModal = memo(function DeleteModal({
  registro, onConfirm, onCancel,
}: { registro: Registro | null; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    if (registro) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registro, onCancel]);

  if (!registro) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-content--danger" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <h3 className="modal-title" style={{ color: '#fff', fontWeight: 900, letterSpacing: '1px' }}>ELIMINAR REGISTRO</h3>
          <button className="btn-icon" onClick={onCancel} style={{ color: '#333' }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ padding: '32px 28px' }}>
          <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.8 }}>
            ¿Confirmar eliminación de <strong style={{ color: '#fff' }}>{registro.nombre}</strong>?<br />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#333', textTransform: 'uppercase', marginTop: '10px', display: 'block' }}>La acción es permanente.</span>
          </p>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <button className="btn-secondary" onClick={onCancel} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#666'
          }}>CANCELAR</button>
          <button className="btn-danger" onClick={onConfirm}>
            ELIMINAR AHORA
          </button>
        </div>
      </div>
    </div>
  );
});

// ── StatusBadge ───────────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ estado }: { estado: string }) {
  const label = STATUS_LABEL[estado?.toLowerCase()] ?? estado;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.2px',
      background: 'rgba(255,255,255,0.04)',
      color: '#aaa',
      border: '1px solid rgba(255,255,255,0.07)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegistrosPage() {
  const { isAdmin } = useAuth();
  const { registros, setRegistros, loading, refresh, pushRegistroChange } = useData();
  const {
    filters, setFilter, limpiarFiltros, hayFiltros,
    isCreationModalOpen, setIsCreationModalOpen,
    pageSize, triggerExport, exportTick,
    currentPage, setCurrentPage, setTotalResults,
    showFilters, setShowFilters,
  } = useFilter();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalInitialData, setModalInitialData] = useState<Partial<Registro>>(initialForm);
  const [recordatorioTarget, setRecordatorioTarget] = useState<Registro | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Registro | null>(null);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);

  // Fetch recordatorios
  useEffect(() => {
    const fetchRecordatorios = async () => {
      const { data, error } = await supabase
        .from('recordatorios')
        .select('*')
        .eq('mostrado', false);
      if (error) {
        console.error('Error fetching recordatorios:', error);
        return;
      }
      if (data) {
        setRecordatorios(data);
        console.log('Recordatorios cargados:', data.length);
      }
    };
    fetchRecordatorios();

    // Realtime subscription for recordatorios - escucha cambios de TODOS los usuarios
    const channel = supabase
      .channel('recordatorios-realtime-registros')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recordatorios' }, async () => {
        // Refetch all recordatorios on insert
        const { data } = await supabase
          .from('recordatorios')
          .select('*')
          .eq('mostrado', false);
        if (data) setRecordatorios(data);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recordatorios' }, async () => {
        // Refetch all recordatorios on update
        const { data } = await supabase
          .from('recordatorios')
          .select('*')
          .eq('mostrado', false);
        if (data) setRecordatorios(data);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'recordatorios' }, async () => {
        // Refetch all recordatorios on delete
        const { data } = await supabase
          .from('recordatorios')
          .select('*')
          .eq('mostrado', false);
        if (data) setRecordatorios(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check if a record has an expired reminder
  const hasVencido = useCallback((registroId: string) => {
    const ahora = new Date();
    const tieneVencido = recordatorios.some(r => {
      if (r.registro_id !== registroId) return false;
      const fechaRecordatorio = new Date(r.fecha_hora);
      return fechaRecordatorio < ahora;
    });
    if (tieneVencido) {
      console.log('Recordatorio vencido encontrado para registro:', registroId);
    }
    return tieneVencido;
  }, [recordatorios]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalOpen) {
          return;
        }
        if (hayFiltros) {
          limpiarFiltros();
        } else if (showFilters) {
          setShowFilters(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hayFiltros, limpiarFiltros, showFilters, setShowFilters, modalOpen]);


  const fetchRegistros = useCallback((silent = false) => { refresh(silent); }, [refresh]);

  // ── Animaciones ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulseGlow {
        0% { opacity: 0.4; transform: scale(0.95); box-shadow: 0 0 5px currentColor; }
        50% { opacity: 1; transform: scale(1.05); box-shadow: 0 0 12px currentColor; }
        100% { opacity: 0.4; transform: scale(0.95); box-shadow: 0 0 5px currentColor; }
      }
      .score-dot-pulse {
        animation: pulseGlow 2.5s infinite ease-in-out;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') =>
    setToast({ message, type }), []);

  useEffect(() => {
    if (isCreationModalOpen) {
      setEditingId(null);
      setModalInitialData({ ...initialForm });
      setModalOpen(true);
      setIsCreationModalOpen(false);
    }
  }, [isCreationModalOpen, setIsCreationModalOpen]);

  const filteredRegistros = useMemo(() => {
    const list = registros.filter(r => {
      const s = filters.search.toLowerCase();
      const mSearch = !filters.search || r.nombre?.toLowerCase().includes(s) || r.cuil?.toLowerCase().includes(s) || r.analista?.toLowerCase().includes(s);
      const mEstado = !filters.estado || r.estado === filters.estado;
      const mAnalista = !filters.analista || r.analista === filters.analista;
      const mDesde = !filters.fechaDesde || (r.fecha && r.fecha >= filters.fechaDesde);
      const mHasta = !filters.fechaHasta || (r.fecha && r.fecha <= filters.fechaHasta);
      const mMin = !filters.montoMin || Number(r.monto) >= Number(filters.montoMin);
      const mMax = !filters.montoMax || Number(r.monto) <= Number(filters.montoMax);
      const mScoreMin = !filters.scoreMin || (r.puntaje != null && Number(r.puntaje) >= Number(filters.scoreMin));
      const mScoreMax = !filters.scoreMax || (r.puntaje != null && Number(r.puntaje) <= Number(filters.scoreMax));
      const mRe = !filters.esRe || (filters.esRe === 'si' ? r.es_re : !r.es_re);
      return mSearch && mEstado && mAnalista && mDesde && mHasta && mMin && mMax && mScoreMin && mScoreMax && mRe;
    });

    return [...list].sort((a, b) => {
      const dA = a.fecha || '', dB = b.fecha || '';
      if (dA !== dB) return dA > dB ? -1 : 1;
      const priA = a.estado === 'venta' || a.estado === 'derivado / aprobado cc';
      const priB = b.estado === 'venta' || b.estado === 'derivado / aprobado cc';
      return priA === priB ? 0 : priA ? -1 : 1;
    });
  }, [registros, filters]);

  useEffect(() => { setTotalResults(filteredRegistros.length); }, [filteredRegistros.length, setTotalResults]);

  const totales = useMemo(() => {
    let suma = 0;
    filteredRegistros.forEach(r => suma += (Number(r.monto) || 0));
    return { cantidad: filteredRegistros.length, monto: suma };
  }, [filteredRegistros]);

  const exportarCSV = useCallback(() => {
    const headers = ['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Puntaje', 'Es RE'];
    const rows = filteredRegistros.map(r => [r.nombre, r.cuil, r.analista, r.estado, r.monto, r.fecha || '', r.puntaje || '', r.es_re ? 'Sí' : 'No']);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'registros.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [filteredRegistros]);

  useEffect(() => { if (exportTick > 0) exportarCSV(); }, [exportTick, exportarCSV]);

  const totalPages = Math.ceil(filteredRegistros.length / pageSize) || 1;
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);


  const openEdit = useCallback((reg: Registro) => {
    setEditingId(reg.id);
    setModalInitialData({ ...reg, fecha: reg.fecha || '', fecha_score: reg.fecha_score || '' });
    setModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const reg = deleteTarget;
    setDeleteTarget(null);
    await supabase.from('registros').delete().eq('id', reg.id);
    logAudit({ id_registro: reg.id, analista: reg.analista, accion: 'Eliminación', campo_modificado: 'Registro', valor_anterior: `${reg.nombre} | ${reg.estado} | $${reg.monto}` });
    setRegistros(prev => prev.filter(r => r.id !== reg.id));
    pushRegistroChange('DELETE', reg);
    showToast('Registro eliminado', 'success');
  }, [deleteTarget, pushRegistroChange, showToast, setRegistros]);

  const applyOptimistic = useCallback((reg: Registro) => {
    setRegistros(prev => {
      const idx = prev.findIndex(r => r.id === reg.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = reg; return next; }
      return [reg, ...prev];
    });
  }, [setRegistros]);

  const handleSaved = useCallback((reg: Registro) => {
    const isNew = !registros.find(r => r.id === reg.id);
    applyOptimistic(reg);
    pushRegistroChange(isNew ? 'INSERT' : 'UPDATE', reg);
    fetchRegistros(true);
  }, [applyOptimistic, fetchRegistros, pushRegistroChange, registros]);

  const handleSavedWithRecordatorio = useCallback((reg: Registro) => {
    const isNew = !registros.find(r => r.id === reg.id);
    applyOptimistic(reg);
    pushRegistroChange(isNew ? 'INSERT' : 'UPDATE', reg);
    showToast('Guardado', 'success');
    fetchRegistros(true);
    setRecordatorioTarget(reg);
  }, [applyOptimistic, fetchRegistros, pushRegistroChange, registros, showToast]);

  const handleRecordatorioClose = useCallback((saved: boolean, newRec?: Recordatorio) => {
    setRecordatorioTarget(null);
    if (saved) {
      showToast('Recordatorio agendado', 'success');
      if (newRec) setRecordatorios(prev => [...prev, newRec]);
    }
  }, [showToast]);

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredRegistros.length);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : toast.type === 'error' ? '#f87171' : '#fbbf24',
          }}>
            <AlertCircle size={15} />
            {toast.message}
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      {showFilters && (
        <div style={{
          background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} color="#666" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Filtros</span>
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowFilters(false)}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#666', borderRadius: '6px', padding: '6px 12px',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                textTransform: 'uppercase',
              }}
            >
              <X size={12} /> Cerrar
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            {/* Búsqueda */}
            <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>BÚSQUEDA</label>
              <input
                type="text"
                placeholder="Nombre, CUIL..."
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Estado */}
            <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>ESTADO</label>
              <select
                value={filters.estado}
                onChange={e => setFilter('estado', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                  color: '#aaa', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Todos</option>
                {ESTADOS.map(st => <option key={st} value={st} style={{ background: '#0a0a0a', color: '#fff' }}>{STATUS_LABEL[st] ?? st}</option>)}
              </select>
            </div>

            {/* Analista */}
            <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>ANALISTA</label>
              <select
                value={filters.analista}
                onChange={e => setFilter('analista', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                  color: '#aaa', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Todos</option>
                {ANALISTAS.map(an => <option key={an} value={an} style={{ background: '#0a0a0a', color: '#fff' }}>{an}</option>)}
              </select>
            </div>

            {/* Score Min */}
            <div style={{ flex: '0 1 100px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>SCORE MIN</label>
              <input
                type="number"
                placeholder="Mín"
                value={filters.scoreMin}
                onChange={e => setFilter('scoreMin', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Score Max */}
            <div style={{ flex: '0 1 100px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>SCORE MAX</label>
              <input
                type="number"
                placeholder="Máx"
                value={filters.scoreMax}
                onChange={e => setFilter('scoreMax', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Monto Min */}
            <div style={{ flex: '0 1 120px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>MONTO MIN</label>
              <input
                type="number"
                placeholder="Mín"
                value={filters.montoMin}
                onChange={e => setFilter('montoMin', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Monto Max */}
            <div style={{ flex: '0 1 120px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>MONTO MAX</label>
              <input
                type="number"
                placeholder="Máx"
                value={filters.montoMax}
                onChange={e => setFilter('montoMax', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Fecha Desde */}
            <div style={{ flex: '0 1 140px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>FECHA DESDE</label>
              <input
                type="date"
                value={filters.fechaDesde}
                onChange={e => setFilter('fechaDesde', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Fecha Hasta */}
            <div style={{ flex: '0 1 140px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>FECHA HASTA</label>
              <input
                type="date"
                value={filters.fechaHasta}
                onChange={e => setFilter('fechaHasta', e.target.value)}
                style={{
                  width: '100%', height: 38, fontSize: '13px', fontWeight: 600,
                  padding: '0 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
                  color: '#aaa', outline: 'none',
                }}
              />
            </div>

            {/* Limpiar */}
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                style={{
                  height: 38, padding: '0 16px', background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.2)', color: '#f87171',
                  borderRadius: '6px', fontWeight: 800, fontSize: '11px',
                  cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>
      )}



      {/* Table */}
      <div style={{
        background: '#000', border: '1px solid rgba(255,255,255,0.03)',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        {filteredRegistros.length === 0 && !loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
            <span style={{ fontSize: 40, color: '#111' }}>—</span>
            <p style={{ fontSize: 16, color: '#444', fontWeight: 600 }}>No se encontraron registros coincidentes</p>
            {hayFiltros && (
              <button onClick={limpiarFiltros} style={{ background: 'transparent', border: '1px solid #222', color: '#666', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', marginTop: '12px' }}>
                <X size={14} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> LIMPIAR FILTROS
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
            {hayFiltros && (
              <div style={{
                background: 'rgba(30, 60, 250, 0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                padding: '12px 24px',
                display: 'flex', gap: '32px', alignItems: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#777', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Registros filtrados <span style={{ color: '#fff', fontSize: '14px', marginLeft: '8px' }}>{totales.cantidad}</span>
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#777', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Total acumulado <span style={{ color: '#fff', fontSize: '14px', marginLeft: '8px' }}>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totales.monto)}
                  </span>
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={limpiarFiltros} style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#888', fontSize: '10px', fontWeight: 800, borderRadius: '6px',
                  cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', transition: '0.2s'
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  <X size={12} strokeWidth={3} /> Limpiar Filtros
                </button>
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.005)' }}>
                  {['Cliente / CUIL', 'Gestión', 'Fecha', 'Score', 'Monto', 'Calif.', 'Tipo / Acuerdo', 'Acciones'].map((h, i) => (
                    <th key={i} style={{
                      padding: '20px 24px',
                      fontSize: 11, fontWeight: 900,
                      color: '#222',
                      textTransform: 'uppercase',
                      letterSpacing: '1.2px',
                      textAlign: (i === 0) ? 'left' : 'center',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRegistros.map((reg) => {
                  return (
                    <tr
                      key={reg.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.012)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '18px 24px', minWidth: 220, textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '17px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>{reg.nombre}</span>
                            {reg.es_re && (
                              <span style={{
                                fontSize: '9px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px',
                                background: '#333', color: '#fff', border: '1px solid #444', letterSpacing: '0.5px'
                              }}>RE</span>
                            )}
                            {reg.cuil && <div style={{ fontSize: '13px', color: '#444', fontFamily: 'monospace', opacity: 0.8 }}>{reg.cuil}</div>}
                          </div>
                          {hasVencido(reg.id) && (
                            <span style={{
                              fontSize: '11px', fontWeight: 700, color: 'var(--rojo)',
                              background: 'rgba(220,53,69,0.1)', padding: '2px 8px',
                              borderRadius: '6px', border: '1px solid rgba(220,53,69,0.2)',
                              display: 'inline-block', width: 'fit-content',
                            }}>
                              Recordatorio vencido
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Analista */}
                      <td style={{ padding: '18px 24px', fontSize: '15px', color: '#888', fontWeight: 600, textAlign: 'center' }}>
                        {displayAnalista(reg.analista)}
                      </td>

                      {/* Fecha */}
                      <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>{formatDate(reg.fecha)}</div>
                      </td>

                      {/* Score */}
                      <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                        {reg.puntaje ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div
                              className="score-dot-pulse"
                              style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: reg.puntaje >= 700 ? '#60a5facc' : reg.puntaje >= 500 ? '#fbbf24cc' : '#ef4444cc',
                                boxShadow: `0 0 10px ${reg.puntaje >= 700 ? '#60a5fa33' : reg.puntaje >= 500 ? '#fbbf2433' : '#ef444433'}`,
                                color: reg.puntaje >= 700 ? '#60a5fa' : reg.puntaje >= 500 ? '#fbbf24' : '#ef4444',
                              }}
                            />
                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{reg.puntaje}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#111', fontSize: 13 }}>—</span>
                        )}
                      </td>

                      {/* Monto */}
                      <td style={{ padding: '18px 24px', fontSize: '17px', fontWeight: 900, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {formatCurrency(Number(reg.monto))}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                        <StatusBadge estado={reg.estado} />
                      </td>

                      {/* Tipo / Acuerdo */}
                      <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: reg.tipo_cliente ? '#fff' : '#222' }}>{reg.tipo_cliente || '—'}</span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color:
                              reg.acuerdo_precios?.toUpperCase().includes('RIESGO BAJO') ? '#4ade80' :
                                reg.acuerdo_precios?.toUpperCase().includes('RIESGO MEDIO') ? '#f87171' :
                                  reg.acuerdo_precios?.toUpperCase().includes('PREMIUM') ? '#60a5fa' :
                                    '#333',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px'
                          }}>
                            {reg.acuerdo_precios || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => setRecordatorioTarget(reg)}
                            style={{ width: 38, height: 38, borderRadius: '10px', background: hasVencido(reg.id) ? 'rgba(220,53,69,0.08)' : 'rgba(255,255,255,0.02)', border: hasVencido(reg.id) ? '1px solid rgba(220,53,69,0.2)' : '1px solid rgba(255,255,255,0.05)', color: hasVencido(reg.id) ? 'var(--rojo)' : '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                            title="Recordatorio"
                            onMouseOver={e => { e.currentTarget.style.color = hasVencido(reg.id) ? 'var(--rojo)' : '#fff'; }}
                            onMouseOut={e => { e.currentTarget.style.color = hasVencido(reg.id) ? 'var(--rojo)' : '#444'; }}
                          ><Bell size={16} /></button>
                          <button
                            onClick={() => openEdit(reg)}
                            style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                            title="Editar"
                            onMouseOver={e => e.currentTarget.style.color = '#fff'}
                            onMouseOut={e => e.currentTarget.style.color = '#444'}
                          ><Edit2 size={16} /></button>
                          <button
                            onClick={() => setDeleteTarget(reg)}
                            style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                            title="Eliminar"
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(248,113,113,0.15)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(248,113,113,0.05)'}
                          ><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <RegistroModal
        isOpen={modalOpen} editingId={editingId} initialData={modalInitialData}
        isAdmin={isAdmin} onClose={() => setModalOpen(false)}
        onSaved={handleSaved} onSavedWithRecordatorio={handleSavedWithRecordatorio}
      />
      <RecordatorioModal registro={recordatorioTarget} onClose={handleRecordatorioClose} />
      <DeleteModal registro={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />

    </div>
  );
}
