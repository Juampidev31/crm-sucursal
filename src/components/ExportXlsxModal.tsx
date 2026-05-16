'use client';

import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

const ESTADOS = [
  'proyeccion', 'venta', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc',
];
const ANALISTAS = ['Luciana', 'Victoria'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportXlsxModal({ open, onClose }: Props) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [empleador, setEmpleador] = useState('');
  const [estados, setEstados] = useState<string[]>([]);
  const [analista, setAnalista] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleEstado = (estado: string) => {
    setEstados(prev =>
      prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado]
    );
  };

  if (!open) return null;

  async function handleDownload() {
    setLoading(true);
    setError('');
    try {
      const session = localStorage.getItem('ventas_pro_session') ?? '';
      const res = await fetch('/api/admin/export-xlsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session': session,
        },
        body: JSON.stringify({ fechaDesde, fechaHasta, empleador, estados, analista }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? 'Error al exportar');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registros-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('Error de red al exportar');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
    background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff', fontSize: 15, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 6,
    fontSize: 9, fontWeight: 800, color: '#555',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px) saturate(120%)', WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '20px 16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, padding: '32px 28px', width: 320,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)', margin: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Download size={18} style={{ color: '#fff' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Exportar XLSX</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', marginLeft: 'auto' }}>
            <X size={18} />
          </button>
        </div>

        <div>
          <label style={labelStyle}>Fecha desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Fecha hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Empleador (opcional)</label>
          <input
            type="text"
            value={empleador}
            onChange={e => setEmpleador(e.target.value)}
            placeholder="Dejar vacío para todos"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Estados (opcional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ESTADOS.map(est => {
              const isActive = estados.includes(est);
              return (
                <span
                  key={est}
                  onClick={() => toggleEstado(est)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: isActive ? '#fff' : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#000' : '#666',
                    border: `1px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {est}
                </span>
              );
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Analista (opcional)</label>
          <select value={analista} onChange={e => setAnalista(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Todos los analistas</option>
            {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {error && (
          <p style={{ color: '#e53e3e', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            marginTop: 4, width: '100%', padding: '10px',
            background: '#fff', color: '#000', border: 'none',
            borderRadius: 8, fontWeight: 700, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Generando...' : 'Descargar'}
        </button>
      </div>
    </div>
  );
}
