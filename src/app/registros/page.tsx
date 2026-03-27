'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, capitalizarNombre, sanitizarCuil, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { Search, Plus, Edit2, Trash2, X, Save, AlertCircle, AlertTriangle, Bell, ChevronLeft, ChevronRight, Filter, Download, ChevronUp, ChevronDown, FileText, ChevronDown as CD } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFilter, ESTADOS, ANALISTAS } from '@/context/FilterContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTADOS_PERMITIDOS_DUPLICADO = ['venta', 'derivado / aprobado cc'];

const initialForm: Partial<Registro> = {
  cuil: '', nombre: '', puntaje: 0, es_re: false,
  analista: ANALISTAS[0], fecha: '', fecha_score: '', monto: 0,
  estado: 'proyeccion', comentarios: '',
};

const REGEX_NOMBRE = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]+$/;

// Status label map (monochromatic — no per-state colors)
const STATUS_LABEL: Record<string, string> = {
  'venta':                   'Venta',
  'proyeccion':              'Proyección',
  'en seguimiento':          'En seguimiento',
  'score bajo':              'Score bajo',
  'afectaciones':            'Afectaciones',
  'derivado / aprobado cc':  'Aprob. CC',
  'derivado / rechazado cc': 'Rechaz. CC',
};

// ── Validation ────────────────────────────────────────────────────────────────

function validarForm(form: Partial<Registro>, isAdmin: boolean): Record<string, string> {
  if (isAdmin) return {};
  const errs: Record<string, string> = {};
  if (!form.nombre?.trim()) errs.nombre = 'Requerido';
  else if (form.nombre.trim().length < 2) errs.nombre = 'Mín. 2 caracteres';
  else if (!REGEX_NOMBRE.test(form.nombre.trim())) errs.nombre = 'Solo letras';
  if (form.cuil?.trim() && form.cuil.length !== 11) errs.cuil = '11 dígitos';
  if (!form.analista) errs.analista = 'Requerido';
  if (!form.fecha) errs.fecha = 'Requerido';
  if (!form.monto || Number(form.monto) <= 0) errs.monto = 'Debe ser > 0';
  return errs;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="form-group">
    <label className="form-label">
      {label}{error && <span style={{ color: 'var(--rojo)', fontWeight: 400, marginLeft: 6 }}>— {error}</span>}
    </label>
    {children}
  </div>
);

// ── Modal: Registro ───────────────────────────────────────────────────────────

