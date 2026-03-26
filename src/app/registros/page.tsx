'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, capitalizarNombre, sanitizarCuil, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { Search, Plus, Edit2, Trash2, X, Save, AlertCircle, AlertTriangle, Bell, ShieldCheck, ChevronLeft, ChevronRight, Filter, Download, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

const ESTADOS = [
  'proyeccion', 'venta', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc'
];
const ANALISTAS = ['Luciana', 'Victoria'];
const ESTADOS_PERMITIDOS_DUPLICADO = ['venta', 'derivado / aprobado cc'];

const initialForm: Partial<Registro> = {
  cuil: '', nombre: '', puntaje: 0, es_re: false,
  analista: ANALISTAS[0], fecha: '', fecha_score: '', monto: 0,
  estado: 'proyeccion', comentarios: ''
};

// Regex para nombres
const REGEX_NOMBRE = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]+$/;

// ── Validación ──
function validarForm(form: Partial<Registro>, isAdmin: boolean): Record<string, string> {
  if (isAdmin) return {}; 
  const errs: Record<string, string> = {};
  if (!form.nombre?.trim()) {
    errs.nombre = 'Nombre es requerido';
  } else if (form.nombre.trim().length < 2) {
    errs.nombre = 'Mínimo 2 caracteres';
  } else if (!REGEX_NOMBRE.test(form.nombre.trim())) {
    errs.nombre = 'Solo letras';
  }
  if (form.cuil?.trim() && form.cuil.length !== 11) errs.cuil = 'CUIL: 11 dígitos';
  if (!form.analista) errs.analista = 'Analista requerido';
  if (!form.fecha) errs.fecha = 'Fecha requerida';
  if (!form.monto || Number(form.monto) <= 0) errs.monto = 'Monto > 0';
  return errs;
}

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="form-group">
    <label className="form-label">{label} {error && <span style={{ color: 'var(--rojo)' }}>— {error}</span>}</label>
    {children}
  </div>
);

// ── Modal de Registro ──
const RegistroModal = memo(function RegistroModal({
  isOpen, editingId, initialData, onClose, onSaved, onSavedWithRecordatorio, isAdmin
}: {
  isOpen: boolean; editingId: string | null; initialData: Partial<Registro>; onClose: () => void; onSaved: (reg: Registro) => void; onSavedWithRecordatorio?: (registro: Registro) => void; isAdmin: boolean;
}) {
  const [form, setForm] = useState<Partial<Registro>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicado, setDuplicado] = useState<Registro | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);
  const [agendarRecordatorio, setAgendarRecordatorio] = useState(false);

  useEffect(() => {
    if (isOpen) { setForm(initialData); setErrors({}); setDuplicado(null); setShowDupModal(false); setAgendarRecordatorio(false); }
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

  const guardar = async (forzar = false) => {
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
      if (agendarRecordatorio && onSavedWithRecordatorio) {
        onSavedWithRecordatorio(savedReg);
      } else {
        onSaved(savedReg);
      }
    } else {
      const { data: newReg, error } = await supabase.from('registros').insert(payload).select().single();
      if (error) { setErrors({ _: error.message }); setSaving(false); return; }
      onClose();
      if (agendarRecordatorio && onSavedWithRecordatorio && newReg) {
        onSavedWithRecordatorio(newReg as Registro);
      } else {
        onSaved(newReg as Registro);
      }
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editingId ? 'Editar' : 'Nuevo'} Registro</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <Field label="CUIL" error={errors.cuil}><input className="form-input" value={form.cuil || ''} onChange={e => set('cuil', isAdmin ? e.target.value : sanitizarCuil(e.target.value))} inputMode="numeric" /></Field>
            <Field label="Nombre *" error={errors.nombre}><input className="form-input" value={form.nombre || ''} onChange={e => set('nombre', isAdmin ? e.target.value : capitalizarNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]/g, '')))} autoFocus /></Field>
          </div>
          <div className="form-row">
            <Field label="Analista *"><select className="form-select" value={form.analista || ANALISTAS[0]} onChange={e => set('analista', e.target.value)}>{ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}</select></Field>
            <Field label="Estado"><select className="form-select" value={form.estado || 'proyeccion'} onChange={e => set('estado', e.target.value)}>{ESTADOS.map(e => <option key={e} value={e}>{getStatusLabel(e)}</option>)}</select></Field>
          </div>
          <div className="form-row">
            <Field label="Monto *"><input className="form-input" type="number" value={form.monto || ''} onChange={e => set('monto', e.target.value)} /></Field>
            <Field label="Fecha *"><input className="form-input" type="date" value={form.fecha || ''} onChange={e => set('fecha', e.target.value)} /></Field>
          </div>
          <div className="form-row">
            <Field label="Fecha Score"><input className="form-input" type="date" value={form.fecha_score || ''} onChange={e => set('fecha_score', e.target.value)} /></Field>
            <Field label="Score"><input className="form-input" type="number" value={form.puntaje || ''} onChange={e => set('puntaje', Number(e.target.value))} placeholder="0" /></Field>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label className="toggle-card">
              <span className="toggle-switch">
                <input type="checkbox" checked={!!form.es_re} onChange={e => set('es_re', e.target.checked)} />
                <span className="toggle-slider" />
              </span>
              <span className="toggle-label">
                <FileText size={14} />
                Resumen Ejecutivo (RE)
              </span>
            </label>
            <label className="toggle-card">
              <span className="toggle-switch">
                <input type="checkbox" checked={agendarRecordatorio} onChange={e => setAgendarRecordatorio(e.target.checked)} />
                <span className="toggle-slider" />
              </span>
              <span className="toggle-label">
                <AlertTriangle size={14} />
                Agendar Recordatorio
              </span>
            </label>
          </div>
          <p className="modal-required-legend">Los campos marcados con * son obligatorios</p>
        </div>
        <div className="modal-footer">
          {errors._ && <span style={{ color: 'var(--rojo)', fontSize: '13px', flex: 1 }}>{errors._}</span>}
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => guardar(false)} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
});

