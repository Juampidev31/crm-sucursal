'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

import { CONFIG } from '@/types';
import { Save, AlertCircle } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

interface ObjetivoRow {
  analista: string;
  mes: number;
  meta_ventas: number;
  meta_operaciones: number;
}

const ANALISTAS = ['PDV', ...CONFIG.ANALISTAS_DEFAULT];

export default function ObjetivosPage() {
  const [objetivos, setObjetivos] = useState<ObjetivoRow[]>([]);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchObjetivos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('objetivos')
      .select('*')
      .eq('anio', anio);

    // Build full grid
    const grid: ObjetivoRow[] = [];
    for (const analista of ANALISTAS) {
      for (let mes = 0; mes < 12; mes++) {
        const existing = data?.find(o => o.analista === analista && o.mes === mes);
        grid.push({
          analista,
          mes,
          meta_ventas: existing ? Number(existing.meta_ventas) : 0,
          meta_operaciones: existing ? Number(existing.meta_operaciones) : 0,
        });
      }
    }
    setObjetivos(grid);
    setLoading(false);
  }, [anio]);

  useEffect(() => { fetchObjetivos(); }, [fetchObjetivos]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const updateValue = (analista: string, mes: number, field: 'meta_ventas' | 'meta_operaciones', value: number) => {
    setObjetivos(prev => prev.map(o =>
      o.analista === analista && o.mes === mes ? { ...o, [field]: value } : o
    ));
  };

  const resetAnalista = (analista: string) => {
    setObjetivos(prev => prev.map(o =>
      o.analista === analista ? { ...o, meta_ventas: 0, meta_operaciones: 0 } : o
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('objetivos')
        .upsert(
          objetivos.map(obj => ({
            analista: obj.analista,
            mes: obj.mes,
            anio: anio,
            meta_ventas: obj.meta_ventas,
            meta_operaciones: obj.meta_operaciones,
          })),
          { onConflict: 'analista,mes,anio' }
        );
      if (error) throw error;
      setToast({ message: '✅ Objetivos guardados correctamente', type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      setToast({ message: `Error: ${msg}`, type: 'error' });
    }
    setSaving(false);
  };

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

      <header className="dashboard-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Metas y Objetivos</h1>
          <p style={{ color: 'var(--gris)', fontSize: '13px', fontWeight: 500 }}>Configurá los objetivos mensuales por analista</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <CustomSelect 
            options={[2024, 2025, 2026, 2027].map(y => ({ label: String(y), value: y }))}
            value={anio} 
            onChange={setAnio}
            width="110px"
          />
          <button className="btn-primary" style={{ height: '38px', padding: '0 20px' }} onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
            <span style={{ marginLeft: '8px' }}>Guardar Todo</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Cargando objetivos...</span></div>
      ) : (
        <>
          {ANALISTAS.map(analista => (
            <div key={analista} className="data-card">
              <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="data-card-title">{analista}</h3>
                <button className="btn-secondary" style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => resetAnalista(analista)}>
                  Resetear a 0
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Meta Ventas ($)</th>
                    <th>Meta Operaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, mes) => {
                    const obj = objetivos.find(o => o.analista === analista && o.mes === mes);
                    return (
                      <tr key={mes}>
                        <td style={{ fontWeight: 600 }}>{CONFIG.MESES_NOMBRES[mes]}</td>
                        <td>
                          <input className="form-input" type="number" style={{ width: '180px' }}
                            value={obj?.meta_ventas || 0}
                            onChange={e => updateValue(analista, mes, 'meta_ventas', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input className="form-input" type="number" style={{ width: '120px' }}
                            value={obj?.meta_operaciones || 0}
                            onChange={e => updateValue(analista, mes, 'meta_operaciones', Number(e.target.value))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        </>
      )}
    </div>
  );
}