const RegistroModal = memo(function RegistroModal({
  isOpen, editingId, initialData, onClose, onSaved, onSavedWithRecordatorio, isAdmin,
}: {
  isOpen: boolean; editingId: string | null; initialData: Partial<Registro>;
  onClose: () => void; onSaved: (reg: Registro) => void;
  onSavedWithRecordatorio?: (registro: Registro) => void; isAdmin: boolean;
}) {
  const [form, setForm]             = useState<Partial<Registro>>(initialData);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [showDupModal, setShowDupModal]           = useState(false);
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
      const savedReg: Registro = { ...form as Registro, ...payload, id: editingId };
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio) onSavedWithRecordatorio(savedReg);
      else onSaved(savedReg);
    } else {
      const { data: newReg, error } = await supabase.from('registros').insert(payload).select().single();
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio && newReg) onSavedWithRecordatorio(newReg as Registro);
      else onSaved(newReg as Registro);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editingId ? 'Editar' : 'Nuevo'} Registro</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <Field label="CUIL" error={errors.cuil}>
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
            <Field label="Estado">
              <select className="form-select" value={form.estado || 'proyeccion'} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e} value={e}>{STATUS_CONFIG[e]?.label ?? e}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Monto *" error={errors.monto}>
              <input className="form-input" type="number" value={form.monto || ''} onChange={e => set('monto', e.target.value)} />
            </Field>
            <Field label="Fecha *" error={errors.fecha}>
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
            <Field label="Tipo de cliente">
              <select className="form-select" value={form.tipo_cliente || ''} onChange={e => set('tipo_cliente', e.target.value)}>
                <option value="">— Sin especificar —</option>
                <option value="Apertura">Apertura</option>
                <option value="Renovacion">Renovación</option>
              </select>
            </Field>
            <Field label="Acuerdo de precios">
              <select className="form-select" value={form.acuerdo_precios || ''} onChange={e => set('acuerdo_precios', e.target.value)}>
                <option value="">— Sin especificar —</option>
                <option value="Riesgo Bajo">Riesgo Bajo</option>
                <option value="Riesgo Medio">Riesgo Medio</option>
                <option value="Premium">Premium</option>
              </select>
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
          <p className="modal-required-legend">* Campos obligatorios</p>
        </div>
        <div className="modal-footer">
          {errors._ && <span style={{ color: 'var(--rojo)', fontSize: '13px', flex: 1 }}>{errors._}</span>}
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => guardar()} disabled={saving}>
            <Save size={14} />{saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Modal: Recordatorio ───────────────────────────────────────────────────────

const RecordatorioModal = memo(function RecordatorioModal({
  registro, onClose,
}: { registro: Registro | null; onClose: (saved: boolean) => void }) {
  const [recForm, setRecForm] = useState({ nota: '', fecha: '', hora: '09:00' });
  const [saving, setSaving]   = useState(false);
  const { setPendingReminders } = useData();

  useEffect(() => {
    if (registro) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      setRecForm({ nota: '', fecha: tomorrow.toISOString().split('T')[0], hora: '09:00' });
    }
  }, [registro]);

  if (!registro) return null;

  const save = async () => {
    setSaving(true);
    await supabase.from('recordatorios').insert({
      registro_id: registro.id, nombre: registro.nombre, cuil: registro.cuil,
      analista: registro.analista, estado: registro.estado, nota: recForm.nota,
      fecha_hora: `${recForm.fecha}T${recForm.hora}:00-03:00`,
      creado_por: registro.analista || 'Sistema', mostrado: false,
    });
    setPendingReminders(n => n + 1);
    setSaving(false); onClose(true);
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
            <Field label="Fecha"><input className="form-input" type="date" value={recForm.fecha} onChange={e => setRecForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
            <Field label="Hora"><input className="form-input" type="time" value={recForm.hora} onChange={e => setRecForm(p => ({ ...p, hora: e.target.value }))} /></Field>
          </div>
          <Field label="Nota"><textarea className="form-textarea" value={recForm.nota} onChange={e => setRecForm(p => ({ ...p, nota: e.target.value }))} /></Field>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => onClose(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving}>Agendar</button>
        </div>
      </div>
    </div>
  );
});

// ── Modal: Confirmar borrado ──────────────────────────────────────────────────

const DeleteModal = memo(function DeleteModal({
  registro, onConfirm, onCancel,
}: { registro: Registro | null; onConfirm: () => void; onCancel: () => void }) {
  if (!registro) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: '#f87171' }}>Eliminar registro</h3>
          <button className="btn-icon" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: '#aaa', lineHeight: 1.7 }}>
            ¿Eliminar a <strong style={{ color: '#fff' }}>{registro.nombre}</strong>?<br />
            <span style={{ fontSize: '12px', color: '#555' }}>Esta acción no se puede deshacer.</span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }} onClick={onConfirm}>
            <Trash2 size={14} /> Eliminar
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
      color: 'rgba(255,255,255,0.55)',
      border: '1px solid rgba(255,255,255,0.07)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegistrosPage() {
  const { isAdmin }  = useAuth();
  const { registros, setRegistros, loading, refresh } = useData();
  const {
    filters, setFilter, limpiarFiltros, hayFiltros,
    isCreationModalOpen, setIsCreationModalOpen,
    pageSize, triggerExport, exportTick,
    currentPage, setCurrentPage, setTotalResults,
  } = useFilter();

  const [toast,               setToast]               = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [modalOpen,           setModalOpen]           = useState(false);
  const [editingId,           setEditingId]           = useState<string | null>(null);
  const [modalInitialData,    setModalInitialData]    = useState<Partial<Registro>>(initialForm);
  const [recordatorioTarget,  setRecordatorioTarget]  = useState<Registro | null>(null);
  const [deleteTarget,        setDeleteTarget]        = useState<Registro | null>(null);
  const [showAdvanced,        setShowAdvanced]        = useState(false);

  const fetchRegistros = useCallback((silent = false) => { refresh(silent); }, [refresh]);

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
      const mSearch   = !filters.search   || r.nombre?.toLowerCase().includes(s) || r.cuil?.toLowerCase().includes(s) || r.analista?.toLowerCase().includes(s);
      const mEstado   = !filters.estado   || r.estado === filters.estado;
      const mAnalista = !filters.analista || r.analista === filters.analista;
      const mDesde    = !filters.fechaDesde || (r.fecha && r.fecha >= filters.fechaDesde);
      const mHasta    = !filters.fechaHasta || (r.fecha && r.fecha <= filters.fechaHasta);
      const mMin      = !filters.montoMin  || Number(r.monto) >= Number(filters.montoMin);
      const mMax      = !filters.montoMax  || Number(r.monto) <= Number(filters.montoMax);
      const mScoreMin = !filters.scoreMin  || (r.puntaje != null && Number(r.puntaje) >= Number(filters.scoreMin));
      const mScoreMax = !filters.scoreMax  || (r.puntaje != null && Number(r.puntaje) <= Number(filters.scoreMax));
      const mRe       = !filters.esRe     || (filters.esRe === 'si' ? r.es_re : !r.es_re);
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

  const openNew  = useCallback(() => { setEditingId(null); setModalInitialData({ ...initialForm }); setModalOpen(true); }, []);
  const openEdit = useCallback((reg: Registro) => {
    setEditingId(reg.id);
    setModalInitialData({ ...reg, fecha: reg.fecha || '', fecha_score: reg.fecha_score || '' });
    setModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await supabase.from('registros').delete().eq('id', id);
    setRegistros(prev => prev.filter(r => r.id !== id));
    showToast('Registro eliminado', 'success');
  }, [deleteTarget, showToast, setRegistros]);

  const applyOptimistic = useCallback((reg: Registro) => {
    setRegistros(prev => {
      const idx = prev.findIndex(r => r.id === reg.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = reg; return next; }
      return [reg, ...prev];
    });
  }, [setRegistros]);

  const handleSaved = useCallback((reg: Registro) => {
    applyOptimistic(reg);
    showToast(registros.some(r => r.id === reg.id) ? 'Registro actualizado' : 'Registro creado', 'success');
    fetchRegistros(true);
  }, [applyOptimistic, registros, fetchRegistros, showToast]);

  const handleSavedWithRecordatorio = useCallback((reg: Registro) => {
    applyOptimistic(reg);
    showToast('Guardado', 'success');
    fetchRegistros(true);
    setRecordatorioTarget(reg);
  }, [applyOptimistic, fetchRegistros, showToast]);

  const handleRecordatorioClose = useCallback((saved: boolean) => {
    setRecordatorioTarget(null);
    if (saved) showToast('Recordatorio agendado', 'success');
  }, [showToast]);

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd   = Math.min(currentPage * pageSize, filteredRegistros.length);

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

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Registros</h1>
          {!loading && (
            <span style={{ fontSize: 12, color: '#444', fontWeight: 700 }}>
              {filteredRegistros.length.toLocaleString('es-AR')} resultado{filteredRegistros.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={exportarCSV} style={{ height: 34, fontSize: 12 }}>
            <Download size={13} /> Exportar
          </button>
          <button className="btn-primary" onClick={openNew} style={{ height: 34, fontSize: 12 }}>
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        background: '#000', border: '1px solid var(--border-color)',
        borderRadius: 6, padding: '12px 16px', marginBottom: 12,
      }}>
        {/* Main filters row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Search */}
          <div className="search-wrapper" style={{ flex: 1, maxWidth: 280 }}>
            <Search className="search-icon" size={14} />
            <input
              type="text" className="search-input"
              placeholder="Buscar nombre, CUIL, analista…"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              style={{ height: 34, fontSize: 13 }}
            />
          </div>

          {/* Estado */}
          <select
            className="form-select"
            value={filters.estado}
            onChange={e => setFilter('estado', e.target.value)}
            style={{ width: 150, height: 34, fontSize: 12 }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(st => <option key={st} value={st}>{STATUS_CONFIG[st]?.label ?? st}</option>)}
          </select>

          {/* Analista */}
          <select
            className="form-select"
            value={filters.analista}
            onChange={e => setFilter('analista', e.target.value)}
            style={{ width: 130, height: 34, fontSize: 12 }}
          >
            <option value="">Todos</option>
            {ANALISTAS.map(an => <option key={an} value={an}>{an}</option>)}
          </select>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(p => !p)}
            className="btn-secondary"
            style={{ height: 34, fontSize: 12, borderColor: showAdvanced ? 'rgba(255,255,255,0.3)' : undefined }}
          >
            <Filter size={13} />
            Filtros
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Clear filters */}
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="btn-icon" style={{ color: '#f87171', width: 34, height: 34 }} title="Limpiar filtros">
              <X size={15} />
            </button>
          )}

          {/* Pagination — pushed right */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#444', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {filteredRegistros.length === 0 ? '—' : `${rangeStart}–${rangeEnd} de ${filteredRegistros.length}`}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-icon"
                style={{ width: 28, height: 28 }}
              ><ChevronLeft size={15} /></button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="btn-icon"
                style={{ width: 28, height: 28 }}
              ><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10,
            marginTop: 12, paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            {[
              { label: 'Desde',     type: 'date',   key: 'fechaDesde', placeholder: '' },
              { label: 'Hasta',     type: 'date',   key: 'fechaHasta', placeholder: '' },
              { label: 'Monto mín', type: 'number', key: 'montoMin',   placeholder: '$' },
              { label: 'Monto máx', type: 'number', key: 'montoMax',   placeholder: '$' },
              { label: 'Score mín', type: 'number', key: 'scoreMin',   placeholder: '0' },
              { label: 'Score máx', type: 'number', key: 'scoreMax',   placeholder: '999' },
            ].map(f => (
              <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 10 }}>{f.label}</label>
                <input
                  type={f.type}
                  className="form-input"
                  placeholder={f.placeholder}
                  value={(filters as any)[f.key]}
                  onChange={e => setFilter(f.key as any, e.target.value)}
                  style={{ height: 32, fontSize: 12 }}
                />
              </div>
            ))}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Tipo</label>
              <select className="form-select" value={filters.esRe} onChange={e => setFilter('esRe', e.target.value)} style={{ height: 32, fontSize: 12 }}>
                <option value="">Todos</option>
                <option value="si">Solo RE</option>
                <option value="no">Sin RE</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: '#000', border: '1px solid var(--border-color)',
        borderRadius: 6, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 16 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 12, color: '#444' }}>Cargando registros…</span>
          </div>
        ) : filteredRegistros.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 10 }}>
            <span style={{ fontSize: 28 }}>—</span>
            <p style={{ fontSize: 13, color: '#444' }}>No hay registros que coincidan</p>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="btn-secondary" style={{ height: 32, fontSize: 12, marginTop: 4 }}>
                <X size={12} /> Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Cliente', 'Analista', 'Fecha', 'Score', 'Monto', 'Estado', 'Tipo', 'Acuerdo', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 16px',
                    fontSize: 10, fontWeight: 700,
                    color: '#444',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    textAlign: i === 3 || i === 4 ? 'right' : i === 8 ? 'center' : 'left',
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
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.1s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Cliente */}
                    <td style={{ padding: '12px 16px', minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{reg.nombre}</span>
                            {reg.es_re && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,120,212,0.15)', color: '#60a5fa', border: '1px solid rgba(0,120,212,0.3)', letterSpacing: '0.3px' }}>RE</span>
                            )}
                          </div>
                          {reg.cuil && <div style={{ fontSize: 11, color: '#333', marginTop: 1 }}>{reg.cuil}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Analista */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>
                      {displayAnalista(reg.analista)}
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>
                      {formatDate(reg.fecha)}
                    </td>

                    {/* Score */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {reg.puntaje ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                          {reg.puntaje}
                        </span>
                      ) : (
                        <span style={{ color: '#222', fontSize: 13 }}>—</span>
                      )}
                    </td>

                    {/* Monto */}
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatCurrency(Number(reg.monto))}
                    </td>

                    {/* Estado */}
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge estado={reg.estado} />
                    </td>

                    {/* Tipo */}
                    <td style={{ padding: '12px 16px', fontSize: 12, color: reg.tipo_cliente ? '#888' : '#222' }}>
                      {reg.tipo_cliente || '—'}
                    </td>

                    {/* Acuerdo */}
                    <td style={{ padding: '12px 16px', fontSize: 11, color: reg.acuerdo_precios ? '#666' : '#222', textTransform: reg.acuerdo_precios ? 'uppercase' : 'none', letterSpacing: reg.acuerdo_precios ? '0.4px' : 0 }}>
                      {reg.acuerdo_precios || '—'}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <button
                          className="btn-icon"
                          style={{ width: 30, height: 30, color: '#444' }}
                          title="Recordatorio"
                          onClick={() => setRecordatorioTarget(reg)}
                        ><Bell size={14} /></button>
                        <button
                          className="btn-icon"
                          style={{ width: 30, height: 30, color: '#444' }}
                          title="Editar"
                          onClick={() => openEdit(reg)}
                        ><Edit2 size={14} /></button>
                        <button
                          className="btn-icon"
                          style={{ width: 30, height: 30, color: 'rgba(239,68,68,0.4)' }}
                          title="Eliminar"
                          onClick={() => setDeleteTarget(reg)}
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
