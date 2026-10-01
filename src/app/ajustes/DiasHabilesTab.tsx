'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Save, RefreshCw, Plus, Trash2,
  Check, AlertCircle, Users, Pencil, RotateCcw, X
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

  // Edición de feriado (traslado de fecha)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFecha, setEditFecha] = useState<string>('');
  const [editMotivo, setEditMotivo] = useState<string>('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);

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
        // supabase-js no lanza ante un error de PostgREST: devuelve { data, error }. Sin este
        // chequeo el bucle seguía y se reportaba éxito aunque fallaran todas las filas.
        const { error } = await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
        if (error) throw error;
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
        fechaOriginal: nuevoFeriadoFecha,
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

  // Iniciar edición de feriado
  const handleIniciarEdicion = (f: Feriado) => {
    setEditingId(f.id || f.fecha);
    setEditFecha(f.fecha);
    setEditMotivo(f.motivo);
  };

  // Cancelar edición
  const handleCancelarEdicion = () => {
    setEditingId(null);
    setEditFecha('');
    setEditMotivo('');
  };

  // Guardar edición de feriado (traslado o corrección)
  const handleGuardarEdicion = async (f: Feriado) => {
    if (!editFecha || !editMotivo.trim()) {
      showToast('Completá fecha y motivo', 'error');
      return;
    }

    // Si cambió la fecha, verificar que no colisione con otro feriado existente
    if (editFecha !== f.fecha) {
      const existe = feriados.some(item => {
        const isSelf = f.id ? item.id === f.id : item.fecha === f.fecha;
        return !isSelf && item.fecha === editFecha;
      });
      if (existe) {
        showToast('Ya existe otro feriado en esa fecha', 'error');
        return;
      }
    }

    setGuardandoEdit(true);
    try {
      // Mantener la fecha original: si f ya tenía fechaOriginal, conservarla; si no, f.fecha original
      const fechaOriginalDefinitiva = f.fechaOriginal || f.fecha;

      const actualizados = feriados.map(item => {
        const match = f.id ? item.id === f.id : item.fecha === f.fecha;
        if (!match) return item;
        return {
          ...item,
          fecha: editFecha,
          motivo: editMotivo.trim(),
          fechaOriginal: fechaOriginalDefinitiva,
        };
      }).sort((a, b) => a.fecha.localeCompare(b.fecha));

      const ok = await saveFeriados(actualizados);
      if (!ok) throw new Error('Error al guardar cambios');

      const fueTrasladado = editFecha !== fechaOriginalDefinitiva;
      const partesNueva = editFecha.split('-');
      const partesOrig = fechaOriginalDefinitiva.split('-');
      showToast(
        fueTrasladado
          ? `Feriado trasladado al ${partesNueva[2]}/${partesNueva[1]} (Original: ${partesOrig[2]}/${partesOrig[1]})`
          : 'Feriado actualizado correctamente'
      );
      setEditingId(null);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setGuardandoEdit(false);
    }
  };

  // Restaurar feriado a su fecha original si fue trasladado
  const handleRestaurarFechaOriginal = async (f: Feriado) => {
    const orig = f.fechaOriginal;
    if (!orig || orig === f.fecha) return;

    // Verificar si la fecha original está ocupada por otro feriado
    const existe = feriados.some(item => {
      const isSelf = f.id ? item.id === f.id : item.fecha === f.fecha;
      return !isSelf && item.fecha === orig;
    });
    if (existe) {
      const origPartes = orig.split('-');
      showToast(`No se puede restaurar: ya existe otro feriado el ${origPartes[2]}/${origPartes[1]}`, 'error');
      return;
    }

    const origPartes = orig.split('-');
    if (!confirm(`¿Restaurar "${f.motivo}" a su fecha original (${origPartes[2]}/${origPartes[1]}/${origPartes[0]})?`)) return;

    try {
      const actualizados = feriados.map(item => {
        const match = f.id ? item.id === f.id : item.fecha === f.fecha;
        if (!match) return item;
        return {
          ...item,
          fecha: orig,
        };
      }).sort((a, b) => a.fecha.localeCompare(b.fecha));

      const ok = await saveFeriados(actualizados);
      if (!ok) throw new Error('Error al restaurar fecha');
      showToast(`Feriado restaurado a su fecha original: ${origPartes[2]}/${origPartes[1]}/${origPartes[0]}`);
      if (editingId && (editingId === f.id || editingId === f.fecha)) {
        setEditingId(null);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Eliminar feriado
  const handleEliminarFeriado = async (fechaAEliminar: string, motivo: string) => {
    if (!confirm(`¿Eliminar feriado "${motivo}"?`)) return;
    try {
      const filtrados = feriados.filter(f => f.fecha !== fechaAEliminar);
      const ok = await saveFeriados(filtrados);
      if (!ok) throw new Error('Error al eliminar');
      if (editingId) setEditingId(null);
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
          mapa.set(f.fecha, {
            id: crypto.randomUUID(),
            fecha: f.fecha,
            motivo: f.motivo,
            fechaOriginal: f.fechaOriginal || f.fecha,
          });
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
    <div className="business-days">
      {/* Notificación Toast sobria */}
      {feedback && (
        <div className={`business-days__toast is-${feedback.type}`}>
          {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* PANEL PRINCIPAL SOBRIO: Carga mensual y replicar a todos */}
      <div className="business-days__panel">
        <div className="business-days__panel-header">
          <div>
            <div className="business-days__title-row">
              <Calendar size={16} />
              <h3 className="business-days__title">
                Configuración Mensual de Días Hábiles
              </h3>
            </div>
            <p className="business-days__description">
              Mes en curso: <span className="business-days__emphasis">{nombreMesActual} {anioActual}</span>.
              Ingresá los días hábiles del mes y replicalos a todo el equipo con un solo clic.
            </p>
          </div>

          {/* Formulario de carga y réplica a todos */}
          <div className="business-days__controls">
            <div className="business-days__global-field">
              <span className="business-days__global-label">Días Hábiles:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="31"
                value={diasGlobalesInput}
                onChange={e => setDiasGlobalesInput(e.target.value)}
                className="business-days__global-input"
              />
            </div>

            <button
              type="button"
              onClick={() => setDiasGlobalesInput(habilesSugeridosMes)}
              title="Calcular según calendario y feriados"
              className="business-days__button"
            >
              <span>Sugerir ({habilesSugeridosMes})</span>
            </button>

            <button
              type="button"
              onClick={handleReplicarHabilesATodos}
              disabled={applyingToAll}
              className="business-days__button is-primary"
            >
              <Users size={13} />
              <span>{applyingToAll ? 'Replicando...' : 'Replicar a Todos'}</span>
            </button>

            <button
              type="button"
              onClick={handleSincronizarTranscurridos}
              disabled={syncingTranscurridos}
              title="Actualizar los días transcurridos al cálculo de hoy"
              className="business-days__button is-muted"
            >
              <RefreshCw size={12} className={syncingTranscurridos ? 'spin' : ''} />
              <span>Hoy: {transcurridosHoy} d</span>
            </button>
          </div>
        </div>

        {/* Regla de negocio en formato sobrio y discreto */}
        <div className="business-days__rules">
          <span>Regla de cálculo:</span>
          <span>• Lunes a Viernes: <strong>1 día (a las 19:30 hs computa el día siguiente)</strong></span>
          <span>• Sábados: <strong>0.5 día (a las 12:00 pm computa el lunes)</strong></span>
          <span>• Domingos: <strong>0</strong></span>
          <span>• Feriados Nacionales: <strong>0</strong> ({feriadosDelMes.length} este mes)</span>
          <span className="business-days__rules-current">
            Transcurridos al día de hoy: <strong>{transcurridosHoy} días</strong>
          </span>
        </div>
      </div>

      {/* TARJETAS POR ANALISTA Y PUNTO DE VENTA */}
      <div>
        <div className="business-days__section-header">
          <h4 className="business-days__section-title">
            Detalle por Analista y Punto de Venta
          </h4>
          <span className="business-days__section-count">
            {entidades.length} perfiles activos
          </span>
        </div>

        <div className="business-days__profiles">
          {entidades.map(entidad => {
            const entry = getEntry(entidad);
            const isPdv = entidad === 'Todos';
            const isSaving = savingKey === entidad;

            return (
              <div key={entidad} className="business-days__profile">
                {/* Header de la tarjeta */}
                <div className="business-days__profile-header">
                  <h5 className="business-days__profile-name">
                    {isPdv ? 'Punto de Venta (General)' : entidad}
                  </h5>
                  <span className={`business-days__mode${entry.manual ? ' is-manual' : ''}`}>
                    {entry.manual ? 'Manual' : 'Automático'}
                  </span>
                </div>

                {/* Inputs */}
                <div className="business-days__profile-fields">
                  {/* Días Hábiles */}
                  <div>
                    <label className="business-days__field-label">
                      Días Hábiles
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="31"
                      value={entry.dias_habiles}
                      onChange={e => handleUpdateLocal(entidad, 'dias_habiles', e.target.value)}
                      className="business-days__number-input"
                    />
                  </div>

                  {/* Días Transcurridos */}
                  <div>
                    <label className="business-days__field-label">
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
                      className={`business-days__number-input${entry.manual ? '' : ' is-automatic'}`}
                    />
                  </div>
                </div>

                {/* Footer de la tarjeta: checkbox manual y botón guardar */}
                <div className="business-days__profile-footer">
                  <label className="business-days__manual-toggle">
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
                          const { error } = await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
                          if (error) throw error;
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
                    className="business-days__save-button"
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
      <div className="business-days__panel">
        <div className="business-days__holidays-header">
          <div>
            <h4 className="business-days__holidays-title">
              Feriados Nacionales ({feriados.length})
            </h4>
            <p className="business-days__description">
              Los feriados no computan como días hábiles trabajados y se descuentan automáticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCargarFeriadosOficiales}
            className="business-days__official-button"
          >
            Cargar Feriados Oficiales de Argentina
          </button>
        </div>

        {/* Formulario nuevo feriado */}
        <form onSubmit={handleAgregarFeriado} className="business-days__holiday-form">
          <input
            type="date"
            value={nuevoFeriadoFecha}
            onChange={e => setNuevoFeriadoFecha(e.target.value)}
            className="business-days__holiday-input"
            required
          />

          <input
            type="text"
            placeholder="Motivo del feriado (ej. Día de la Bandera)"
            value={nuevoFeriadoMotivo}
            onChange={e => setNuevoFeriadoMotivo(e.target.value)}
            className="business-days__holiday-input"
            required
          />

          <button
            type="submit"
            disabled={guardandoFeriado}
            className="business-days__add-button"
          >
            <Plus size={13} />
            <span>{guardandoFeriado ? '...' : 'Agregar'}</span>
          </button>
        </form>

        {/* Lista de feriados */}
        {feriados.length === 0 ? (
          <div className="business-days__empty">
            No hay feriados cargados.
          </div>
        ) : (
          <div className="business-days__holiday-list">
            {feriados.map(f => {
              const itemId = f.id || f.fecha;
              const isEditing = editingId === itemId;

              const esDeEsteMes = f.fecha.startsWith(`${anioActual}-${String(mesActualIndex + 1).padStart(2, '0')}`);
              const partes = f.fecha.split('-');
              const fechaObj = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
              const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fechaObj.getDay()];
              const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

              const fechaOriginal = f.fechaOriginal || f.fecha;
              const esTrasladado = Boolean(f.fechaOriginal && f.fechaOriginal !== f.fecha);
              const origPartes = fechaOriginal.split('-');
              const origFormateada = `${origPartes[2]}/${origPartes[1]}/${origPartes[0]}`;

              if (isEditing) {
                return (
                  <div key={itemId} className="business-days__holiday-edit">
                    <div className="business-days__holiday-edit-fields">
                      <div className="business-days__holiday-edit-field">
                        <label>Fecha efectiva:</label>
                        <input
                          type="date"
                          value={editFecha}
                          onChange={e => setEditFecha(e.target.value)}
                          className="business-days__holiday-edit-input"
                          required
                        />
                      </div>

                      <div className="business-days__holiday-edit-field is-wide">
                        <label>Motivo:</label>
                        <input
                          type="text"
                          value={editMotivo}
                          onChange={e => setEditMotivo(e.target.value)}
                          placeholder="Motivo del feriado"
                          className="business-days__holiday-edit-input"
                          required
                        />
                      </div>

                      <div className="business-days__holiday-original">
                        Fecha original: <strong>{origFormateada}</strong>
                        {editFecha !== fechaOriginal && (
                          <span>(Se marcará como trasladado)</span>
                        )}
                      </div>
                    </div>

                    <div className="business-days__holiday-edit-actions">
                      <button
                        type="button"
                        disabled={guardandoEdit}
                        onClick={() => handleGuardarEdicion(f)}
                        className="business-days__edit-button is-save"
                      >
                        <Check size={13} />
                        <span>{guardandoEdit ? '...' : 'Guardar'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={guardandoEdit}
                        onClick={handleCancelarEdicion}
                        className="business-days__edit-button"
                      >
                        <X size={13} />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={itemId} className={`business-days__holiday${esDeEsteMes ? ' is-current' : ''}${esTrasladado ? ' is-transferred' : ''}`}>
                  <div className="business-days__holiday-info">
                    <span className="business-days__holiday-date">
                      {fechaFormateada}
                    </span>
                    <span className="business-days__holiday-weekday">
                      {diaSemana}
                    </span>
                    <span className="business-days__holiday-reason">
                      {f.motivo}
                    </span>
                    {esTrasladado && (
                      <span title={`Fecha original de calendario: ${origFormateada}`} className="business-days__transferred-badge">
                        Trasladado (Orig: {origPartes[2]}/{origPartes[1]})
                      </span>
                    )}
                    {esDeEsteMes && (
                      <span className="business-days__current-badge">
                        Este mes
                      </span>
                    )}
                  </div>

                  <div className="business-days__holiday-actions">
                    {esTrasladado && (
                      <button
                        type="button"
                        onClick={() => handleRestaurarFechaOriginal(f)}
                        title={`Restaurar a fecha original (${origFormateada})`}
                        className="business-days__icon-button is-restore"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleIniciarEdicion(f)}
                      title="Editar día / trasladar feriado"
                      className="business-days__icon-button is-edit"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEliminarFeriado(f.fecha, f.motivo)}
                      title="Eliminar"
                      className="business-days__icon-button is-delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
