import React from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuditoriaPage() {
  const { data: registros, error } = await supabase
    .from('auditoria')
    .select('*')
    .order('fecha_hora', { ascending: false })
    .limit(200);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Log de Auditoría</h1>
        </div>
      </header>

      <div className="data-card">
        {(!registros || registros.length === 0) ? (
          <div className="empty-state">
            <p>No hay registros de auditoría</p>
            <p>Las acciones del sistema aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>ID Registro</th>
                <th>Analista</th>
                <th>Acción</th>
                <th>Campo</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(reg => (
                <tr key={reg.id}>
                  <td style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap' }}>
                    {formatDateTime(reg.fecha_hora)}
                  </td>
                  <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {reg.id_registro?.substring(0, 15) || '-'}
                  </td>
                  <td>{reg.analista || '-'}</td>
                  <td>
                    <span style={{
                      padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                      background: reg.accion === 'Creación' ? 'rgba(76,175,80,0.1)' :
                        reg.accion === 'Eliminación' ? 'rgba(220,53,69,0.1)' : 'rgba(255,193,7,0.1)',
                      color: reg.accion === 'Creación' ? 'var(--verde)' :
                        reg.accion === 'Eliminación' ? 'var(--rojo)' : 'var(--naranja)',
                    }}>
                      {reg.accion}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px' }}>{reg.campo_modificado || '-'}</td>
                  <td style={{ fontSize: '12px', color: '#888', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {reg.valor_nuevo || reg.valor_anterior || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
