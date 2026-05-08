'use client';

import React, { useState } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { parseCSVAudit, performAudit, AuditResult } from '@/lib/audit-import-utils';
import { Upload, CheckCircle2, AlertCircle, Info, X, FileText, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Registro } from '@/types';

export default function ImportAuditTab() {
  const { registros: dbRecords, bulkInsertRegistros, refresh } = useRegistros();
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<AuditResult[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'duplicate' | 'mismatch'>('all');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsProcessing(true);
    
    try {
      const text = await f.text();
      const csvRecords = parseCSVAudit(text);
      const auditResults = performAudit(csvRecords, dbRecords);
      setResults(auditResults);
    } catch (err) {
      console.error(err);
      alert('Error al procesar el archivo. Asegúrate de que sea un CSV válido.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!results) return;
    const toImport = results.filter(r => r.status === 'new').map(r => r.csvRecord);
    if (toImport.length === 0) {
      alert('No hay registros nuevos para importar.');
      return;
    }
    
    if (!confirm(`¿Deseas importar ${toImport.length} registros nuevos encontrados?`)) return;
    
    try {
      setIsProcessing(true);
      await bulkInsertRegistros(toImport);
      alert('Importación completada con éxito.');
      setResults(null);
      setFile(null);
      refresh(true);
    } catch (err) {
      console.error(err);
      alert('Error al importar registros.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredResults = results?.filter(r => filterStatus === 'all' || r.status === filterStatus) || [];

  return (
    <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', animation: 'fadeIn 0.3s ease-out' }}>
      <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Auditoría e Importación Masiva</h3>
          <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Compara archivos externos con tu base de datos actual para detectar faltantes o errores.</p>
        </div>
        {results && (
          <button className="btn-secondary" onClick={() => { setResults(null); setFile(null); }} style={{ fontSize: '12px' }}>
            <X size={14} /> Cancelar / Limpiar
          </button>
        )}
      </div>

      {!results ? (
        <div style={{ 
          padding: '80px 20px', 
          textAlign: 'center', 
          border: '2px dashed rgba(255,255,255,0.05)', 
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <Upload size={48} style={{ color: '#333', marginBottom: 24 }} />
          <h4 style={{ color: '#fff', marginBottom: 8, fontSize: '16px', fontWeight: 700 }}>Sube tu listado en formato CSV</h4>
          <p style={{ color: '#666', marginBottom: 32, maxWidth: '400px', marginInline: 'auto', fontSize: '14px' }}>
            El sistema verificará por CUIL, Nombre, Mes e Importe si los registros ya existen en tu reporte.
          </p>
          
          <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} id="audit-upload" />
          <label htmlFor="audit-upload" className="btn-primary" style={{ cursor: 'pointer', padding: '12px 32px', fontSize: '14px' }}>
            {isProcessing ? 'PROCESANDO...' : 'SELECCIONAR ARCHIVO'}
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div 
              onClick={() => setFilterStatus('new')}
              style={{ 
                background: filterStatus === 'new' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.05)', 
                border: `1px solid ${filterStatus === 'new' ? '#22c55e' : 'rgba(34, 197, 94, 0.1)'}`, 
                padding: '20px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s'
              }}
            >
              <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 800, letterSpacing: '1px', marginBottom: '8px' }}>NUEVOS (FALTAN)</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff' }}>{results.filter(r => r.status === 'new').length}</div>
            </div>
            
            <div 
              onClick={() => setFilterStatus('mismatch')}
              style={{ 
                background: filterStatus === 'mismatch' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.05)', 
                border: `1px solid ${filterStatus === 'mismatch' ? '#eab308' : 'rgba(234, 179, 8, 0.1)'}`, 
                padding: '20px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s'
              }}
            >
              <div style={{ fontSize: '11px', color: '#eab308', fontWeight: 800, letterSpacing: '1px', marginBottom: '8px' }}>DIFERENCIAS</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff' }}>{results.filter(r => r.status === 'mismatch').length}</div>
            </div>

            <div 
              onClick={() => setFilterStatus('duplicate')}
              style={{ 
                background: filterStatus === 'duplicate' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)', 
                border: `1px solid ${filterStatus === 'duplicate' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}`, 
                padding: '20px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s'
              }}
            >
              <div style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '1px', marginBottom: '8px' }}>YA EXISTENTES</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#444' }}>{results.filter(r => r.status === 'duplicate').length}</div>
            </div>
            
            <div 
              onClick={() => setFilterStatus('all')}
              style={{ 
                background: filterStatus === 'all' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', 
                border: '1px solid rgba(255,255,255,0.05)', 
                padding: '20px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s'
              }}
            >
              <div style={{ fontSize: '11px', color: '#666', fontWeight: 800, letterSpacing: '1px', marginBottom: '8px' }}>TOTAL ARCHIVO</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff' }}>{results.length}</div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '13px', color: '#888' }}>
              Archivo: <strong>{file?.name}</strong> • Mostrando {filteredResults.length} registros
            </span>
            <button 
              className="btn-primary" 
              onClick={handleImport} 
              disabled={isProcessing || results.filter(r => r.status === 'new').length === 0}
              style={{ padding: '8px 24px' }}
            >
              {isProcessing ? 'IMPORTANDO...' : `IMPORTAR ${results.filter(r => r.status === 'new').length} NUEVOS`}
            </button>
          </div>

          {/* Results Table */}
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', color: '#555', fontSize: '11px', fontWeight: 800 }}>FECHA</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: '#555', fontSize: '11px', fontWeight: 800 }}>CLIENTE / CUIL</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: '#555', fontSize: '11px', fontWeight: 800 }}>IMPORTE</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: '#555', fontSize: '11px', fontWeight: 800 }}>ANALISTA</th>
                  <th style={{ padding: '16px', textAlign: 'left', color: '#555', fontSize: '11px', fontWeight: 800 }}>AUDITORÍA</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.slice(0, 500).map((res, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: res.status === 'mismatch' ? 'rgba(234, 179, 8, 0.02)' : 'transparent' }}>
                    <td style={{ padding: '16px', color: '#fff', fontWeight: 600 }}>{res.csvRecord.fecha}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 700, color: '#fff' }}>{res.csvRecord.nombre}</div>
                      <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{res.csvRecord.cuil}</div>
                    </td>
                    <td style={{ padding: '16px', fontWeight: 800, color: '#fff' }}>
                      ${res.csvRecord.monto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '16px', color: '#888' }}>{res.csvRecord.analista}</td>
                    <td style={{ padding: '16px' }}>
                      {res.status === 'new' && (
                        <div style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '11px' }}>
                          <CheckCircle2 size={16} /> FALTANTE (IMPORTAR)
                        </div>
                      )}
                      {res.status === 'duplicate' && (
                        <div style={{ color: '#444', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '11px' }}>
                          <Check size={16} /> YA CARGADO
                        </div>
                      )}
                      {res.status === 'mismatch' && (
                        <div style={{ color: '#eab308', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '11px' }}>
                            <AlertCircle size={16} /> DISCREPANCIA
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: 500, opacity: 0.8 }}>
                            {res.diffMessage}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredResults.length > 500 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px', background: 'rgba(255,255,255,0.01)' }}>
                Mostrando los primeros 500 registros de {filteredResults.length}...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
