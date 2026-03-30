'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/context/DataContext';
import { CONFIG } from '@/types';
import {
  Save, RotateCcw, AlertCircle, Bell, Clock, History,
  Settings
} from 'lucide-react';

type DiasEntry = { dias_habiles: number | string; dias_transcurridos: number | string };
type HistRow = { capital_real: string; ops_real: string; meta_ventas: string; meta_operaciones: string };
type ActiveTab = 'alertas' | 'dias' | 'historico';

const EMPTY_HIST_ROWS = (): HistRow[] =>
  Array.from({ length: 12 }, () => ({ capital_real: '', ops_real: '', meta_ventas: '', meta_operaciones: '' }));

const parsePaste = (e: React.ClipboardEvent<HTMLInputElement>, onChange: (v: string) => void) => {
  e.preventDefault();
  const raw = e.clipboardData.getData('text').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(raw);
  if (!isNaN(num)) onChange(String(num));
};

export default function AjustesPage() {
  const {
    alertasConfig: ctxAlertas, setAlertasConfig: setCtxAlertas, pushAlertasConfigChange,
    diasConfig: ctxDias, setDiasConfig: setCtxDias, pushDiasConfigChange,
    historicoVentas: ctxHistorico, setHistoricoVentas: setCtxHistorico, pushHistoricoChange,
    objetivos: ctxObjetivos, setObjetivos: setCtxObjetivos, pushObjetivosChange
  } = useData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('alertas');
  const [alertasConfig, setAlertasConfig] = useState(CONFIG.ALERTAS_DEFAULT);
  const [diasValues, setDiasValues] = useState<Record<string, DiasEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDias, setSavingDias] = useState<string | null>(null);

  const [histAnalista, setHistAnalista] = useState(CONFIG.ANALISTAS_DEFAULT[0]);
  const [histAnio, setHistAnio] = useState(new Date().getFullYear() - 1);
  const [histRows, setHistRows] = useState<HistRow[]>(EMPTY_HIST_ROWS());
  const [savingHist, setSavingHist] = useState(false);
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

  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });

  const saveAlertas = async () => {
    setSaving(true);
    try {
      await supabase.from('alertas_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      for (const alerta of alertasConfig) {
        const { error } = await supabase.from('alertas_config').insert(alerta);
        if (error) throw error;
      }

      // Actualizar contexto y enviar broadcast
      setCtxAlertas([...alertasConfig]);
      alertasConfig.forEach(a => pushAlertasConfigChange('UPDATE', a));

      showSuccess('Configuración de alertas guardada');
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSaving(false);
  };

  const resetAlertas = () => {
    setAlertasConfig(CONFIG.ALERTAS_DEFAULT);
    showSuccess('Configuración restablecida');
  };

  const saveDiasHabiles = async (analista: string) => {
    const entry = diasValues[analista];
    if (!entry) return;
    setSavingDias(analista);
    try {
      const config = {
        analista,
        dias_habiles: Number(entry.dias_habiles) || 0,
        dias_transcurridos: Number(entry.dias_transcurridos) || 0,
        manual: true,
      };
      const { error } = await supabase.from('dias_habiles_config').upsert(config, { onConflict: 'analista' });
      if (error) throw error;

      // Actualizar contexto y enviar broadcast
      setCtxDias(prev => {
        const exists = prev.some(d => d.analista === analista);
        if (exists) return prev.map(d => d.analista === analista ? config : d);
        return [...prev, config];
      });
      pushDiasConfigChange('UPDATE', config);

      showSuccess(`Días guardados para ${analista}`);
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSavingDias(null);
  };

  const loadHistorico = useCallback(async (anal: string, anio: number) => {
    const [{ data: hist }, { data: objs }] = await Promise.all([
      supabase.from('historico_ventas').select('*').eq('analista', anal).eq('anio', anio),
      supabase.from('objetivos').select('*').eq('analista', anal).eq('anio', anio),
    ]);
    const rows = EMPTY_HIST_ROWS();
    if (hist) {
      hist.forEach((h: any) => {
        if (h.mes >= 0 && h.mes <= 11) {
          rows[h.mes].capital_real = h.capital_real > 0 ? String(h.capital_real) : '';
          rows[h.mes].ops_real = h.ops_real > 0 ? String(h.ops_real) : '';
        }
      });
    }
    if (objs) {
      objs.forEach((o: any) => {
        if (o.mes >= 0 && o.mes <= 11) {
          rows[o.mes].meta_ventas = o.meta_ventas > 0 ? String(o.meta_ventas) : '';
          rows[o.mes].meta_operaciones = o.meta_operaciones > 0 ? String(o.meta_operaciones) : '';
        }
      });
    }
    setHistRows(rows);
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') loadHistorico(histAnalista, histAnio);
  }, [histAnalista, histAnio, loadHistorico, activeTab]);

  const saveHistorico = async () => {
    setSavingHist(true);
    try {
      const upserts = histRows
        .map((row, mesIdx) => ({
          analista: histAnalista, anio: histAnio, mes: mesIdx,
          capital_real: Number(row.capital_real) || 0, ops_real: Number(row.ops_real) || 0,
        }))
        .filter(r => r.capital_real > 0 || r.ops_real > 0);

      if (upserts.length > 0) {
        const { error } = await supabase.from('historico_ventas').upsert(upserts, { onConflict: 'analista,anio,mes' });
        if (error) throw error;

        // Actualizar contexto y enviar broadcast para historico
        setCtxHistorico(prev => {
          const filtered = prev.filter(h => !(h.analista === histAnalista && h.anio === histAnio));
          const nuevos = upserts.map(u => ({ ...u, id: undefined }));
          return [...filtered, ...nuevos];
        });
        upserts.forEach(u => pushHistoricoChange('UPDATE', { ...u, id: undefined }));
      }

      const zeroMonths = histRows
        .map((_, mesIdx) => mesIdx)
        .filter(mesIdx => !Number(histRows[mesIdx].capital_real) && !Number(histRows[mesIdx].ops_real));

      for (const mes of zeroMonths) {
        await supabase.from('historico_ventas').delete().eq('analista', histAnalista).eq('anio', histAnio).eq('mes', mes);
      }

      const objUpserts = histRows
        .map((row, mesIdx) => ({
          analista: histAnalista, anio: histAnio, mes: mesIdx,
          meta_ventas: Number(row.meta_ventas) || 0, meta_operaciones: Number(row.meta_operaciones) || 0,
        }))
        .filter(r => r.meta_ventas > 0 || r.meta_operaciones > 0);

      if (objUpserts.length > 0) {
        const { error } = await supabase.from('objetivos').upsert(objUpserts, { onConflict: 'analista,mes,anio' });
        if (error) throw error;

        // Actualizar contexto y enviar broadcast para objetivos
        setCtxObjetivos(prev => {
          const filtered = prev.filter(o => !(o.analista === histAnalista && o.anio === histAnio));
          const nuevos = objUpserts.map(u => ({ ...u, id: undefined }));
          return [...filtered, ...nuevos];
        });
        objUpserts.forEach(u => pushObjetivosChange('UPDATE', { ...u, id: undefined }));
      }
      showSuccess(`Histórico guardado para ${histAnalista}`);
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSavingHist(false);
  };

  const updateDias = (analista: string, field: keyof DiasEntry, value: number | string) => {
    setDiasValues(prev => ({ ...prev, [analista]: { ...prev[analista], [field]: value } }));
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

      <header className="dashboard-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gris)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Settings size={14} /> Sistema
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>Ajustes</h1>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="toolbar" style={{ justifyContent: 'flex-start', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0', borderRadius: 0, background: 'transparent' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          {[
            { id: 'alertas', label: 'Alertas', icon: Bell },
            { id: 'dias', label: 'Días Hábiles', icon: Clock },
            { id: 'historico', label: 'Histórico', icon: History },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as ActiveTab)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 4px', border: 'none', background: 'transparent',
                fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: activeTab === t.id ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.2s',
                color: activeTab === t.id ? '#fff' : '#666',
                position: 'relative',
              }}
            >
              <t.icon size={16} />
              {t.label}
              {activeTab === t.id && (
                <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: '#fff' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: '400px' }}>
          <div className="spinner" />
          <span style={{ color: '#555' }}>Cargando configuración...</span>
        </div>
      ) : (
        <div style={{ width: '100%' }}>

          {/* TAB: ALERTAS */}
          {activeTab === 'alertas' && (
            <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="data-card-header" style={{ marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Gestión de Alertas</h3>
                  <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>Parámetros de vencimiento y colores de indicadores</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-secondary" onClick={resetAlertas} style={{ fontSize: '12px' }}>
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  <button className="btn-primary" onClick={saveAlertas} disabled={saving} style={{ fontSize: '12px' }}>
                    <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ color: '#444' }}>Tipo de Alerta</th>
                      <th style={{ color: '#444' }}>Estado Aplicado</th>
                      <th style={{ color: '#444' }}>Días Límite</th>
                      <th style={{ color: '#444' }}>Identificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertasConfig.map((alerta, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>{alerta.nombre}</td>
                        <td><span className="status-badge" style={{ background: 'rgba(255,255,255,0.03)', color: '#888' }}>{alerta.estado}</span></td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            style={{ width: '80px', textAlign: 'center' }}
                            value={alerta.dias}
                            onChange={e => {
                              const updated = [...alertasConfig];
                              updated[idx] = { ...updated[idx], dias: Number(e.target.value) };
                              setAlertasConfig(updated);
                            }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: alerta.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                            <input
                              className="form-input"
                              type="text"
                              value={alerta.color}
                              style={{ width: '90px', fontSize: '11px', fontFamily: 'monospace' }}
                              onChange={e => {
                                const updated = [...alertasConfig];
                                updated[idx] = { ...updated[idx], color: e.target.value };
                                setAlertasConfig(updated);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DIAS HABILES */}
          {activeTab === 'dias' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {['Todos', ...CONFIG.ANALISTAS_DEFAULT].map(analista => {
                const entry = diasValues[analista] || { dias_habiles: 22, dias_transcurridos: 0 };
                return (
                  <div key={analista} className="data-card" style={{ padding: '24px', background: '#0a0a0a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h4 style={{ fontWeight: 800, fontSize: '16px' }}>{analista === 'Todos' ? 'Punto de Venta' : analista}</h4>
                      <Clock size={14} color="#333" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#555', fontSize: '11px' }}>Días Hábiles</label>
                        <input
                          className="form-input"
                          type="number" step="0.5"
                          value={entry.dias_habiles}
                          onChange={e => updateDias(analista, 'dias_habiles', e.target.value)}
                          style={{ height: '42px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#555', fontSize: '11px' }}>Días Transcurridos</label>
                        <input
                          className="form-input"
                          type="number" step="0.5"
                          value={entry.dias_transcurridos}
                          onChange={e => updateDias(analista, 'dias_transcurridos', e.target.value)}
                          style={{ height: '42px' }}
                        />
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: '42px', marginTop: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={() => saveDiasHabiles(analista)}
                        disabled={savingDias === analista}
                      >
                        {savingDias === analista ? '...' : <Save size={14} />}
                        <span>{savingDias === analista ? 'Guardando' : 'Actualizar'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: HISTORICO */}
          {activeTab === 'historico' && (
            <div className="data-card" style={{ background: '#0a0a0a' }}>
              <div className="data-card-header" style={{ marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Histórico de Desempeño</h3>
                  <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>Control de objetivos y resultados de períodos anteriores</p>
                </div>
                <button className="btn-primary" onClick={saveHistorico} disabled={savingHist}>
                  <Save size={14} /> {savingHist ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>

              {/* Selectors */}
              <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ color: '#444', marginBottom: '8px' }}>Analista</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['PDV', ...CONFIG.ANALISTAS_DEFAULT].map(a => (
                      <button key={a} onClick={() => setHistAnalista(a)} style={{
                        padding: '8px 16px', borderRadius: '8px', border: '1px solid',
                        fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        borderColor: histAnalista === a ? 'rgba(255,255,255,0.2)' : 'transparent',
                        background: histAnalista === a ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: histAnalista === a ? '#fff' : '#444',
                      }}>{a}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ color: '#444', marginBottom: '8px' }}>Año</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 1 - i).map(y => (
                      <button key={y} onClick={() => setHistAnio(y)} style={{
                        padding: '8px 12px', borderRadius: '8px', border: '1px solid',
                        fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        borderColor: histAnio === y ? 'rgba(255,255,255,0.2)' : 'transparent',
                        background: histAnio === y ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: histAnio === y ? '#fff' : '#444',
                      }}>{y}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ border: '1px solid rgba(255,255,255,0.03)' }}>
                  <thead>
                    <tr>
                      <th style={{ color: '#444', width: '120px' }}>Mes</th>
                      <th style={{ color: '#888' }}>Metas Capital ($)</th>
                      <th style={{ color: '#888' }}>Metas Ops</th>
                      <th style={{ color: '#bbb' }}>Real Capital ($)</th>
                      <th style={{ color: '#bbb' }}>Real Ops</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONFIG.MESES_NOMBRES.map((mes, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', height: '54px' }}>
                        <td style={{ fontWeight: 700, fontSize: '13px', color: '#555', textTransform: 'uppercase' }}>{mes}</td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{ width: '140px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: 0 }}
                            placeholder="-"
                            value={histRows[idx].meta_ventas}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_ventas: e.target.value }; return next;
                            })}
                            onPaste={e => parsePaste(e, v => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_ventas: v }; return next;
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{ width: '80px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: 0, textAlign: 'center' }}
                            placeholder="-"
                            value={histRows[idx].meta_operaciones}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_operaciones: e.target.value }; return next;
                            })}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{ width: '140px', background: 'rgba(255,255,255,0.02)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRadius: 0 }}
                            placeholder="-"
                            value={histRows[idx].capital_real}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], capital_real: e.target.value }; return next;
                            })}
                            onPaste={e => parsePaste(e, v => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], capital_real: v }; return next;
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{ width: '80px', background: 'rgba(255,255,255,0.02)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, textAlign: 'center' }}
                            placeholder="-"
                            value={histRows[idx].ops_real}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], ops_real: e.target.value }; return next;
                            })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info del sistema */}
          <footer style={{ marginTop: '48px', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <span style={{ fontSize: '11px', color: '#333', fontWeight: 600, letterSpacing: '0.5px' }}>VERSION {CONFIG.APP_VERSION}</span>
              <span style={{ fontSize: '11px', color: '#333', fontWeight: 600, letterSpacing: '0.5px' }}>ENGINE: SUPABASE</span>
            </div>
            <div style={{ fontSize: '11px', color: '#333' }}>© 2026 Obsidiana Dashboard</div>
          </footer>
        </div>
      )}
    </div>
  );
}
