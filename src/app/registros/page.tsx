'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, capitalizarNombre, sanitizarCuil } from '@/lib/utils';
import { Registro } from '@/types';
import { Search, Plus, Edit2, Trash2, X, Save, AlertCircle, AlertTriangle, Bell, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ESTADOS = [
  'proyeccion', 'venta', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc'
];
const ANALISTAS = ['Luciana', 'Victoria'];
const ESTADOS_PERMITIDOS_DUPLICADO = ['venta', 'derivado / aprobado cc'];

const initialForm: Partial<Registro> = {
  cuil: '', nombre: '', puntaje: 0, es_re: false,
  analista: '', fecha: '', fecha_score: '', monto: 0,
  estado: 'proyeccion', comentarios: ''
};

// Regex para nombres: solo letras (incluyendo acentos y ñ), espacios, comas y guiones
const REGEX_NOMBRE = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ,.\s-]+$/;

// ── Validación — isAdmin bypasea todas las reglas ──
function validarForm(form: Partial<Registro>, isAdmin: boolean): Record<string, string> {
  if (isAdmin) return {}; // admin no tiene restricciones
  const errs: Record<string, string> = {};

  if (!form.nombre?.trim()) {
    errs.nombre = 'Nombre es requerido';
  } else if (form.nombre.trim().length < 2) {
    errs.nombre = 'Mínimo 2 caracteres';
  } else if (!REGEX_NOMBRE.test(form.nombre.trim())) {
    errs.nombre = 'Solo letras — sin números ni símbolos';
  }

  if (form.cuil?.trim()) {
    if (form.cuil.length !== 11) errs.cuil = 'CUIL debe tener exactamente 11 dígitos';
  }

  if (!form.analista) errs.analista = 'Seleccioná un analista';
  if (!form.fecha) errs.fecha = 'Fecha es requerida';
  if (!form.monto || Number(form.monto) <= 0) errs.monto = 'Monto debe ser mayor a 0';
  if (form.puntaje !== undefined && form.puntaje !== null) {
    if (Number(form.puntaje) < 0 || Number(form.puntaje) > 999) errs.puntaje = 'Puntaje: 0 - 999';
  }
  return errs;
}

// ── Componente de campo con error ──
const Field = ({
  label, error, children
}: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="form-group">
    <label className="form-label">{label} {error && <span style={{ color: 'var(--rojo)', fontWeight: 400 }}>— {error}</span>}</label>
    {children}
    {error && <div style={{ fontSize: '11px', color: 'var(--rojo)', marginTop: '4px' }}>{error}</div>}
  </div>
);