// ── Modal de Recordatorio ──
const RecordatorioModal = memo(function RecordatorioModal({ registro, onClose }: { registro: Registro | null; onClose: (saved: boolean) => void; }) {
  const [recForm, setRecForm] = useState({ nota: '', fecha: '', hora: '09:00' });
  const [saving, setSaving] = useState(false);
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
      registro_id: registro.id, nombre: registro.nombre, cuil: registro.cuil, analista: registro.analista,
      estado: registro.estado, nota: recForm.nota, fecha_hora: `${recForm.fecha}T${recForm.hora}:00`,
      creado_por: registro.analista || 'Sistema', mostrado: false,
    });
    setPendingReminders(n => n + 1);
    setSaving(false); onClose(true);
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3 className="modal-title">Recordatorio</h3><button className="btn-icon" onClick={() => onClose(false)}><X size={20} /></button></div>
        <div className="modal-body">
          <div className="form-row">
            <Field label="Fecha"><input className="form-input" type="date" value={recForm.fecha} onChange={e => setRecForm(p => ({ ...p, fecha: e.target.value }))} /></Field>
            <Field label="Hora"><input className="form-input" type="time" value={recForm.hora} onChange={e => setRecForm(p => ({ ...p, hora: e.target.value }))} /></Field>
          </div>
          <Field label="Nota"><textarea className="form-textarea" value={recForm.nota} onChange={e => setRecForm(p => ({ ...p, nota: e.target.value }))} /></Field>
        </div>
        <div className="modal-footer"><button className="btn-secondary" onClick={() => onClose(false)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={saving}>Agendar</button></div>
      </div>
    </div>
  );
});

// ── Modal de confirmación de borrado ──
const DeleteModal = memo(function DeleteModal({ registro, onConfirm, onCancel }: {
  registro: Registro | null; onConfirm: () => void; onCancel: () => void;
}) {
  if (!registro) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: '#ef4444' }}>Eliminar registro</h3>
          <button className="btn-icon" onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
          <p style={{ color: '#aaa', fontSize: '14px', lineHeight: 1.6 }}>
            ¿Eliminar a <strong style={{ color: '#fff' }}>{registro.nombre}</strong>?
            Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={onConfirm}>
            <Trash2 size={14} /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Página principal ──
