'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Save, RefreshCw, Plus, Trash2,
  Check, AlertCircle, CalendarDays, Users
} from 'lucide-react';
import { useSettings, useAnalistas } from '@/features/settings/SettingsProvider';
import { supabase } from '@/lib/supabase';
import {
  Feriado,
  formatFechaISO,
  calcularDiasTranscurridos,
  calcularDiasHabilesMes,
  FERIADOS_OFICIALES_ARGENTINA,
} from '@/lib/dias-habiles';

interface DiasLocalEntry {
  dias_habiles: number | string;
  dias_transcurridos: number | string;
  manual: boolean;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function DiasHabilesTab() {
  const {
    diasConfig,
    applyDiasConfigChange,
    feriados,
    saveFeriados,
    syncDiasTranscurridos,
  } = useSettings();
  const { analistas: analistasVisibles } = useAnalistas();

  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const mesActualIndex = ahora.getMonth(); // 0..11
  const anioActual = ahora.getFullYear();
  const nombreMesActual = MESES[mesActualIndex];

  // Cálculo automático del día actual con feriados y cortes de jornada
  const transcurridosHoy = useMemo(() => {
    return calcularDiasTranscurridos(ahora, feriados);
  }, [ahora, feriados]);

  // Cálculo sugerido para todo el mes
  const habilesSugeridosMes = useMemo(() => {
    return calcularDiasHabilesMes(anioActual, mesActualIndex + 1, feriados);
  }, [anioActual, mesActualIndex, feriados]);

  // Lista de entidades: 'Todos' (Punto de Venta) + analistas visibles
  const entidades = useMemo(() => {
    const nombres = analistasVisibles.map(a => a.nombre);
    return ['Todos', ...nombres];
  }, [analistasVisibles]);

  // Valor global para replicar a todos al inicio de mes
  const valorInicialGlobal = useMemo(() => {
    const cfgTodos = diasConfig.find(d => d.analista === 'Todos');
    return cfgTodos ? cfgTodos.dias_habiles : habilesSugeridosMes;
  }, [diasConfig, habilesSugeridosMes]);

  const [diasGlobalesInput, setDiasGlobalesInput] = useState<number | string>(valorInicialGlobal);
  const [diasLocales, setDiasLocales] = useState<Record<string, DiasLocalEntry>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [applyingToAll, setApplyingToAll] = useState(false);
  const [syncingTranscurridos, setSyncingTranscurridos] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Formulario nuevo feriado
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState<string>(formatFechaISO(ahora));
  const [nuevoFeriadoMotivo, setNuevoFeriadoMotivo] = useState<string>('');
  const [guardandoFeriado, setGuardandoFeriado] = useState(false);

  // Feriados del mes actual
  const feriadosDelMes = useMemo(() => {
    const prefix = `${anioActual}-${String(mesActualIndex + 1).padStart(2, '0')}`;
    return feriados.filter(f => f.fecha.startsWith(prefix));
  }, [feriados, anioActual, mesActualIndex]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const getEntry = (entidad: string): DiasLocalEntry => {
    if (diasLocales[entidad]) return diasLocales[entidad];
    const cfg = diasConfig.find(d => d.analista === entidad);
    return {
      dias_habiles: cfg ? cfg.dias_habiles : diasGlobalesInput,
      dias_transcurridos: cfg?.manual ? cfg.dias_transcurridos : transcurridosHoy,
      manual: cfg ? !!cfg.manual : false,
    };
  };

  const handleUpdateLocal = (entidad: string, field: keyof DiasLocalEntry, val: any) => {
    setDiasLocales(prev => {
      const current = prev[entidad] || getEntry(entidad);
      return {
        ...prev,
        [entidad]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  // Función principal: Guardar días hábiles y replicar a todos
  const handleReplicarHabilesATodos = async () => {
    const num = Number(diasGlobalesInput);
    if (isNaN(num) || num <= 0) {
      showToast('Ingresá un número válido de días hábiles', 'error');
      return;
    }

    setApplyingToAll(true);
    try {
      for (const entidad of entidades) {
        const entry = getEntry(entidad);
        const diasTransNum = entry.manual ? (Number(entry.dias_transcurridos) || 0) : transcurridosHoy;
        const payload = {
          analista: entidad,
          dias_habiles: num,
          dias_transcurridos: diasTransNum,
          manual: entry.manual,
        };
        await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
        applyDiasConfigChange('UPDATE', payload);
      }

      // Actualizar estado local
      const nextLocales: Record<string, DiasLocalEntry> = {};
      entidades.forEach(e => {
        nextLocales[e] = {
          ...getEntry(e),
          dias_habiles: num,
        };
      });
      setDiasLocales(nextLocales);
      showToast(`Se replicaron ${num} días hábiles a Punto de Venta y a todos los analistas.`);
    } catch (err: any) {
      showToast(`Error al replicar: ${err.message}`, 'error');
    } finally {
      setApplyingToAll(false);
    }
  };

  // Sincronizar días transcurridos automáticos a todos
  const handleSincronizarTranscurridos = async () => {
    setSyncingTranscurridos(true);
    try {
      await syncDiasTranscurridos(true);
      const nextLocales: Record<string, DiasLocalEntry> = {};
      entidades.forEach(e => {
        nextLocales[e] = {
          ...getEntry(e),
          dias_transcurridos: transcurridosHoy,
          manual: false,
        };
      });
      setDiasLocales(nextLocales);
      showToast(`Días transcurridos actualizados a ${transcurridosHoy} días.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSyncingTranscurridos(false);
    }
  };

  // Guardar configuración para un analista individual
  const handleGuardarEntidad = async (entidad: string) => {
    const entry = getEntry(entidad);
    setSavingKey(entidad);
    try {
      const diasHabilesNum = Number(entry.dias_habiles) || 0;
      const diasTransNum = entry.manual
        ? (Number(entry.dias_transcurridos) || 0)
        : transcurridosHoy;

      const payload = {
        analista: entidad,
        dias_habiles: diasHabilesNum,
        dias_transcurridos: diasTransNum,
        manual: entry.manual,
      };

      const { error } = await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
      if (error) throw error;

      applyDiasConfigChange('UPDATE', payload);
      showToast(`Guardado para ${entidad === 'Todos' ? 'Punto de Venta' : entidad}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  // Agregar feriado
  const handleAgregarFeriado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoFeriadoFecha || !nuevoFeriadoMotivo.trim()) {
      showToast('Completá fecha y motivo', 'error');
      return;
    }

    setGuardandoFeriado(true);
    try {
      const existe = feriados.some(f => f.fecha === nuevoFeriadoFecha);
      if (existe) {
        showToast('Ya existe un feriado en esa fecha', 'error');
        setGuardandoFeriado(false);
        return;
      }

      const nuevo: Feriado = {
        id: crypto.randomUUID(),
        fecha: nuevoFeriadoFecha,
        motivo: nuevoFeriadoMotivo.trim(),
      };

      const actualizados = [...feriados, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const ok = await saveFeriados(actualizados);
      if (!ok) throw new Error('Error al guardar');

      setNuevoFeriadoMotivo('');
      showToast(`Feriado agregado: ${nuevo.motivo}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setGuardandoFeriado(false);
    }
  };

  // Eliminar feriado
  const handleEliminarFeriado = async (fechaAEliminar: string, motivo: string) => {
    if (!confirm(`¿Eliminar feriado "${motivo}"?`)) return;
    try {
      const filtrados = feriados.filter(f => f.fecha !== fechaAEliminar);
      const ok = await saveFeriados(filtrados);
      if (!ok) throw new Error('Error al eliminar');
      showToast('Feriado eliminado');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Cargar oficiales
  const handleCargarFeriadosOficiales = async () => {
    if (!confirm('¿Cargar los feriados oficiales de Argentina? Se conservarán los ya existentes.')) return;
    try {
      const mapa = new Map<string, Feriado>();
      feriados.forEach(f => mapa.set(f.fecha, f));
      FERIADOS_OFICIALES_ARGENTINA.forEach(f => {
        if (!mapa.has(f.fecha)) {
          mapa.set(f.fecha, { id: crypto.randomUUID(), fecha: f.fecha, motivo: f.motivo });
        }
      });
      const lista = Array.from(mapa.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const ok = await saveFeriados(lista);
      if (!ok) throw new Error('Error al guardar');
      showToast('Feriados oficiales cargados');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Notificación Toast sobria */}
      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: feedback.type === 'success' ? '#141e18' : '#221416',
            border: `1px solid ${feedback.type === 'success' ? '#22543d' : '#742a2a'}`,
            color: feedback.type === 'success' ? '#9ae6b4' : '#feb2b2',
          }}
        >
          {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* PANEL PRINCIPAL SOBRIO: Carga mensual y replicar a todos */}
      <div
        style={{
          background: '#121214',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="#e4e4e7" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                Configuración Mensual de Días Hábiles
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: '#71717a', marginTop: '4px', marginBottom: 0 }}>
              Mes en curso: <span style={{ color: '#d4d4d8', fontWeight: 600 }}>{nombreMesActual} {anioActual}</span>.
              Ingresá los días hábiles del mes y replicalos a todo el equipo con un solo clic.
            </p>
          </div>

          {/* Formulario de carga y réplica a todos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0 10px', height: '36px' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa', marginRight: '8px' }}>Días Hábiles:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="31"
                value={diasGlobalesInput}
                onChange={e => setDiasGlobalesInput(e.target.value)}
                style={{
                  width: '54px',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setDiasGlobalesInput(habilesSugeridosMes)}
              title="Calcular según calendario y feriados"
              style={{
                height: '36px',
                padding: '0 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                color: '#d4d4d8',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Sugerir ({habilesSugeridosMes})</span>
            </button>

            <button
              type="button"
              onClick={handleReplicarHabilesATodos}
              disabled={applyingToAll}
              style={{
                height: '36px',
                padding: '0 16px',
                background: '#27272a',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Users size={13} />
              <span>{applyingToAll ? 'Replicando...' : 'Replicar a Todos'}</span>
            </button>

            <button
              type="button"
              onClick={handleSincronizarTranscurridos}
              disabled={syncingTranscurridos}
              title="Actualizar los días transcurridos al cálculo de hoy"
              style={{
                height: '36px',
                padding: '0 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#a1a1aa',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={12} className={syncingTranscurridos ? 'spin' : ''} />
              <span>Hoy: {transcurridosHoy} d</span>
            </button>
          </div>
        </div>

        {/* Regla de negocio en formato sobrio y discreto */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '16px',
            fontSize: '11px',
            color: '#71717a',
          }}
        >
          <span>Regla de cálculo:</span>
          <span>• Lunes a Viernes: <strong style={{ color: '#d4d4d8' }}>1 día (a las 19:30 hs computa el día siguiente)</strong></span>
          <span>• Sábados: <strong style={{ color: '#d4d4d8' }}>0.5 día (a las 12:00 pm computa el lunes)</strong></span>
          <span>• Domingos: <strong style={{ color: '#d4d4d8' }}>0</strong></span>
          <span>• Feriados Nacionales: <strong style={{ color: '#d4d4d8' }}>0</strong> ({feriadosDelMes.length} este mes)</span>
          <span style={{ marginLeft: 'auto', color: '#a1a1aa' }}>
            Transcurridos al día de hoy: <strong style={{ color: '#fff' }}>{transcurridosHoy} días</strong>
          </span>
        </div>
      </div>

      {/* TARJETAS POR ANALISTA Y PUNTO DE VENTA */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Detalle por Analista y Punto de Venta
          </h4>
          <span style={{ fontSize: '11px', color: '#52525b' }}>
            {entidades.length} perfiles activos
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {entidades.map(entidad => {
            const entry = getEntry(entidad);
            const isPdv = entidad === 'Todos';
            const isSaving = savingKey === entidad;

            return (
              <div
                key={entidad}
                style={{
                  background: '#121214',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Header de la tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5 style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: '#fff' }}>
                    {isPdv ? 'Punto de Venta (General)' : entidad}
                  </h5>
                  <span
                    style={{
                      fontSize: '10px',
                      color: entry.manual ? '#a1a1aa' : '#71717a',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {entry.manual ? 'Manual' : 'Automático'}
                  </span>
                </div>

                {/* Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Días Hábiles */}
                  <div>
                    <label style={{ display: 'block', color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
                      Días Hábiles
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="31"
                      value={entry.dias_habiles}
                      onChange={e => handleUpdateLocal(entidad, 'dias_habiles', e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        background: '#18181b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '0 10px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Días Transcurridos */}
                  <div>
                    <label style={{ display: 'block', color: '#71717a', fontSize: '11px', marginBottom: '6px' }}>
                      Transcurridos
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="31"
                      disabled={!entry.manual}
                      value={entry.manual ? entry.dias_transcurridos : transcurridosHoy}
                      onChange={e => handleUpdateLocal(entidad, 'dias_transcurridos', e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        background: entry.manual ? '#18181b' : 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        color: entry.manual ? '#fff' : '#a1a1aa',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '0 10px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Footer de la tarjeta: checkbox manual y botón guardar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#71717a', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={entry.manual}
                      onChange={async e => {
                        const isMan = e.target.checked;
                        const current = getEntry(entidad);
                        const updated: DiasLocalEntry = {
                          ...current,
                          manual: isMan,
                          dias_transcurridos: isMan ? current.dias_transcurridos : transcurridosHoy,
                        };
                        setDiasLocales(prev => ({
                          ...prev,
                          [entidad]: updated,
                        }));

                        try {
                          const payload = {
                            analista: entidad,
                            dias_habiles: Number(updated.dias_habiles) || 0,
                            dias_transcurridos: Number(updated.dias_transcurridos) || 0,
                            manual: isMan,
                          };
                          await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
                          applyDiasConfigChange('UPDATE', payload);
                          showToast(`${entidad === 'Todos' ? 'Punto de Venta' : entidad}: modo ${isMan ? 'Manual' : 'Automático'}`);
                        } catch (err: any) {
                          showToast(`Error al cambiar modo: ${err.message}`, 'error');
                        }
                      }}
                    />
                    <span>Editar manual</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleGuardarEntidad(entidad)}
                    disabled={isSaving}
                    style={{
                      height: '30px',
                      padding: '0 12px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#d4d4d8',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Save size={11} />
                    <span>{isSaving ? '...' : 'Guardar'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCION FERIADOS NACIONALES: SOBRIA Y LIMPIA */}
      <div
        style={{
          background: '#121214',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
              Feriados Nacionales ({feriados.length})
            </h4>
            <p style={{ fontSize: '12px', color: '#71717a', marginTop: '4px', marginBottom: 0 }}>
              Los feriados no computan como días hábiles trabajados y se descuentan automáticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCargarFeriadosOficiales}
            style={{
              height: '32px',
              padding: '0 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              color: '#d4d4d8',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cargar Feriados Oficiales de Argentina
          </button>
        </div>

        {/* Formulario nuevo feriado */}
        <form
          onSubmit={handleAgregarFeriado}
          style={{
            display: 'grid',
            gridTemplateColumns: '170px 1fr 100px',
            gap: '10px',
            background: '#18181b',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '16px',
            alignItems: 'center',
          }}
        >
          <input
            type="date"
            value={nuevoFeriadoFecha}
            onChange={e => setNuevoFeriadoFecha(e.target.value)}
            style={{
              height: '34px',
              background: '#121214',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              padding: '0 8px',
              boxSizing: 'border-box',
            }}
            required
          />

          <input
            type="text"
            placeholder="Motivo del feriado (ej. Día de la Bandera)"
            value={nuevoFeriadoMotivo}
            onChange={e => setNuevoFeriadoMotivo(e.target.value)}
            style={{
              height: '34px',
              background: '#121214',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              padding: '0 10px',
              boxSizing: 'border-box',
            }}
            required
          />

          <button
            type="submit"
            disabled={guardandoFeriado}
            style={{
              height: '34px',
              background: '#27272a',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <Plus size={13} />
            <span>{guardandoFeriado ? '...' : 'Agregar'}</span>
          </button>
        </form>

        {/* Lista de feriados */}
        {feriados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#52525b', fontSize: '12px' }}>
            No hay feriados cargados.
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {feriados.map(f => {
              const esDeEsteMes = f.fecha.startsWith(`${anioActual}-${String(mesActualIndex + 1).padStart(2, '0')}`);
              const partes = f.fecha.split('-');
              const fechaObj = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
              const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fechaObj.getDay()];
              const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

              return (
                <div
                  key={f.fecha}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: esDeEsteMes ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ minWidth: '85px', fontSize: '12px', fontWeight: 600, color: '#f4f4f5' }}>
                      {fechaFormateada}
                    </span>
                    <span style={{ fontSize: '11px', color: '#71717a', minWidth: '70px' }}>
                      {diaSemana}
                    </span>
                    <span style={{ fontSize: '12px', color: '#d4d4d8' }}>
                      {f.motivo}
                    </span>
                    {esDeEsteMes && (
                      <span style={{ fontSize: '10px', color: '#a1a1aa', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>
                        Este mes
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEliminarFeriado(f.fecha, f.motivo)}
                    title="Eliminar"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#52525b',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
