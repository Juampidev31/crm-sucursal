'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { STATUS_LABEL } from '@/lib/utils';
import { ESTADOS } from '@/context/FilterContext';
import { CONFIG } from '@/types';
import { useData } from '@/context/DataContext';
import {
  Users, AlertTriangle, Save, X, Filter, CheckCircle,
  Search, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

const ANALISTAS = CONFIG.ANALISTAS_DEFAULT;

const ACUERDOS_OPCIONES = ['Riesgo Bajo', 'Riesgo Medio', 'Premium', 'No califica'];
const TIPO_CLIENTE_OPCIONES = ['Apertura', 'Renovacion'];
const RANGOS_ETARIOS = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
const SEXOS = ['Masculino', 'Femenino', 'Otro'];
const LOCALIDADES = ['Paraná'];

interface Filtros {
  // Filtros de selección
  estados: string[];
  analistas: string[];
  scoreMin: string;
  scoreMax: string;
  acuerdoPrecios: string[];
  tipoCliente: string[];
  rangoEtario: string[];
  sexo: string[];
  localidad: string[];
  empleador: string[];
  esRe: string; // '' = todos, 'si' = solo RE, 'no' = solo no RE
  montoMin: string;
  montoMax: string;
  fechaDesde: string;
  fechaHasta: string;
  search: string;
}

interface CamposAModificar {
  estado: string;
  analista: string;
  acuerdo_precios: string;
  tipo_cliente: string;
  cuotas: string;
  rango_etario: string;
  sexo: string;
  empleador: string;
  localidad: string;
  es_re: string; // '' = no cambiar, 'si' = true, 'no' = false
  comentarios: string;
}

const EMPTY_FILTROS: Filtros = {
  estados: [], analistas: [], scoreMin: '', scoreMax: '',
  acuerdoPrecios: [], tipoCliente: [], rangoEtario: [], sexo: [],
  localidad: [], empleador: [], esRe: '', montoMin: '', montoMax: '',
  fechaDesde: '', fechaHasta: '', search: '',
};

const EMPTY_CAMPOS: CamposAModificar = {
  estado: '', analista: '', acuerdo_precios: '', tipo_cliente: '',
  cuotas: '', rango_etario: '', sexo: '', empleador: '', localidad: '',
  es_re: '', comentarios: '',
};

export default function BulkModifyTab() {
  const [filtros, setFiltros] = useState<Filtros>(EMPTY_FILTROS);
  const [campos, setCampos] = useState<CamposAModificar>(EMPTY_CAMPOS);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewIds, setPreviewIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'filter' | 'confirm' | 'done'>('filter');
  const [updating, setUpdating] = useState(false);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { pushBulkRefresh } = useData();

  // Datos para filtros dropdown
  const [allEstados, setAllEstados] = useState<string[]>([]);
  const [allAnalistas, setAllAnalistas] = useState<string[]>([]);
  const [allAcuerdos, setAllAcuerdos] = useState<string[]>([]);
  const [allTipos, setAllTipos] = useState<string[]>([]);
  const [allLocalidades, setAllLocalidades] = useState<string[]>([]);
  const [allEmpleadores, setAllEmpleadores] = useState<string[]>([]);
  const [empleadorCorreccion, setEmpleadorCorreccion] = useState<string>('');
  const [empleadoresSeleccionados, setEmpleadoresSeleccionados] = useState<string[]>([]);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [busquedaEmpleador, setBusquedaEmpleador] = useState('');

  interface VarianteEmpleador {
    normalizado: string;
    variantes: string[];
    cantidad: number;
  }

  const variantesEmpleador = useMemo((): VarianteEmpleador[] => {
    const normalizar = (nombre: string): string => {
      if (!nombre) return 'Sin dato';
      let n = nombre.toUpperCase().trim();
      n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
      n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
      n = n.replace(/\s+/g, ' ').trim();
      return n || 'Sin dato';
    };

    const map = new Map<string, Set<string>>();
    for (const e of allEmpleadores) {
      const key = normalizar(e);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(e);
    }

    const result: VarianteEmpleador[] = [];
    for (const [normalizado, variantes] of map) {
      if (mostrarTodos || variantes.size > 1) {
        result.push({ normalizado, variantes: Array.from(variantes).sort(), cantidad: variantes.size });
      }
    }
    return result.sort((a, b) => b.cantidad - a.cantidad);
  }, [allEmpleadores, mostrarTodos]);

  const variantesFiltradas = useMemo(() => {
    if (!busquedaEmpleador.trim()) return variantesEmpleador;
    const q = busquedaEmpleador.toLowerCase();
    return variantesEmpleador.filter(v =>
      v.normalizado.toLowerCase().includes(q) ||
      v.variantes.some(variant => variant.toLowerCase().includes(q))
    );
  }, [variantesEmpleador, busquedaEmpleador]);

  // Grupos con duplicados reales (más de 1 variante) — independiente de mostrarTodos
  const variantesConDuplicados = useMemo(() => {
    const normalizar = (nombre: string): string => {
      if (!nombre) return 'Sin dato';
      let n = nombre.toUpperCase().trim();
      n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
      n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
      n = n.replace(/\s+/g, ' ').trim();
      return n || 'Sin dato';
    };
    const map = new Map<string, Set<string>>();
    for (const e of allEmpleadores) {
      const key = normalizar(e);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(e);
    }
    const result: VarianteEmpleador[] = [];
    for (const [normalizado, variantes] of map) {
      if (variantes.size > 1) {
        result.push({ normalizado, variantes: Array.from(variantes).sort(), cantidad: variantes.size });
      }
    }
    return result.sort((a, b) => b.cantidad - a.cantidad);
  }, [allEmpleadores]);

  // Función para cargar datos de filtros (se puede llamar múltiples veces)
  const loadFilterData = useCallback(async () => {
    const { data } = await supabase.from('registros').select('estado,analista,acuerdo_precios,tipo_cliente,localidad,empleador');
    if (!data) return;
    setAllEstados(Array.from(new Set(data.map(r => r.estado).filter(Boolean))).sort());
    setAllAnalistas(Array.from(new Set(data.map(r => r.analista).filter(Boolean))).sort());
    setAllAcuerdos(Array.from(new Set(data.map(r => r.acuerdo_precios).filter(Boolean))).sort());
    setAllTipos(Array.from(new Set(data.map(r => r.tipo_cliente).filter(Boolean))).sort());
    setAllLocalidades(Array.from(new Set(data.map(r => r.localidad).filter(Boolean))).sort());
    setAllEmpleadores(Array.from(new Set(data.map(r => r.empleador).filter(Boolean))).sort());
  }, []);

  const corregirEmpleador = useCallback(async () => {
    if (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) {
      setToast({ message: 'Seleccioná al menos un empleador y escribí el nombre correcto', type: 'error' });
      return;
    }
    setUpdating(true);
    let actualizados = 0;
    let errores = 0;
    for (const emp of empleadoresSeleccionados) {
      const { error } = await supabase
        .from('registros')
        .update({ empleador: empleadorCorreccion.trim() })
        .eq('empleador', emp);
      if (error) errores++;
      else actualizados++;
    }
    setUpdating(false);
    if (errores > 0) {
      setToast({ message: `Actualizados ${actualizados}, ${errores} errores`, type: 'error' });
    } else {
      const correctedName = empleadorCorreccion.trim();
      const oldVariants = [...empleadoresSeleccionados];

      setToast({ message: `${actualizados} empleador(es) corregido(s)`, type: 'success' });
      setEmpleadoresSeleccionados([]);
      setEmpleadorCorreccion('');

      // Optimistic update: remove old variants, add corrected name
      setAllEmpleadores(prev => {
        const filtered = prev.filter(e => !oldVariants.includes(e));
        if (!filtered.includes(correctedName)) {
          return [...filtered, correctedName].sort();
        }
        return filtered.sort();
      });

      // Background reload for consistency + broadcast for other tabs
      pushBulkRefresh();
      loadFilterData();
    }
  }, [empleadoresSeleccionados, empleadorCorreccion, pushBulkRefresh, loadFilterData]);

  // Cargar datos al montar
  useEffect(() => {
    loadFilterData();
  }, [loadFilterData]);

  // Escuchar broadcast de bulk_refresh para refrescar datos en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel('bulk-employer-refresh')
      .on('broadcast', { event: 'bulk_refresh' }, () => {
        loadFilterData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadFilterData]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const toggleFilter = (field: keyof Filtros, value: string) => {
    setFiltros(prev => {
      const list = prev[field] as string[];
      if (!Array.isArray(list)) return prev;
      return { ...prev, [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });
  };

  const previewRecords = useCallback(async () => {
    let query = supabase.from('registros').select('id');

    // Aplicar todos los filtros
    if (filtros.estados.length > 0) query = query.in('estado', filtros.estados);
    if (filtros.analistas.length > 0) query = query.in('analista', filtros.analistas);
    if (filtros.acuerdoPrecios.length > 0) query = query.in('acuerdo_precios', filtros.acuerdoPrecios);
    if (filtros.tipoCliente.length > 0) query = query.in('tipo_cliente', filtros.tipoCliente);
    if (filtros.rangoEtario.length > 0) query = query.in('rango_etario', filtros.rangoEtario);
    if (filtros.sexo.length > 0) query = query.in('sexo', filtros.sexo);
    if (filtros.localidad.length > 0) query = query.in('localidad', filtros.localidad);
    if (filtros.empleador.length > 0) query = query.in('empleador', filtros.empleador);
    if (filtros.esRe === 'si') query = query.eq('es_re', true);
    if (filtros.esRe === 'no') query = query.eq('es_re', false);
    if (filtros.scoreMin) query = query.gte('puntaje', Number(filtros.scoreMin));
    if (filtros.scoreMax) query = query.lte('puntaje', Number(filtros.scoreMax));
    if (filtros.montoMin) query = query.gte('monto', Number(filtros.montoMin));
    if (filtros.montoMax) query = query.lte('monto', Number(filtros.montoMax));
    if (filtros.fechaDesde) query = query.gte('fecha', filtros.fechaDesde);
    if (filtros.fechaHasta) query = query.lte('fecha', filtros.fechaHasta);
    if (filtros.search) {
      const s = filtros.search.toLowerCase();
      query = query.or(`nombre.ilike.%${s}%,cuil.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) {
      setToast({ message: `Error: ${error.message}`, type: 'error' });
      return;
    }
    const ids = new Set(data.map(r => r.id));
    setPreviewIds(ids);
    setPreviewCount(ids.size);
    setStep('confirm');
  }, [filtros]);

  const handleUpdate = async () => {
    setUpdating(true);
    let updated = 0;

    // Construir el payload solo con campos que tienen valor
    const updates: Record<string, unknown> = {};
    if (campos.estado) updates.estado = campos.estado;
    if (campos.analista) updates.analista = campos.analista;
    if (campos.acuerdo_precios) updates.acuerdo_precios = campos.acuerdo_precios;
    if (campos.tipo_cliente) updates.tipo_cliente = campos.tipo_cliente;
    if (campos.cuotas) updates.cuotas = campos.cuotas;
    if (campos.rango_etario) updates.rango_etario = campos.rango_etario;
    if (campos.sexo) updates.sexo = campos.sexo;
    if (campos.empleador) updates.empleador = campos.empleador;
    if (campos.localidad) updates.localidad = campos.localidad;
    if (campos.es_re === 'si') updates.es_re = true;
    if (campos.es_re === 'no') updates.es_re = false;
    if (campos.comentarios) updates.comentarios = campos.comentarios;

    if (Object.keys(updates).length === 0) {
      setToast({ message: 'Debes seleccionar al menos un campo para modificar', type: 'error' });
      setUpdating(false);
      return;
    }

    // Usar update masivo con .in() en lugar de uno por uno
    const idArray = Array.from(previewIds);
    // Supabase tiene límite de ~2000 IDs en un .in(), hacer en batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < idArray.length; i += BATCH_SIZE) {
      const batch = idArray.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('registros')
        .update(updates)
        .in('id', batch);
      if (!error) updated += batch.length;
    }

    setUpdating(false);
    setUpdatedCount(updated);
    setStep('done');
    // Notificar a todos los clientes que refresquen sus datos
    pushBulkRefresh();
  };

  const resetAll = () => {
    setFiltros(EMPTY_FILTROS);
    setCampos(EMPTY_CAMPOS);
    setPreviewCount(0);
    setPreviewIds(new Set());
    setStep('filter');
    setUpdatedCount(0);
  };

  const chipStyle = (isActive: boolean) => ({
    padding: '5px 10px', borderRadius: '5px', fontSize: '10px', border: '1px solid',
    whiteSpace: 'nowrap' as const, fontWeight: 700 as const, cursor: 'pointer', transition: 'all 0.15s',
    background: isActive ? '#fff' : 'rgba(255,255,255,0.02)',
    borderColor: isActive ? '#fff' : 'rgba(255,255,255,0.06)',
    color: isActive ? '#000' : '#555',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px'
  });

  const fieldSection = (title: string, children: React.ReactNode) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{title}</label>
      {children}
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : '#f87171',
          }}>
            {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        </div>
      )}

      <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} style={{ color: '#888' }} />
              Modificación Masiva
            </h3>
            <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
              Filtra registros por cualquier condición y actualiza campos masivamente
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {variantesConDuplicados.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#fbbf24',
                textTransform: 'uppercase',
              }}>
                <AlertTriangle size={12} />
                {variantesConDuplicados.length} variante{variantesConDuplicados.length > 1 ? 's' : ''} con duplicado{variantesConDuplicados.length > 1 ? 's' : ''}
              </div>
            )}
            <button
              onClick={resetAll}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#666', borderRadius: '6px', padding: '6px 14px',
                fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                textTransform: 'uppercase',
              }}
            >
              <X size={12} /> Resetear
            </button>
          </div>
        </div>

        {/* ── CORRECTOR DE EMPLEADOR ────────────────────────────────────────── */}
        {variantesConDuplicados.length > 0 && (
          <div style={{
            marginBottom: '28px', padding: '20px',
            background: 'rgba(251,191,36,0.04)',
            border: '1px solid rgba(251,191,36,0.12)',
            borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={18} color="#fbbf24" />
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                Corrector de Empleador — {variantesConDuplicados.length} grupos para corregir
              </h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: '11px', color: '#666', cursor: 'pointer', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={mostrarTodos}
                  onChange={e => setMostrarTodos(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Mostrar todos
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Nombre correcto
                </label>
                <input
                  className="form-input"
                  placeholder="Ej: MUNICIPALIDAD DE PARANA"
                  value={empleadorCorreccion}
                  onChange={e => setEmpleadorCorreccion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && corregirEmpleador()}
                  style={{
                    background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px', padding: '10px 12px', fontSize: '13px', width: '100%', outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={corregirEmpleador}
                disabled={updating || empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()}
                style={{
                  background: (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) ? '#333' : '#fbbf24',
                  color: (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) ? '#666' : '#000',
                  border: 'none', borderRadius: '6px', padding: '10px 24px',
                  fontSize: '11px', fontWeight: 900, cursor: (empleadoresSeleccionados.length === 0 || !empleadorCorreccion.trim()) ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase', letterSpacing: '1px',
                  flexShrink: 0,
                }}
              >
                {updating ? 'CORRIGIENDO...' : `CORREGIR ${empleadoresSeleccionados.length} EMPLEADOR(ES)`}
              </button>
              <input
                className="form-input"
                placeholder="Buscar empleador..."
                value={busquedaEmpleador}
                onChange={e => setBusquedaEmpleador(e.target.value)}
                style={{
                  background: '#111', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', padding: '10px 12px', fontSize: '13px', flex: 1, outline: 'none',
                }}
              />
            </div>

            {empleadoresSeleccionados.length > 0 && (
              <div style={{ marginTop: '12px', fontSize: '11px', color: '#fbbf24', fontWeight: 700 }}>
                Seleccionados: {empleadoresSeleccionados.length} — {empleadorCorreccion || '(sin nombre correcto)'}
              </div>
            )}

            {/* Lista de variantes detectadas */}
            {variantesFiltradas.length > 0 ? (
              <div style={{ marginTop: '20px', maxHeight: 200, overflowY: 'auto' }}>
                {variantesFiltradas.map((v, i) => (
                  <div key={i} style={{
                    marginBottom: 12, padding: '12px 14px',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>
                      {v.normalizado} <span style={{ color: '#666' }}>({v.cantidad} variantes)</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {v.variantes.map((varName, j) => {
                        const isSelected = empleadoresSeleccionados.includes(varName);
                        return (
                          <span
                            key={j}
                            onClick={() => {
                              setEmpleadoresSeleccionados(prev =>
                                isSelected ? prev.filter(v => v !== varName) : [...prev, varName]
                              );
                            }}
                            style={{
                              padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                              background: isSelected ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                              border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
                              color: isSelected ? '#fbbf24' : '#888',
                              fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {varName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: '20px', padding: '20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                <p>{busquedaEmpleador ? 'No se encontraron resultados.' : 'No se detectaron empleadores con múltiples variantes.'}</p>
                <p style={{ fontSize: '11px', marginTop: '8px', color: '#444' }}>
                  {busquedaEmpleador ? 'Intentá con otro término.' : 'Activá <strong>"Mostrar todos"</strong> para ver la lista completa de empleadores.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: FILTROS */}
        {step === 'filter' && (
          <>
            {/* Resumen de filtros activos */}
            {(filtros.estados.length > 0 || filtros.analistas.length > 0 || filtros.scoreMin || filtros.scoreMax) && (
              <div style={{
                padding: '12px 16px', background: 'rgba(96,165,250,0.05)',
                border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px',
                marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 8,
                flexWrap: 'wrap',
              }}>
                <Filter size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', marginRight: 8 }}>Filtros activos:</span>
                {filtros.estados.map(e => (
                  <span key={e} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>{STATUS_LABEL[e] ?? e}</span>
                ))}
                {(filtros.scoreMin || filtros.scoreMax) && (
                  <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>
                    Score: {filtros.scoreMin || '0'} - {filtros.scoreMax || '∞'}
                  </span>
                )}
                {filtros.analistas.map(a => (
                  <span key={a} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ccc', fontWeight: 600 }}>{a}</span>
                ))}
              </div>
            )}

            {/* Sección: Filtros de selección */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                <label style={{ fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>ESTADO (seleccioná los que querés filtrar)</label>
                {filtros.estados.length > 0 && (
                  <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>· {filtros.estados.length} seleccionado{filtros.estados.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allEstados.map(est => (
                  <span key={est} onClick={() => toggleFilter('estados', est)} style={chipStyle(filtros.estados.includes(est))}>
                    {STATUS_LABEL[est] ?? est}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                <label style={{ fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>ANALISTA</label>
                {filtros.analistas.length > 0 && (
                  <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>· {filtros.analistas.length} seleccionado{filtros.analistas.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allAnalistas.map(an => (
                  <span key={an} onClick={() => toggleFilter('analistas', an)} style={chipStyle(filtros.analistas.includes(an))}>
                    {an}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>SCORE MÍN</label>
                <input className="form-input" type="number" placeholder="Ej: 0" value={filtros.scoreMin} onChange={e => setFiltros(p => ({ ...p, scoreMin: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>SCORE MÁX</label>
                <input className="form-input" type="number" placeholder="Ej: 499" value={filtros.scoreMax} onChange={e => setFiltros(p => ({ ...p, scoreMax: e.target.value }))} />
              </div>
            </div>

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                color: '#555', borderRadius: 6, padding: '8px 14px',
                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                textTransform: 'uppercase', marginBottom: 16, width: '100%',
                justifyContent: 'center',
              }}
            >
              {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Filtros Avanzados
            </button>

            {showAdvancedFilters && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>MONTO MÍN</label>
                    <input className="form-input" type="number" value={filtros.montoMin} onChange={e => setFiltros(p => ({ ...p, montoMin: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>MONTO MÁX</label>
                    <input className="form-input" type="number" value={filtros.montoMax} onChange={e => setFiltros(p => ({ ...p, montoMax: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>FECHA DESDE</label>
                    <input className="form-input" type="date" value={filtros.fechaDesde} onChange={e => setFiltros(p => ({ ...p, fechaDesde: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>FECHA HASTA</label>
                    <input className="form-input" type="date" value={filtros.fechaHasta} onChange={e => setFiltros(p => ({ ...p, fechaHasta: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>BÚSQUEDA (nombre, cuil)</label>
                  <input className="form-input" placeholder="Buscar..." value={filtros.search} onChange={e => setFiltros(p => ({ ...p, search: e.target.value }))} />
                </div>

                {/* Acuerdo de precios */}
                {allAcuerdos.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ACUERDO DE PRECIOS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allAcuerdos.map(a => (
                        <span key={a} onClick={() => toggleFilter('acuerdoPrecios', a)} style={chipStyle(filtros.acuerdoPrecios.includes(a))}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tipo cliente */}
                {allTipos.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>TIPO CLIENTE</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allTipos.map(t => (
                        <span key={t} onClick={() => toggleFilter('tipoCliente', t)} style={chipStyle(filtros.tipoCliente.includes(t))}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rango etario */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>RANGO ETARIO</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {RANGOS_ETARIOS.map(r => (
                      <span key={r} onClick={() => toggleFilter('rangoEtario', r)} style={chipStyle(filtros.rangoEtario.includes(r))}>{r}</span>
                    ))}
                  </div>
                </div>

                {/* Sexo */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>SEXO</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {SEXOS.map(s => (
                      <span key={s} onClick={() => toggleFilter('sexo', s)} style={chipStyle(filtros.sexo.includes(s))}>{s}</span>
                    ))}
                  </div>
                </div>

                {/* Localidad */}
                {allLocalidades.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>LOCALIDAD</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allLocalidades.map(l => (
                        <span key={l} onClick={() => toggleFilter('localidad', l)} style={chipStyle(filtros.localidad.includes(l))}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empleador */}
                {allEmpleadores.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>EMPLEADOR</label>
                    <select
                      className="form-input"
                      value={filtros.empleador[0] || ''}
                      onChange={e => setFiltros(p => ({ ...p, empleador: e.target.value ? [e.target.value] : [] }))}
                      style={{
                        background: '#111',
                        color: '#ccc',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '13px',
                        width: '100%',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" style={{ background: '#111', color: '#666' }}>Todos</option>
                      {allEmpleadores.map(e => (
                        <option key={e} value={e} style={{ background: '#111', color: '#ccc' }}>{e}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Es RE */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>RESUMEN EJECUTIVO</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span onClick={() => setFiltros(p => ({ ...p, esRe: p.esRe === 'si' ? '' : 'si' }))} style={chipStyle(filtros.esRe === 'si')}>Sí</span>
                    <span onClick={() => setFiltros(p => ({ ...p, esRe: p.esRe === 'no' ? '' : 'no' }))} style={chipStyle(filtros.esRe === 'no')}>No</span>
                  </div>
                </div>
              </>
            )}

            {/* Preview button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={previewRecords}
                style={{
                  background: '#fff', color: '#000', border: 'none',
                  fontWeight: 900, padding: '12px 28px', borderRadius: '10px',
                  fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Filter size={14} /> PREVISUALIZAR REGISTROS
              </button>
            </div>
          </>
        )}

        {/* STEP 2: CONFIRMAR - Seleccionar campos a modificar */}
        {step === 'confirm' && (
          <>
            <div style={{
              padding: '16px 20px', background: 'rgba(250,204,21,0.06)',
              border: '1px solid rgba(250,204,21,0.15)', borderRadius: '10px',
              marginBottom: '24px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AlertTriangle size={20} style={{ color: '#facc15', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {previewCount} registros serán modificados
                </p>
                <p style={{ fontSize: '12px', color: '#888' }}>
                  Selecciona los campos que deseas actualizar. Solo los campos con valor se aplicarán.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {fieldSection('Estado',
                <select className="form-select" value={campos.estado} onChange={e => setCampos(p => ({ ...p, estado: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{STATUS_LABEL[e] ?? e}</option>)}
                </select>
              )}

              {fieldSection('Analista',
                <select className="form-select" value={campos.analista} onChange={e => setCampos(p => ({ ...p, analista: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {fieldSection('Acuerdo de Precios',
                <select className="form-select" value={campos.acuerdo_precios} onChange={e => setCampos(p => ({ ...p, acuerdo_precios: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {ACUERDOS_OPCIONES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {fieldSection('Tipo Cliente',
                <select className="form-select" value={campos.tipo_cliente} onChange={e => setCampos(p => ({ ...p, tipo_cliente: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {TIPO_CLIENTE_OPCIONES.map(t => <option key={t} value={t}>{t === 'Renovacion' ? 'Renovación' : t}</option>)}
                </select>
              )}

              {fieldSection('Cuotas',
                <input className="form-input" placeholder="Ej: 12, 24, 36" value={campos.cuotas} onChange={e => setCampos(p => ({ ...p, cuotas: e.target.value }))} />
              )}

              {fieldSection('Rango Etario',
                <select className="form-select" value={campos.rango_etario} onChange={e => setCampos(p => ({ ...p, rango_etario: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {RANGOS_ETARIOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}

              {fieldSection('Sexo',
                <select className="form-select" value={campos.sexo} onChange={e => setCampos(p => ({ ...p, sexo: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              {fieldSection('Localidad',
                <select className="form-select" value={campos.localidad} onChange={e => setCampos(p => ({ ...p, localidad: e.target.value }))}>
                  <option value="">— No modificar —</option>
                  {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>

            {fieldSection('Empleador',
              <input className="form-input" placeholder="Nombre del empleador" value={campos.empleador} onChange={e => setCampos(p => ({ ...p, empleador: e.target.value }))} />
            )}

            {fieldSection('Resumen Ejecutivo',
              <select className="form-select" value={campos.es_re} onChange={e => setCampos(p => ({ ...p, es_re: e.target.value }))}>
                <option value="">— No modificar —</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            )}

            {fieldSection('Comentarios (agregar al final)',
              <textarea className="form-input" placeholder="Texto a agregar..." value={campos.comentarios} onChange={e => setCampos(p => ({ ...p, comentarios: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setStep('filter')}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#666', borderRadius: '8px', padding: '12px 24px',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                }}
              >
                VOLVER A FILTROS
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating || Object.values(campos).every(v => !v)}
                style={{
                  background: Object.values(campos).every(v => !v) ? '#333' : '#fff',
                  color: Object.values(campos).every(v => !v) ? '#666' : '#000',
                  border: 'none', fontWeight: 900, padding: '12px 32px',
                  borderRadius: '10px', fontSize: '12px', letterSpacing: '0.5px',
                  cursor: Object.values(campos).every(v => !v) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {updating ? 'ACTUALIZANDO...' : 'CONFIRMAR ACTUALIZACIÓN'}
              </button>
            </div>
          </>
        )}

        {/* STEP 3: DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={48} style={{ color: '#34d399', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              ¡Actualización completada!
            </h3>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: 24 }}>
              Se actualizaron <strong style={{ color: '#fff' }}>{updatedCount}</strong> registros correctamente.
            </p>
            <button
              onClick={resetAll}
              style={{
                background: '#fff', color: '#000', border: 'none',
                fontWeight: 800, padding: '12px 28px', borderRadius: '10px',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              NUEVA MODIFICACIÓN MASIVA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
