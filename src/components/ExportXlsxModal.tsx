'use client';

import React, { useState } from 'react';
import { X, Download, Loader2, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '@/components/CustomSelect';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import ModalPortal from '@/components/ModalPortal';
import { formatDate } from '@/lib/utils';
import styles from './ExportXlsxModal.module.css';

const ESTADOS = [
  'proyeccion', 'venta', 'en seguimiento', 'score bajo',
  'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc',
];
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
  const { nombres: ANALISTAS } = useAnalistas();
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
  const [esRe, setEsRe] = useState(''); // '' = todos, 'si' = solo RE, 'no' = solo no RE
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
    variant: 'default' | 'danger' = 'default',
  ) => (
    <div className={styles.chips}>
      {options.map(opt => {
        const isActive = selected.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            aria-pressed={isActive}
            onClick={() => toggleArray(opt, setFn)}
            className={`${styles.chip} ${isActive ? (variant === 'danger' ? styles.chipDanger : styles.chipActive) : ''}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );

  const buildBody = (isPreview: boolean) => ({
    fechaDesde, fechaHasta, empleador: '', estados, analista, search,
    fechaScoreDesde, fechaScoreHasta, montoMin, montoMax, scoreMin, scoreMax,
    tipoCliente, acuerdoPrecios: acuerdoPrecios ? [acuerdoPrecios] : [], tipoAlerta, esRe,
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

  const errorEl = error ? <p className={styles.error}>{error}</p> : null;

  return (
    <ModalPortal>
    <div
      className={`modal-overlay ${styles.overlay}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <motion.div
        drag
        dragMomentum={false}
        className={`modal-content ${styles.modal} ${preview ? styles.modalPreview : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-xlsx-title"
      >

        {/* Header */}
        <div className={`modal-header ${styles.header}`}>
          <div className={styles.heading}>
          {preview && (
            <button
              type="button"
              aria-label="Volver a filtros"
              onClick={() => { setPreview(null); setError(''); }}
              className={styles.iconButton}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Download size={24} className={styles.headingIcon} />
          <h2 id="export-xlsx-title" className="modal-title">
            {preview ? `Vista previa — ${preview.total} registros` : 'Exportar XLSX Avanzado'}
          </h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={handleClose} className={`btn-icon ${styles.closeButton}`}>
            <X size={24} />
          </button>
        </div>

        <div className={`modal-body ${styles.body}`}>

        {preview ? (
          /* ── PASO 2: Tabla de registros ── */
          <>
            {preview.total === 0 ? (
              <div className={styles.emptyPreview}>
                No hay registros con los filtros aplicados.
              </div>
            ) : (
              <div className={styles.tableViewport}>
                <table className={styles.previewTable}>
                  <colgroup>
                    <col className={styles.colName} />
                    <col className={styles.colCuil} />
                    <col className={styles.colAnalyst} />
                    <col className={styles.colState} />
                    <col className={styles.colDate} />
                    <col className={styles.colEmployer} />
                    <col className={styles.colDependency} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>CUIL</th>
                      <th>Analista</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Empleador</th>
                      <th>Repartición / Establecimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.registros.map((r, i) => (
                      <tr key={`${r.cuil}-${i}`}>
                        <td title={r.nombre}>{r.nombre || '—'}</td>
                        <td>{r.cuil || '—'}</td>
                        <td>{r.analista || '—'}</td>
                        <td>{r.estado || '—'}</td>
                        <td>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                        <td title={r.empleador}>{r.empleador || '—'}</td>
                        <td title={r.dependencia}>{r.dependencia || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {errorEl}

            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || preview.total === 0}
              className={`${styles.actionButton} ${preview.total === 0 ? styles.actionDisabled : ''}`}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {loading ? 'Generando...' : preview.total === 0 ? 'Sin registros' : 'Descargar XLSX'}
            </button>
          </>
        ) : (
          /* ── PASO 1: Filtros ── */
          <>
            <div className={styles.filterGrid}>
              <div className={styles.field}>
                <label>Búsqueda General</label>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, CUIL, etc." />
              </div>
              
              <div className={styles.field}>
                <label>Analista</label>
                <div className={styles.selectScale}>
                  <CustomSelect
                    value={analista}
                    onChange={(val) => setAnalista(String(val))}
                    options={[{ value: '', label: 'Todos' }, ...ANALISTAS.map(a => ({ value: a, label: a }))]}
                    width="100%"
                  />
                </div>
              </div>

              <div className={styles.splitFields}>
                <div className={styles.field}>
                  <label>Monto Mín</label>
                  <input type="number" value={montoMin} onChange={e => setMontoMin(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Monto Máx</label>
                  <input type="number" value={montoMax} onChange={e => setMontoMax(e.target.value)} />
                </div>
              </div>

              <div className={styles.splitFields}>
                <div className={styles.field}>
                  <label>Fecha Desde</label>
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Fecha Hasta</label>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                </div>
              </div>

              <div className={styles.splitFields}>
                <div className={styles.field}>
                  <label>Score Mín</label>
                  <input type="number" value={scoreMin} onChange={e => setScoreMin(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Score Máx</label>
                  <input type="number" value={scoreMax} onChange={e => setScoreMax(e.target.value)} />
                </div>
              </div>

              <div className={styles.splitFields}>
                <div className={styles.field}>
                  <label>Fecha Score Desde</label>
                  <input type="date" value={fechaScoreDesde} onChange={e => setFechaScoreDesde(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Fecha Score Hasta</label>
                  <input type="date" value={fechaScoreHasta} onChange={e => setFechaScoreHasta(e.target.value)} />
                </div>
              </div>

              <div className={styles.field}>
                <label>Tipo de Cliente</label>
                {renderChips(CLIENTE_OPCIONES, tipoCliente, setTipoCliente)}
              </div>

              <div className={styles.field}>
                <label>Acuerdo de Precios</label>
                <input type="text" value={acuerdoPrecios} onChange={e => setAcuerdoPrecios(e.target.value)} placeholder="Ej. Comercial, Convenio..." />
              </div>

              <div className={styles.field}>
                <label>RE (Resumen Ejecutivo)</label>
                <div className={styles.selectScale}>
                  <CustomSelect
                    value={esRe}
                    onChange={(val) => setEsRe(String(val))}
                    options={[
                      { value: '', label: 'Todos' },
                      { value: 'si', label: 'Solo RE' },
                      { value: 'no', label: 'Solo no RE' },
                    ]}
                    width="100%"
                  />
                </div>
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Estados</label>
                {renderChips(ESTADOS, estados, setEstados)}
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Tipo de Alerta</label>
                {renderChips(ALERTAS_OPCIONES, tipoAlerta, setTipoAlerta, 'danger')}
              </div>
            </div>

            {errorEl}

            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className={styles.previewButton}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
              {loading ? 'Consultando Registros...' : 'Vista previa de Exportación'}
            </button>
          </>
        )}
        </div>
      </motion.div>
    </div>
    </ModalPortal>
  );
}