export default function RegistrosPage() {
  const { isAdmin } = useAuth();
  const { registros, setRegistros, loading, refresh } = useData();
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalInitialData, setModalInitialData] = useState<Partial<Registro>>(initialForm);
  const [recordatorioTarget, setRecordatorioTarget] = useState<Registro | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Registro | null>(null);

  // Filtros Avanzados
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroMontoMin, setFiltroMontoMin] = useState('');
  const [filtroMontoMax, setFiltroMontoMax] = useState('');
  const [filtroScoreMin, setFiltroScoreMin] = useState('');
  const [filtroScoreMax, setFiltroScoreMax] = useState('');
  const [filtroEsRe, setFiltroEsRe] = useState('');

  const fetchRegistros = useCallback((silent = false) => { refresh(silent); }, [refresh]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => setToast({ message, type }), []);

  const filteredRegistros = useMemo(() => {
    const list = registros.filter(r => {
      const s = search.toLowerCase();
      const mSearch = !search || r.nombre?.toLowerCase().includes(s) || r.cuil?.toLowerCase().includes(s) || r.analista?.toLowerCase().includes(s);
      const mEstado = !filtroEstado || r.estado === filtroEstado;
      const mAnalista = !filtroAnalista || r.analista === filtroAnalista;
      const mDesde = !filtroFechaDesde || (r.fecha && r.fecha >= filtroFechaDesde);
      const mHasta = !filtroFechaHasta || (r.fecha && r.fecha <= filtroFechaHasta);
      const mMin = !filtroMontoMin || (Number(r.monto) >= Number(filtroMontoMin));
      const mMax = !filtroMontoMax || (Number(r.monto) <= Number(filtroMontoMax));
      const mScoreMin = !filtroScoreMin || (r.puntaje !== null && r.puntaje !== undefined && Number(r.puntaje) >= Number(filtroScoreMin));
      const mScoreMax = !filtroScoreMax || (r.puntaje !== null && r.puntaje !== undefined && Number(r.puntaje) <= Number(filtroScoreMax));
      const mRe = !filtroEsRe || (filtroEsRe === 'si' ? r.es_re : !r.es_re);
      return mSearch && mEstado && mAnalista && mDesde && mHasta && mMin && mMax && mScoreMin && mScoreMax && mRe;
    });

    return [...list].sort((a, b) => {
      const dA = a.fecha || '';
      const dB = b.fecha || '';
      if (dA > dB) return -1;
      if (dA < dB) return 1;

      const isPriA = a.estado === 'venta' || a.estado === 'derivado / aprobado cc';
      const isPriB = b.estado === 'venta' || b.estado === 'derivado / aprobado cc';
      if (isPriA && !isPriB) return -1;
      if (!isPriA && isPriB) return 1;

      return 0;
    });
  }, [registros, search, filtroEstado, filtroAnalista, filtroFechaDesde, filtroFechaHasta, filtroMontoMin, filtroMontoMax, filtroScoreMin, filtroScoreMax, filtroEsRe]);

  const totalPages = Math.ceil(filteredRegistros.length / pageSize) || 1;
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, filtroEstado, filtroAnalista, pageSize, filtroFechaDesde, filtroFechaHasta, filtroMontoMin, filtroMontoMax, filtroEsRe, filtroScoreMin, filtroScoreMax]);

  const openNew = useCallback(() => { setEditingId(null); setModalInitialData({ ...initialForm }); setModalOpen(true); }, []);
  const openEdit = useCallback((reg: Registro) => {
    setEditingId(reg.id);
    setModalInitialData({ ...reg, fecha: reg.fecha || '', fecha_score: reg.fecha_score || '' });
    setModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setRegistros(prev => prev.filter(r => r.id !== id));
    showToast('Eliminado', 'success');
    supabase.from('registros').delete().eq('id', id);
  }, [deleteTarget, showToast]);

  const applyOptimistic = useCallback((reg: Registro) => {
    setRegistros(prev => {
      const idx = prev.findIndex(r => r.id === reg.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = reg; return next; }
      return [reg, ...prev];
    });
  }, []);

  const handleSaved = useCallback((reg: Registro) => {
    applyOptimistic(reg);
    showToast(reg.id && registros.some(r => r.id === reg.id) ? 'Actualizado' : 'Creado', 'success');
    fetchRegistros(true);
  }, [applyOptimistic, registros, fetchRegistros, showToast]);

  const handleSavedWithRecordatorio = useCallback((reg: Registro) => {
    applyOptimistic(reg);
    showToast('Guardado', 'success');
    fetchRegistros(true);
    setRecordatorioTarget(reg);
  }, [applyOptimistic, fetchRegistros, showToast]);
  const handleRecordatorioClose = useCallback((saved: boolean) => { setRecordatorioTarget(null); if (saved) showToast('Agendado', 'success'); }, [showToast]);

  const limpiarFiltros = useCallback(() => {
    setSearch('');
    setFiltroEstado('');
    setFiltroAnalista('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroMontoMin('');
    setFiltroMontoMax('');
    setFiltroScoreMin('');
    setFiltroScoreMax('');
    setFiltroEsRe('');
    setCurrentPage(1);
  }, []);

  const exportarCSV = useCallback(() => {
    const headers = ['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Puntaje', 'Es RE'];
    const rows = filteredRegistros.map(r => [r.nombre, r.cuil, r.analista, r.estado, r.monto, r.fecha || '', r.puntaje || '', r.es_re ? 'Sí' : 'No']);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `registros.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filteredRegistros]);

  const hayFiltros = search || filtroEstado || filtroAnalista || filtroFechaDesde || filtroFechaHasta || filtroMontoMin || filtroMontoMax || filtroScoreMin || filtroScoreMax || filtroEsRe;

  return (
    <div className="dashboard-container">
      {toast && <div className="toast-container"><div className={`toast ${toast.type}`}><AlertCircle size={18} /><span>{toast.message}</span></div></div>}

      <header className="dashboard-header">
        <div /> 
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="page-size-selector">
            <span className="selector-label">MOSTRAR</span>
            {[25, 50, 100, 200].map(sz => (
              <button key={sz} onClick={() => setPageSize(sz)} className={`sz-btn ${pageSize === sz ? 'active' : ''}`}>{sz}</button>
            ))}
          </div>
          <button className="btn-secondary" onClick={exportarCSV} disabled={filteredRegistros.length === 0}><Download size={16} /> Exportar</button>
          <button className="btn-primary" onClick={openNew}><Plus size={18} /> Nuevo Registro</button>
        </div>
      </header>

      <div className="toolbar-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
            <div className="search-wrapper" style={{ width: '320px' }}>
              <Search className="search-icon" size={16} />
              <input type="text" className="search-input" placeholder="Busqueda general..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select className="form-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}><option value="">Estados</option>{ESTADOS.map(st => <option key={st} value={st}>{getStatusLabel(st)}</option>)}</select>
              <select className="form-select" value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}><option value="">Analistas</option>{ANALISTAS.map(an => <option key={an} value={an}>{an}</option>)}</select>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="btn-secondary" style={{ border: showAdvanced ? '1px solid #fff' : undefined }}>
                <Filter size={14} /> Filtros {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {hayFiltros && (
                <button onClick={limpiarFiltros} className="btn-clear">
                  <X size={14} /> Limpiar filtros
                </button>
              )}
            </div>
          </div>
          <div className="pagination-controls">
            <span className="page-info">{filteredRegistros.length === 0 ? '0-0' : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredRegistros.length)}`} / {filteredRegistros.length}</span>
            <div className="page-btns">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-btn"><ChevronLeft size={16} /></button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-btn"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        {showAdvanced && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <div className="form-group"><label className="form-label">Desde</label><input type="date" className="form-input" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Hasta</label><input type="date" className="form-input" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Monto Min</label><input type="number" className="form-input" placeholder="$" value={filtroMontoMin} onChange={e => setFiltroMontoMin(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Monto Max</label><input type="number" className="form-input" placeholder="$" value={filtroMontoMax} onChange={e => setFiltroMontoMax(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Score Min</label><input type="number" className="form-input" placeholder="0" value={filtroScoreMin} onChange={e => setFiltroScoreMin(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Score Max</label><input type="number" className="form-input" placeholder="999" value={filtroScoreMax} onChange={e => setFiltroScoreMax(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={filtroEsRe} onChange={e => setFiltroEsRe(e.target.value)}><option value="">Todos</option><option value="si">Solo RE</option><option value="no">Sin RE</option></select></div>
          </div>
        )}
      </div>

      <div className="data-card" style={{ marginTop: '0' }}>
        {loading ? (
          <div className="loading-container"><div className="spinner" /><span>Cargando...</span></div>
        ) : filteredRegistros.length === 0 ? (
          <div className="empty-state"><p>No hay datos</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Cliente / CUIL</th>
                <th style={{ textAlign: 'center' }}>Analista</th>
                <th style={{ textAlign: 'center' }}>Fecha</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Monto</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRegistros.map(reg => (
                <tr key={reg.id}>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{reg.nombre}</span>
                      {reg.es_re && (
                        <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(247,228,121,0.15)', color: 'var(--main-color)', border: '1px solid rgba(247,228,121,0.3)', borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.05em' }}>RE</span>
                      )}
                    </div>
                    {reg.cuil && <div style={{ fontSize: '11px', color: '#555' }}>{reg.cuil}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{displayAnalista(reg.analista)}</td>
                  <td style={{ textAlign: 'center' }}>{formatDate(reg.fecha)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {reg.puntaje ? (
                      <div className="score-cell">
                        <div className="score-dot" style={(() => {
                          const c = reg.puntaje >= 700 ? '#3b82f6' : reg.puntaje >= 600 ? '#4ade80' : reg.puntaje >= 500 ? '#fbbf24' : '#ef4444';
                          return { background: c, color: c };
                        })()} />
                        <span>{reg.puntaje}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(Number(reg.monto))}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {getStatusLabel(reg.estado)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button className="btn-icon" style={{ color: '#fff' }} onClick={() => setRecordatorioTarget(reg)}>
                        <Bell size={16} />
                      </button>
                      <button className="btn-icon" style={{ color: '#fff' }} onClick={() => openEdit(reg)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => setDeleteTarget(reg)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RegistroModal isOpen={modalOpen} editingId={editingId} initialData={modalInitialData} isAdmin={isAdmin} onClose={() => setModalOpen(false)} onSaved={handleSaved} onSavedWithRecordatorio={handleSavedWithRecordatorio} />
      <RecordatorioModal registro={recordatorioTarget} onClose={handleRecordatorioClose} />
      <DeleteModal registro={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
