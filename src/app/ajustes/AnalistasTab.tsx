'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { capitalizarTexto } from '@/lib/utils';
import { Analista } from '@/types';
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import styles from './AnalistasTab.module.css';

export default function AnalistasTab() {
  const { analistasAll, applyAnalistaChange } = useAnalistas();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [incentivo, setIncentivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const existe = (n: string) =>
    analistasAll.some(a => a.nombre.toLowerCase() === n.toLowerCase());

  const agregar = async () => {
    const n = capitalizarTexto(nombre).trim();
    if (!n) { setError('Ingresá un nombre'); return; }
    if (existe(n)) { setError('Ya existe un analista con ese nombre'); return; }
    const orden = Math.max(0, ...analistasAll.map(a => a.orden)) + 1;
    const fila: Analista = { nombre: n, color, oculto: false, tiene_incentivo: incentivo, orden };
    const { data, error: e } = await supabase.from('analistas').insert(fila).select().single();
    if (e) { setError(e.message); return; }
    applyAnalistaChange('INSERT', data as Analista);
    setNombre(''); setColor('#6366f1'); setIncentivo(true); setError(null);
  };

  const toggleOculto = async (a: Analista) => {
    const next = { ...a, oculto: !a.oculto };
    const { error: e } = await supabase.from('analistas').update({ oculto: next.oculto }).eq('nombre', a.nombre);
    if (e) { setError(e.message); return; }
    applyAnalistaChange('UPDATE', next);
  };

  const eliminar = async (a: Analista) => {
    const { count } = await supabase
      .from('registros')
      .select('id', { count: 'exact', head: true })
      .eq('analista', a.nombre);
    if ((count ?? 0) > 0) {
      setError(
        `"${a.nombre}" tiene ${count} registros. Ocultalo, o reasigná sus registros en Modificación Masiva antes de eliminar.`
      );
      return;
    }
    // Limpieza de config asociada antes de borrar el analista. Si alguna falla,
    // abortamos para no dejar el analista borrado con config huérfana (o viceversa).
    const objErr = (await supabase.from('objetivos').delete().eq('analista', a.nombre)).error;
    if (objErr) { setError(`No se pudieron borrar los objetivos: ${objErr.message}`); return; }
    const diasErr = (await supabase.from('dias_habiles_config').delete().eq('analista', a.nombre)).error;
    if (diasErr) { setError(`No se pudieron borrar los días hábiles: ${diasErr.message}`); return; }
    const { error: e } = await supabase.from('analistas').delete().eq('nombre', a.nombre);
    if (e) { setError(e.message); return; }
    applyAnalistaChange('DELETE', a);
    setError(null);
  };

  return (
    <div className={styles.root}>

      {/* FORMULARIO AGREGAR */}
      <div className={`data-card ${styles.card}`}>
        <div className={`data-card-header ${styles.addHeader}`}>
          <h3 className={styles.title}>Agregar Analista</h3>
          <p className={styles.description}>
            Los analistas nuevos se agregan al final del listado y están visibles de inmediato.
          </p>
        </div>

        <div className={styles.formContent}>
          <div className={styles.formRow}>

            {/* Nombre */}
            <div className={`form-group ${styles.nameField}`}>
              <label className={`form-label ${styles.formLabel}`}>
                Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => { setNombre(e.target.value); setError(null); }}
                placeholder="Ej: Martínez"
                onKeyDown={e => e.key === 'Enter' && agregar()}
                className={`form-input ${styles.nameInput}`}
              />
            </div>

            {/* Color */}
            <div className={`form-group ${styles.compactField}`}>
              <label className={`form-label ${styles.formLabel}`}>
                Color
              </label>
              <div className={styles.inlineField}>
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className={styles.colorInput}
                />
                <span className={styles.colorValue}>{color}</span>
              </div>
            </div>

            {/* Incentivo */}
            <div className={`form-group ${styles.compactField}`}>
              <label className={`form-label ${styles.formLabel}`}>
                Cobra incentivos
              </label>
              <div className={styles.incentiveField}>
                <input
                  type="checkbox"
                  id="incentivo-check"
                  checked={incentivo}
                  onChange={e => setIncentivo(e.target.checked)}
                  className={styles.checkbox}
                  style={{ '--analyst-color': color } as React.CSSProperties}
                />
                <label
                  htmlFor="incentivo-check"
                  className={`${styles.checkboxLabel} ${incentivo ? styles.isChecked : ''}`}
                >
                  {incentivo ? 'Sí' : 'No'}
                </label>
              </div>
            </div>

            {/* Botón */}
            <button
              className={`btn-primary ${styles.addButton}`}
              onClick={agregar}
            >
              <Plus size={16} /> Agregar
            </button>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE ANALISTAS */}
      <div className={`data-card ${styles.card}`}>
        <div className={`data-card-header ${styles.listHeader}`}>
          <h3 className={styles.title}>
            Analistas ({analistasAll.length})
          </h3>
          <p className={styles.description}>
            Ocultá analistas para excluirlos de listados sin perder sus datos históricos.
          </p>
        </div>

        {analistasAll.length === 0 ? (
          <div className={styles.emptyState}>
            No hay analistas registrados.
          </div>
        ) : (
          <div className={styles.analystList}>
            {analistasAll.map(a => (
              <div
                key={a.nombre}
                className={`${styles.analystRow} ${a.oculto ? styles.isHidden : ''}`}
              >
                {/* Swatch de color */}
                <div className={styles.swatch} style={{ '--analyst-color': a.color } as React.CSSProperties} />

                {/* Nombre */}
                <span className={styles.analystName}>
                  {a.nombre}
                </span>

                {/* Badges */}
                <div className={styles.badges}>
                  {a.oculto && (
                    <span className={`${styles.badge} ${styles.hiddenBadge}`}>
                      Oculto
                    </span>
                  )}
                  {!a.tiene_incentivo && (
                    <span className={`${styles.badge} ${styles.noIncentiveBadge}`}>
                      Sin incentivo
                    </span>
                  )}
                </div>

                {/* Toggle visibilidad */}
                <button
                  onClick={() => toggleOculto(a)}
                  title={a.oculto ? 'Mostrar' : 'Ocultar'}
                  className={`${styles.iconButton} ${a.oculto ? styles.showButton : ''}`}
                >
                  {a.oculto ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>

                {/* Eliminar */}
                <button
                  onClick={() => eliminar(a)}
                  title="Eliminar analista"
                  className={`${styles.iconButton} ${styles.deleteButton}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
