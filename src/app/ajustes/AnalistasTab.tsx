'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { capitalizarTexto } from '@/lib/utils';
import { Analista } from '@/types';
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';

export default function AnalistasTab() {
  const { analistasAll, applyAnalistaChange } = useAnalistas();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('var(--violet)');
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
    setNombre(''); setColor('var(--violet)'); setIncentivo(true); setError(null);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* FORMULARIO AGREGAR */}
      <div className="data-card" style={{ background: 'var(--surface-canvas)', border: '1px solid var(--neutral-03)' }}>
        <div className="data-card-header" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-strong)' }}>Agregar Analista</h3>
          <p style={{ fontSize: '13px', color: 'var(--gris)' }}>
            Los analistas nuevos se agregan al final del listado y están visibles de inmediato.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Nombre */}
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>
                Nombre
              </label>
              <input
                className="form-input"
                type="text"
                value={nombre}
                onChange={e => { setNombre(e.target.value); setError(null); }}
                placeholder="Ej: Martínez"
                onKeyDown={e => e.key === 'Enter' && agregar()}
                style={{ background: 'var(--neutral-02)' }}
              />
            </div>

            {/* Color */}
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>
                Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  style={{
                    width: '42px', height: '38px', padding: '2px', borderRadius: '6px',
                    border: '1px solid var(--neutral-10)', background: 'var(--neutral-02)',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'var(--font-code)' }}>{color}</span>
              </div>
            </div>

            {/* Incentivo */}
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <label className="form-label" style={{ color: 'var(--gris)', fontSize: '11px', textTransform: 'uppercase' }}>
                Cobra incentivos
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
                <input
                  type="checkbox"
                  id="incentivo-check"
                  checked={incentivo}
                  onChange={e => setIncentivo(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: color, cursor: 'pointer' }}
                />
                <label
                  htmlFor="incentivo-check"
                  style={{ fontSize: '13px', color: incentivo ? 'var(--text-strong)' : 'var(--gris)', cursor: 'pointer', userSelect: 'none' }}
                >
                  {incentivo ? 'Sí' : 'No'}
                </label>
              </div>
            </div>

            {/* Botón */}
            <button
              className="btn-primary"
              onClick={agregar}
              style={{ padding: '10px 20px', alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Agregar
            </button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE ANALISTAS */}
      <div className="data-card" style={{ background: 'var(--surface-canvas)', border: '1px solid var(--neutral-03)' }}>
        <div className="data-card-header" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-strong)' }}>
            Analistas ({analistasAll.length})
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--gris)' }}>
            Ocultá analistas para excluirlos de listados sin perder sus datos históricos.
          </p>
        </div>

        {analistasAll.length === 0 ? (
          <div style={{
            padding: '40px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13px',
            background: 'var(--neutral-01)', borderRadius: '12px'
          }}>
            No hay analistas registrados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analistasAll.map(a => (
              <div
                key={a.nombre}
                style={{
                  padding: '12px 16px',
                  background: a.oculto ? 'var(--neutral-01)' : 'var(--neutral-02)',
                  border: `1px solid ${a.oculto ? 'var(--neutral-04)' : 'var(--neutral-06)'}`,
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  opacity: a.oculto ? 0.55 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {/* Swatch de color */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: a.color, flexShrink: 0,
                  border: '1px solid var(--neutral-10)'
                }} />

                {/* Nombre */}
                <span style={{ fontWeight: 700, fontSize: '14px', color: a.oculto ? 'var(--text-subtle)' : 'var(--text-strong)', flex: 1 }}>
                  {a.nombre}
                </span>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {a.oculto && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                      background: 'var(--neutral-05)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.4px'
                    }}>
                      Oculto
                    </span>
                  )}
                  {!a.tiene_incentivo && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                      background: 'rgba(251,191,36,0.08)', color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.4px'
                    }}>
                      Sin incentivo
                    </span>
                  )}
                </div>

                {/* Toggle visibilidad */}
                <button
                  onClick={() => toggleOculto(a)}
                  title={a.oculto ? 'Mostrar' : 'Ocultar'}
                  style={{
                    background: 'none', border: '1px solid var(--neutral-08)',
                    borderRadius: '6px', padding: '6px 8px', cursor: 'pointer',
                    color: a.oculto ? 'var(--azul)' : 'var(--text-subtle)',
                    display: 'flex', alignItems: 'center', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--neutral-18)'; e.currentTarget.style.color = 'var(--text-strong)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--neutral-08)'; e.currentTarget.style.color = a.oculto ? 'var(--azul)' : 'var(--text-subtle)'; }}
                >
                  {a.oculto ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>

                {/* Eliminar */}
                <button
                  onClick={() => eliminar(a)}
                  title="Eliminar analista"
                  style={{
                    background: 'none', border: '1px solid var(--neutral-08)',
                    borderRadius: '6px', padding: '6px 8px', cursor: 'pointer',
                    color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--neutral-08)'; e.currentTarget.style.color = 'var(--text-subtle)'; }}
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
