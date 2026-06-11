'use client';

import React, { useState } from 'react';
import { X, Download, Loader2, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

const ESTADOS = [
  'proyeccion', 'venta', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc',
];
const ANALISTAS = ['Luciana', 'Victoria'];
const ALERTAS_OPCIONES = ['Proyecciones', 'En seguimiento', 'Score bajo', 'Afectaciones', 'Derivado Aprobado CC', 'Derivado Rechazado CC'];
const CLIENTE_OPCIONES = ['Nuevo', 'Renovación'];

interface Props {
  open: boolean;
  onClose: () => void;
}

interface RegistroPreview {
  nombre: string;
  cuil: string;
  analista: string;
  estado: string;
  fecha: string;
  empleador: string;
  dependencia: string;
}

interface PreviewData {
  total: number;
  registros: RegistroPreview[];
}

export function ExportXlsxModal({ open, onClose }: Props) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [fechaScoreDesde, setFechaScoreDesde] = useState('');
  const [fechaScoreHasta, setFechaScoreHasta] = useState('');
  const [search, setSearch] = useState('');
  const [estados, setEstados] = useState<string[]>([]);
  const [tipoAlerta, setTipoAlerta] = useState<string[]>([]);
  const [tipoCliente, setTipoCliente] = useState<string[]>([]);
  const [acuerdoPrecios, setAcuerdoPrecios] = useState('');
  const [montoMin, setMontoMin] = useState('');
  const [montoMax, setMontoMax] = useState('');
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [analista, setAnalista] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const toggleArray = (val: string, setFn: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFn(prev => prev.includes(val) ? prev.filter(e => e !== val) : [...prev, val]);
  };

  const renderChips = (
    options: string[],
    selected: string[],
    setFn: React.Dispatch<React.SetStateAction<string[]>>,
    accent: { bg: string; color: string; border: string } = { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  ) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
      {options.map(opt => {
        const isActive = selected.includes(opt);
        return (
          <span key={opt} onClick={() => toggleArray(opt, setFn)}
            style={{
              padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              background: isActive ? accent.bg : 'rgba(255,255,255,0.02)',
              color: isActive ? accent.color : '#8f929d',
              border: `1px solid ${isActive ? accent.border : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>{opt}</span>
        );
      })}
    </div>
  );

  const buildBody = (isPreview: boolean) => ({
    fechaDesde, fechaHasta, empleador: '', estados, analista, search,
    fechaScoreDesde, fechaScoreHasta, montoMin, montoMax, scoreMin, scoreMax,
    tipoCliente, acuerdoPrecios: acuerdoPrecios ? [acuerdoPrecios] : [], tipoAlerta,
    ...(isPreview ? { preview: true } : {}),
  });

  const session = () => localStorage.getItem('ventas_pro_session') ?? '';

  async function handlePreview() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/export-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session': session() },
        body: JSON.stringify(buildBody(true)),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? 'Error al obtener vista previa');
        return;
      }
      setPreview(await res.json());
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/export-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session': session() },
        body: JSON.stringify(buildBody(false)),
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
      setPreview(null);
    } catch {
      setError('Error de red al exportar');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose();
    setPreview(null);
    setError('');
  }

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    color: '#fff', fontSize: 16, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 8,
    fontSize: 11, fontWeight: 700, color: '#a1a5b3',
    textTransform: 'uppercase', letterSpacing: '0.8px',
  };
  const cellStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.02)', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis',
  };
  const headStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 11, fontWeight: 800, color: '#8f929d',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap',
  };

  const errorEl = error ? <p style={{ color: '#e53e3e', fontSize: 13, margin: 0 }}>{error}</p> : null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px) saturate(120%)', WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '20px 16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.03)',
        borderRadius: 16, padding: '36px 32px',
        width: preview ? 1200 : 960, maxWidth: '97vw',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)', margin: 'auto',
        display: 'flex', flexDirection: 'column', gap: 24,
        transition: 'width 0.2s',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {preview && (
            <button
              onClick={() => { setPreview(null); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8f929d', padding: 0 }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Download size={24} style={{ color: '#fff' }} />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>
            {preview ? `Vista previa — ${preview.total} registros` : 'Exportar XLSX Avanzado'}
          </span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8f929d', marginLeft: 'auto' }}>
            <X size={24} />
          </button>
        </div>

        {preview ? (
          /* ── PASO 2: Tabla de registros ── */
          <>
            {preview.total === 0 ? (
              <div style={{ color: '#8f929d', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                No hay registros con los filtros aplicados.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 180 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 220 }} />
                  </colgroup>
                  <thead style={{ background: 'rgba(255,255,255,0.01)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={headStyle}>Nombre</th>
                      <th style={headStyle}>CUIL</th>
                      <th style={headStyle}>Analista</th>
                      <th style={headStyle}>Estado</th>
                      <th style={headStyle}>Fecha</th>
                      <th style={headStyle}>Empleador</th>
                      <th style={headStyle}>Repartición / Establecimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.registros.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={cellStyle} title={r.nombre}>{r.nombre || '—'}</td>
                        <td style={cellStyle}>{r.cuil || '—'}</td>
                        <td style={cellStyle}>{r.analista || '—'}</td>
                        <td style={cellStyle}>{r.estado || '—'}</td>
                        <td style={cellStyle}>{r.fecha || '—'}</td>
                        <td style={cellStyle} title={r.empleador}>{r.empleador || '—'}</td>
                        <td style={cellStyle} title={r.dependencia}>{r.dependencia || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {errorEl}

            <button
              onClick={handleDownload}
              disabled={loading || preview.total === 0}
              style={{
                width: '100%', padding: '10px',
                background: preview.total === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(16, 185, 129, 0.15)',
                color: preview.total === 0 ? '#64748b' : '#10b981',
                border: preview.total === 0 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8, fontWeight: 700, fontSize: 15,
                cursor: (loading || preview.total === 0) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {loading ? 'Generando...' : preview.total === 0 ? 'Sin registros' : 'Descargar XLSX'}
            </button>
          </>
        ) : (
          /* ── PASO 1: Filtros ── */
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 32px' }}>
              <div>
                <label style={labelStyle}>Búsqueda General</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, CUIL, etc." style={inputStyle} />
              </div>
              
              <div>
                <label style={labelStyle}>Analista</label>
                <div style={{ transform: 'scale(1.15)', transformOrigin: 'top left', width: '87%' }}>
                  <CustomSelect
                    value={analista}
                    onChange={(val) => setAnalista(String(val))}
                    options={[{ value: '', label: 'Todos' }, ...ANALISTAS.map(a => ({ value: a, label: a }))]}
                    width="100%"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Monto Mín</label>
                  <input type="number" value={montoMin} onChange={e => setMontoMin(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Monto Máx</label>
                  <input type="number" value={montoMax} onChange={e => setMontoMax(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha Desde</label>
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha Hasta</label>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Score Mín</label>
                  <input type="number" value={scoreMin} onChange={e => setScoreMin(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Score Máx</label>
                  <input type="number" value={scoreMax} onChange={e => setScoreMax(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha Score Desde</label>
                  <input type="date" value={fechaScoreDesde} onChange={e => setFechaScoreDesde(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha Score Hasta</label>
                  <input type="date" value={fechaScoreHasta} onChange={e => setFechaScoreHasta(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Tipo de Cliente</label>
                {renderChips(CLIENTE_OPCIONES, tipoCliente, setTipoCliente)}
              </div>

              <div>
                <label style={labelStyle}>Acuerdo de Precios</label>
                <input type="text" value={acuerdoPrecios} onChange={e => setAcuerdoPrecios(e.target.value)} placeholder="Ej. Comercial, Convenio..." style={inputStyle} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Estados</label>
                {renderChips(ESTADOS, estados, setEstados)}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Tipo de Alerta</label>
                {renderChips(ALERTAS_OPCIONES, tipoAlerta, setTipoAlerta, { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' })}
              </div>
            </div>

            {errorEl}

            <button
              onClick={handlePreview}
              disabled={loading}
              style={{
                marginTop: 8, width: '100%', padding: '16px',
                background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 12, fontWeight: 800, fontSize: 18,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
              {loading ? 'Consultando Registros...' : 'Vista previa de Exportación'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
