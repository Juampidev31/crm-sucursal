'use client';

import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportXlsxModal({ open, onClose }: Props) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [empleador, setEmpleador] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        body: JSON.stringify({ fechaDesde, fechaHasta, empleador }),
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
    width: '100%', padding: '8px 10px', borderRadius: 8,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 14, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontSize: 12, color: '#aaa',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1a1a2e', borderRadius: 16, padding: 28, width: 360,
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Exportar XLSX</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
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

        {error && (
          <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 0', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#374151' : '#16a34a', color: '#fff',
            fontWeight: 700, fontSize: 14,
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Generando...' : 'Descargar'}
        </button>
      </div>
    </div>
  );
}