// ── Modal de Registro (componente aislado con estado propio) ──
const RegistroModal = memo(function RegistroModal({
  isOpen, editingId, initialData, onClose, onSaved, isAdmin
}: {
  isOpen: boolean;
  editingId: string | null;
  initialData: Partial<Registro>;
  onClose: () => void;
  onSaved: () => void;
  isAdmin: boolean;
}) {
  const [form, setForm] = useState<Partial<Registro>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicado, setDuplicado] = useState<Registro | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);

  // Sincroniza form cuando cambian los datos iniciales (al abrir)
  useEffect(() => {
    if (isOpen) {
      setForm(initialData);
      setErrors({});
      setDuplicado(null);
      setShowDupModal(false);
    }
  }, [isOpen, initialData]);

  const set = (field: keyof Registro, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  // Verifica duplicado con UNA sola query (OR entre cuil y nombre)
  const verificarDuplicado = async (): Promise<Registro | null> => {
    const cuil = form.cuil?.trim() || '';
    const nombre = form.nombre?.trim() || '';
    if (!cuil && !nombre) return null;

    const conditions: string[] = [];
    if (cuil.replace(/\D/g, '').length === 11) conditions.push(`cuil.eq.${cuil}`);
    if (nombre.length >= 2) conditions.push(`nombre.ilike.${nombre}`);
    if (conditions.length === 0) return null;

    const { data } = await supabase
      .from('registros')
      .select('*')
      .or(conditions.join(','))
      .limit(5);

    if (!data) return null;
    for (const reg of data) {
      if (reg.id === editingId) continue;
      if (!ESTADOS_PERMITIDOS_DUPLICADO.includes(reg.estado?.toLowerCase())) return reg;
    }
    return null;
  };

  const guardar = async (forzar = false) => {
    const errs = validarForm(form, isAdmin);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Solo verifica duplicados al crear
    if (!editingId && !forzar) {
      const dup = await verificarDuplicado();
      if (dup) {
        setDuplicado(dup);
        setShowDupModal(true);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        cuil: form.cuil?.trim() || '',
        nombre: form.nombre?.trim() || '',
        puntaje: Number(form.puntaje) || 0,
        es_re: !!form.es_re,
        analista: form.analista || '',
        fecha: form.fecha || null,
        fecha_score: form.fecha_score || null,
        monto: Number(form.monto) || 0,
        estado: (form.estado || 'proyeccion').toLowerCase(),
        comentarios: form.comentarios?.trim() || '',
      };

      if (editingId) {
        const { error } = await supabase.from('registros').update(payload).eq('id', editingId);
        if (error) throw error;
        await supabase.from('auditoria').insert({
          id_registro: payload.cuil || editingId, analista: payload.analista,
          accion: 'Modificación', campo_modificado: 'Actualización', valor_anterior: '',
          valor_nuevo: `Estado: ${payload.estado} | Monto: ${formatCurrency(payload.monto)}`,
          id_analista: payload.analista,
        });
      } else {
        const { error } = await supabase.from('registros').insert(payload);
        if (error) throw error;
        await supabase.from('auditoria').insert({
          id_registro: payload.cuil || '', analista: payload.analista,
          accion: 'Creación', campo_modificado: 'Nuevo Registro', valor_anterior: '',
          valor_nuevo: `Monto: ${formatCurrency(payload.monto)} | Estado: ${payload.estado}`,
          id_analista: payload.analista,
        });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrors({ _global: msg });
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  const inputBorder = (field: string) =>
    errors[field] ? '1px solid var(--rojo)' : undefined;

  return (
    <>
      {/* Modal principal */}
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 className="modal-title">{editingId ? 'Editar Registro' : 'Nuevo Registro'}</h3>
              {isAdmin && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: '#f7e479',
                  background: 'rgba(247,228,121,0.1)', border: '1px solid rgba(247,228,121,0.2)',
                  borderRadius: '6px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.5px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <ShieldCheck size={10} /> Admin
                </span>
              )}
            </div>
            <button className="btn-icon" onClick={onClose}><X size={20} style={{ color: '#888' }} /></button>
          </div>

          <div className="modal-body">
            {errors._global && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.2)',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
                fontSize: '13px', color: 'var(--rojo)',
              }}>
                <AlertCircle size={14} /> {errors._global}
              </div>
            )}

            <div className="form-row">
              <Field label="CUIL" error={errors.cuil}>
                <input
                  className="form-input"
                  placeholder="Solo números — 11 dígitos"
                  inputMode="numeric"
                  maxLength={11}
                  style={{ borderColor: errors.cuil ? 'var(--rojo)' : undefined, letterSpacing: '2px' }}
                  value={form.cuil || ''}
                  onKeyDown={e => {
                    // Bloquea letras, guiones y cualquier caracter no numérico
                    // Permite: dígitos, Backspace, Delete, Tab, Enter, flechas, Ctrl/Cmd combos
                    const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                    if (!allowed.includes(e.key) && !/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                    }
                  }}
                  onChange={e => set('cuil', sanitizarCuil(e.target.value))}
                />
              </Field>
              <Field label="Nombre *" error={errors.nombre}>
                <input
                  className="form-input"
                  placeholder="Nombre del cliente"
                  style={{ border: inputBorder('nombre') }}
                  value={form.nombre || ''}
                  onChange={e => set('nombre', capitalizarNombre(e.target.value))}
                  autoFocus
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Analista *" error={errors.analista}>
                <select
                  className="form-select"
                  style={{ border: inputBorder('analista') }}
                  value={form.analista || ''}
                  onChange={e => set('analista', e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select
                  className="form-select"
                  value={form.estado || 'proyeccion'}
                  onChange={e => set('estado', e.target.value)}
                >
                  {ESTADOS.map(e => <option key={e} value={e}>{getStatusLabel(e)}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <Field label="Monto *" error={errors.monto}>
                <input
                  className="form-input"
                  type="number"
                  placeholder="0"
                  min="1"
                  style={{ border: inputBorder('monto') }}
                  value={form.monto || ''}
                  onChange={e => set('monto', Number(e.target.value))}
                />
              </Field>
              <Field label="Puntaje" error={errors.puntaje}>
                <input
                  className="form-input"
                  type="number"
                  placeholder="0"
                  min="0"
                  max="999"
                  style={{ border: inputBorder('puntaje') }}
                  value={form.puntaje || ''}
                  onChange={e => set('puntaje', Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Fecha *" error={errors.fecha}>
                <input
                  className="form-input"
                  type="date"
                  style={{ border: inputBorder('fecha') }}
                  value={form.fecha || ''}
                  onChange={e => set('fecha', e.target.value)}
                />
              </Field>
              <div className="form-group">
                <label className="form-label">Fecha Score</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.fecha_score || ''}
                  onChange={e => set('fecha_score', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Comentarios</label>
              <textarea
                className="form-textarea"
                placeholder="Observaciones..."
                value={form.comentarios || ''}
                onChange={e => set('comentarios', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={!!form.es_re}
                  onChange={e => set('es_re', e.target.checked)}
                />
                <span style={{ fontSize: '14px' }}>Es RE (Refinanciamiento)</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={() => guardar(false)} disabled={saving}>
              {saving
                ? <div className="spinner" style={{ width: 16, height: 16 }} />
                : <Save size={16} />
              }
              {editingId ? 'Guardar Cambios' : 'Crear Registro'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal duplicado */}
      {showDupModal && duplicado && (
        <div className="modal-overlay" onClick={() => setShowDupModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(220,53,69,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--naranja)' }} />
                <h3 className="modal-title" style={{ color: 'var(--naranja)' }}>Duplicado Detectado</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowDupModal(false)}>
                <X size={20} style={{ color: '#888' }} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
                Ya existe un registro con estos datos. ¿Querés crear uno nuevo de todas formas?
              </p>
              <div style={{ background: 'rgba(255,193,7,0.05)', border: '1px solid rgba(255,193,7,0.15)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Registro existente:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#888' }}>
                  <div><strong style={{ color: '#fff' }}>Nombre:</strong> {duplicado.nombre}</div>
                  <div><strong style={{ color: '#fff' }}>CUIL:</strong> {duplicado.cuil}</div>
                  <div><strong style={{ color: '#fff' }}>Estado:</strong> <span style={{ color: getStatusColor(duplicado.estado) }}>{getStatusLabel(duplicado.estado)}</span></div>
                  <div><strong style={{ color: '#fff' }}>Monto:</strong> {formatCurrency(Number(duplicado.monto))}</div>
                  <div><strong style={{ color: '#fff' }}>Analista:</strong> {duplicado.analista}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDupModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--naranja)', color: '#000' }}
                onClick={() => { setShowDupModal(false); guardar(true); }}
              >
                Crear de Todas Formas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// ── Modal de Recordatorio (componente aislado) ──
const RecordatorioModal = memo(function RecordatorioModal({
  registro, onClose
}: {
  registro: Registro | null;
  onClose: (saved: boolean) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [recForm, setRecForm] = useState({
    nota: '',
    fecha: tomorrow.toISOString().split('T')[0],
    hora: '09:00',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (registro) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      setRecForm({ nota: '', fecha: t.toISOString().split('T')[0], hora: '09:00' });
      setError('');
    }
  }, [registro]);

  if (!registro) return null;

  const save = async () => {
    if (!recForm.fecha) { setError('Fecha es requerida'); return; }
    setSaving(true);
    const fechaHora = `${recForm.fecha}T${recForm.hora || '09:00'}:00`;
    const { error: err } = await supabase.from('recordatorios').insert({
      registro_id: registro.id,
      nombre: registro.nombre,
      cuil: registro.cuil,
      analista: registro.analista,
      estado: registro.estado,
      nota: recForm.nota,
      fecha_hora: fechaHora,
      creado_por: registro.analista || 'Sistema',
      mostrado: false,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onClose(true);
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} style={{ color: 'var(--azul)' }} />
            <h3 className="modal-title">Agendar Recordatorio</h3>
          </div>
          <button className="btn-icon" onClick={() => onClose(false)}>
            <X size={20} style={{ color: '#888' }} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(23,162,184,0.05)', border: '1px solid rgba(23,162,184,0.15)', borderRadius: '12px', padding: '12px', fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            <strong style={{ color: '#fff' }}>{registro.nombre}</strong>
            {registro.cuil && <span style={{ marginLeft: '8px' }}>— {registro.cuil}</span>}
          </div>
          {error && (
            <div style={{ fontSize: '13px', color: 'var(--rojo)', marginBottom: '12px' }}>{error}</div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input className="form-input" type="date"
                value={recForm.fecha}
                onChange={e => setRecForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora</label>
              <input className="form-input" type="time"
                value={recForm.hora}
                onChange={e => setRecForm(p => ({ ...p, hora: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nota</label>
            <textarea className="form-textarea" placeholder="Descripción del recordatorio..."
              value={recForm.nota}
              onChange={e => setRecForm(p => ({ ...p, nota: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => onClose(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving
              ? <div className="spinner" style={{ width: 16, height: 16 }} />
              : <Bell size={16} />
            }
            Agendar
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Página principal ──
export default function RegistrosPage() {
  const { isAdmin } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Modal registro
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalInitialData, setModalInitialData] = useState<Partial<Registro>>(initialForm);

  // Modal recordatorio
  const [recordatorioTarget, setRecordatorioTarget] = useState<Registro | null>(null);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(2000);
    if (!error && data) setRegistros(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
  }, []);

  // Filtrado memoizado — no recalcula en cada render
  const filteredRegistros = useMemo(() => registros.filter(r => {
    const matchSearch = !search ||
      r.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      r.cuil?.toLowerCase().includes(search.toLowerCase()) ||
      r.analista?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || r.estado === filtroEstado;
    const matchAnalista = !filtroAnalista || r.analista === filtroAnalista;
    return matchSearch && matchEstado && matchAnalista;
  }), [registros, search, filtroEstado, filtroAnalista]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setModalInitialData({ ...initialForm });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((reg: Registro) => {
    setEditingId(reg.id);
    setModalInitialData({
      cuil: reg.cuil, nombre: reg.nombre, puntaje: reg.puntaje,
      es_re: reg.es_re, analista: reg.analista,
      fecha: reg.fecha || '', fecha_score: reg.fecha_score || '',
      monto: reg.monto, estado: reg.estado, comentarios: reg.comentarios,
    });
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (reg: Registro) => {
    if (!confirm(`¿Eliminar registro de ${reg.nombre}?`)) return;
    const { error } = await supabase.from('registros').delete().eq('id', reg.id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await supabase.from('auditoria').insert({
      id_registro: reg.cuil || reg.id, analista: reg.analista || '',
      accion: 'Eliminación', campo_modificado: 'Registro Eliminado',
      valor_anterior: `${reg.nombre} | ${formatCurrency(reg.monto)}`,
      valor_nuevo: '', id_analista: reg.analista || '',
    });
    showToast('Registro eliminado', 'success');
    fetchRegistros();
  }, [fetchRegistros, showToast]);

  const handleSaved = useCallback(() => {
    showToast(editingId ? 'Registro actualizado' : 'Registro creado', 'success');
    fetchRegistros();
  }, [editingId, fetchRegistros, showToast]);

  const handleRecordatorioClose = useCallback((saved: boolean) => {
    setRecordatorioTarget(null);
    if (saved) showToast('Recordatorio agendado', 'success');
  }, [showToast]);

  return (
    <div className="dashboard-container">
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
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Gestión de Clientes</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            {loading ? 'Cargando...' : `${filteredRegistros.length} registros`}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={18} /> Nuevo Registro
        </button>
      </header>

      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por CUIL, Nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select className="form-select" style={{ minWidth: '150px' }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{getStatusLabel(e)}</option>)}
          </select>
          <select className="form-select" style={{ minWidth: '140px' }}
            value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}>
            <option value="">Todos los analistas</option>
            {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="data-card">
        {loading ? (
          <div className="loading-container"><div className="spinner" /><span>Cargando registros...</span></div>
        ) : filteredRegistros.length === 0 ? (
          <div className="empty-state">
            <p>No hay datos para mostrar</p>
            <p>Creá un nuevo registro o ajustá los filtros.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Cliente / CUIL</th>
                <th style={{ textAlign: 'center' }}>Analista</th>
                <th style={{ textAlign: 'center' }}>Fecha</th>
                <th style={{ textAlign: 'center' }}>Fecha Score</th>
                <th style={{ textAlign: 'center' }}>Monto</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistros.map(reg => (
                <tr key={reg.id}>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{reg.nombre}</div>
                    {reg.cuil && <div style={{ fontSize: '11px', color: '#555' }}>CUIL: {reg.cuil}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{reg.analista || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{formatDate(reg.fecha)}</td>
                  <td style={{ textAlign: 'center', color: '#888' }}>{reg.fecha_score ? formatDate(reg.fecha_score) : <span style={{ color: '#333' }}>—</span>}</td>
                  <td style={{ fontWeight: 700, fontSize: '15px', color: '#fff', textAlign: 'center' }}>{formatCurrency(Number(reg.monto))}</td>
                  <td style={{ textAlign: 'center' }}>
                    {reg.puntaje ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <div style={{ 
                          width: 6, height: 6, borderRadius: '50%', 
                          background: reg.puntaje >= 700 ? '#3b82f6' : reg.puntaje >= 600 ? '#4ade80' : reg.puntaje >= 500 ? '#fbbf24' : '#ef4444' 
                        }} />
                        <span style={{ fontSize: '13px', color: '#ccc' }}>{reg.puntaje}</span>
                      </div>
                    ) : (
                      <span style={{ color: '#444' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="status-badge" style={{ color: getStatusColor(reg.estado) }}>
                      {getStatusLabel(reg.estado)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button className="btn-icon" onClick={() => openEdit(reg)} title="Editar">
                        <Edit2 size={16} style={{ color: '#555' }} />
                      </button>
                      <button className="btn-icon" onClick={() => setRecordatorioTarget(reg)} title="Recordatorio">
                        <Bell size={16} style={{ color: '#555' }} />
                      </button>
                      {isAdmin && (
                        <button className="btn-icon btn-danger" onClick={() => handleDelete(reg)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales aislados — no re-renderizan la tabla */}
      <RegistroModal
        isOpen={modalOpen}
        editingId={editingId}
        initialData={modalInitialData}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        isAdmin={isAdmin}
      />

      <RecordatorioModal
        registro={recordatorioTarget}
        onClose={handleRecordatorioClose}
      />
    </div>
  );
}
