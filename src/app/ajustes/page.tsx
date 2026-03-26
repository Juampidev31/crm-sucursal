'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CONFIG } from '@/types';
import { Save, RotateCcw, AlertCircle, Bell, Clock } from 'lucide-react';

type DiasEntry = { dias_habiles: number; dias_transcurridos: number };

export default function AjustesPage() {
  const [alertasConfig, setAlertasConfig] = useState(CONFIG.ALERTAS_DEFAULT);
  const [diasValues, setDiasValues] = useState<Record<string, DiasEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data: alertas } = await supabase.from('alertas_config').select('*');
    if (alertas && alertas.length > 0) {
      setAlertasConfig(alertas.map(a => ({
        nombre: a.nombre, estado: a.estado, dias: a.dias,
        mensaje: a.mensaje, color: a.color,
      })));
    }

    const { data: dias } = await supabase.from('dias_habiles_config').select('*');
    const initialDias: Record<string, DiasEntry> = {};
    ['Todos', ...CONFIG.ANALISTAS_DEFAULT].forEach(analista => {
      const cfg = dias?.find(d => d.analista === analista);
      initialDias[analista] = {
        dias_habiles: Number(cfg?.dias_habiles) || 22,
        dias_transcurridos: Number(cfg?.dias_transcurridos) || 0,
      };
    });
    setDiasValues(initialDias);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const saveAlertas = async () => {
    setSaving(true);
    try {
      await supabase.from('alertas_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      for (const alerta of alertasConfig) {
        const { error } = await supabase.from('alertas_config').insert(alerta);
        if (error) throw error;
      }
      setToast({ message: 'Configuración de alertas guardada', type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      setToast({ message: `Error: ${msg}`, type: 'error' });
    }
    setSaving(false);
  };

  const resetAlertas = () => {
    setAlertasConfig(CONFIG.ALERTAS_DEFAULT);
    setToast({ message: 'Configuración restablecida a valores por defecto', type: 'success' });
  };

  const saveDiasHabiles = async (analista: string) => {
    const entry = diasValues[analista];
    if (!entry) return;
    try {
      const { error } = await supabase.from('dias_habiles_config').upsert({
        analista,
        dias_habiles: entry.dias_habiles,
        dias_transcurridos: entry.dias_transcurridos,
        manual: true,
      }, { onConflict: 'analista' });
      if (error) throw error;
      setToast({ message: `Días hábiles guardados para ${analista}`, type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      setToast({ message: `Error: ${msg}`, type: 'error' });
    }
  };

  const updateDias = (analista: string, field: keyof DiasEntry, value: number) => {
    setDiasValues(prev => ({
      ...prev,
      [analista]: { ...prev[analista], [field]: value },
    }));
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

      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Ajustes de Sistema</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>Configuración de alertas y días hábiles</p>
        </div>
      </header>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Cargando configuración...</span></div>
      ) : (
        <>
          {/* Configuración de Alertas */}
          <div className="data-card">
            <div className="data-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Bell size={20} style={{ color: 'var(--naranja)' }} />
                <h3 className="data-card-title">Configuración de Alertas</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={resetAlertas}>
                  <RotateCcw size={14} /> Restablecer
                </button>
                <button className="btn-primary" onClick={saveAlertas} disabled={saving}>
                  <Save size={14} /> Guardar
                </button>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Días</th>
                  <th>Color</th>
                </tr>
              </thead>
              <tbody>
                {alertasConfig.map((alerta, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{alerta.nombre}</td>
                    <td style={{ fontSize: '12px', color: '#888' }}>{alerta.estado}</td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        style={{ width: '80px' }}
                        value={alerta.dias}
                        onChange={e => {
                          const updated = [...alertasConfig];
                          updated[idx] = { ...updated[idx], dias: Number(e.target.value) };
                          setAlertasConfig(updated);
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="color"
                          value={alerta.color}
                          style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          onChange={e => {
                            const updated = [...alertasConfig];
                            updated[idx] = { ...updated[idx], color: e.target.value };
                            setAlertasConfig(updated);
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#555' }}>{alerta.color}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Configuración de Días Hábiles */}
          <div className="data-card">
            <div className="data-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={20} style={{ color: 'var(--azul)' }} />
                <h3 className="data-card-title">Días Hábiles del Mes</h3>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {['Todos', ...CONFIG.ANALISTAS_DEFAULT].map(analista => {
                const entry = diasValues[analista] || { dias_habiles: 22, dias_transcurridos: 0 };
                return (
                  <div key={analista} className="kpi-card" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '16px' }}>{analista}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Días Hábiles</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.5"
                          value={entry.dias_habiles}
                          onChange={e => updateDias(analista, 'dias_habiles', Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Días Transcurridos</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.5"
                          value={entry.dias_transcurridos}
                          onChange={e => updateDias(analista, 'dias_transcurridos', Number(e.target.value))}
                        />
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => saveDiasHabiles(analista)}
                      >
                        <Save size={14} /> Guardar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info del sistema */}
          <div className="data-card" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: '12px' }}>
              <span>Versión: {CONFIG.APP_VERSION}</span>
              <span>Analistas: {CONFIG.ANALISTAS_DEFAULT.join(', ')}</span>
              <span>Backend: Supabase</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
